import { createClient } from '$lib/supabase/client';
import type { PageData } from '../../routes/games/[gameCode]/$types';

export interface CompleteGameState {
	game: PageData['game'];
	players: PageData['players'];
	turns: PageData['turns'];
}

/**
 * Universal game subscription system
 * Subscribes to ALL changes related to a game and maintains complete state
 */
export function createGameSubscription(
	gameId: string,
	onStateUpdate: (state: CompleteGameState) => void
) {
	const supabase = createClient();

	// Initial state
	let currentState: CompleteGameState = {
		game: null,
		players: [],
		turns: []
	};

	/**
	 * Fetch complete game state from server
	 */
	async function fetchCompleteState(): Promise<CompleteGameState> {
		// Fetch game
		const { data: game } = await supabase
			.from('games')
			.select('*, players_ready_to_end_phase')
			.eq('id', gameId)
			.single();

		if (!game) {
			return currentState;
		}

		// Fetch players
		const { data: players } = await supabase
			.from('players')
			.select('id, display_name, user_id, turn_order')
			.eq('game_id', gameId)
			.order('turn_order', { ascending: true });

		// Fetch turns based on current phase
		let turns: PageData['turns'] = [];
		if (game.current_phase === 2) {
			// Phase 2: Fetch face card prompts
			const { data: faceCardTurns } = await supabase
				.from('turns')
				.select(
					`
					id,
					game_id,
					player_id,
					face_prompt_id,
					created_at,
					face_card_prompts:face_prompt_id (
						id,
						prompt
					)
				`
				)
				.eq('game_id', gameId)
				.not('face_prompt_id', 'is', null)
				.order('created_at', { ascending: true });

			turns =
				faceCardTurns?.map((turn: any) => ({
					...turn,
					prompt_text: turn.face_card_prompts?.prompt || null
				})) || [];
		} else if (game.current_phase === 3) {
			// Phase 3: Fetch numbered card prompts
			const { data: numberedCardTurns } = await supabase
				.from('turns')
				.select('id, game_id, player_id, card_number, draw_order, created_at, shared')
				.eq('game_id', gameId)
				.not('card_number', 'is', null)
				.order('created_at', { ascending: true });

			if (numberedCardTurns && numberedCardTurns.length > 0) {
				const promptPromises = numberedCardTurns.map(async (turn: any) => {
					const { data: prompt } = await supabase
						.from('numbered_card_prompts')
						.select('prompt')
						.eq('card_number', turn.card_number)
						.eq('draw_order', turn.draw_order)
						.single();

					return {
						...turn,
						prompt_text: prompt?.prompt || null,
						shared: turn.shared || false
					};
				});

				turns = await Promise.all(promptPromises);
			}
		}

		const newState: CompleteGameState = {
			game: game as PageData['game'],
			players: (players || []) as PageData['players'],
			turns: turns as PageData['turns']
		};

		currentState = newState;
		return newState;
	}

	// Debounce rapid changes to avoid excessive refetches
	let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	let isRefreshing = false;
	const DEBOUNCE_MS = 500; // Increased debounce to prevent rapid-fire updates

	function scheduleStateUpdate() {
		// Prevent concurrent refreshes
		if (isRefreshing) {
			return;
		}

		// Clear any pending update
		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}

		// Schedule update (with debounce to batch rapid changes)
		refreshTimeout = setTimeout(() => {
			isRefreshing = true;
			fetchCompleteState()
				.then((state) => {
					onStateUpdate(state);
				})
				.finally(() => {
					isRefreshing = false;
					refreshTimeout = null;
				});
		}, DEBOUNCE_MS);
	}

	// Fetch initial state immediately
	fetchCompleteState().then((state) => {
		onStateUpdate(state);
	});

	// Create a single channel for all game-related subscriptions
	const gameChannel = supabase
		.channel(`game-universal:${gameId}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'games',
				filter: `id=eq.${gameId}`
			},
			() => {
				// Any game change - immediately schedule state update
				scheduleStateUpdate();
			}
		)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'players',
				filter: `game_id=eq.${gameId}`
			},
			() => {
				// Any player change (including joins) - immediately schedule state update
				scheduleStateUpdate();
			}
		)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'turns',
				filter: `game_id=eq.${gameId}`
			},
			() => {
				// Any turn change - immediately schedule state update
				scheduleStateUpdate();
			}
		)
		.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				console.log(`✅ Universal game subscription active for game ${gameId}`);
				// Don't immediately fetch here - initial fetch already happened
				// This prevents double-fetching on subscription
			} else if (status === 'CHANNEL_ERROR') {
				console.error(`❌ Error subscribing to game ${gameId}`);
			}
		});

	return {
		unsubscribe: () => {
			if (refreshTimeout) {
				clearTimeout(refreshTimeout);
			}
			gameChannel.unsubscribe();
		},
		refresh: () => {
			return fetchCompleteState().then((state) => {
				onStateUpdate(state);
				return state;
			});
		}
	};
}
