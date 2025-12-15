<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { getAuthContext } from '$lib/auth/context';
	import { enhance } from '$app/forms';
	import { createClient } from '$lib/supabase/client';
	import WaitingRoom from '$lib/components/WaitingRoom.svelte';
	import TimeLength from '$lib/components/TimeLength.svelte';
	import Establishing from '$lib/components/Establishing.svelte';
	import DrawingCards from '$lib/components/DrawingCards.svelte';
	import EndGame from '$lib/components/EndGame.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import type { PageData, ActionData } from './$types';

	const auth = getAuthContext();

	let { data, form } = $props<{ data: PageData; form?: ActionData }>();

	const gameCode = $derived($page.params.gameCode);
	const wasKicked = $derived($page.url.searchParams.get('kicked') === 'true');

	let displayName = $state('');

	// Reactive game state (initialized from server data, updated via real-time)
	let gameState = $state<PageData['game'] | null>(null);
	let playersState = $state<PageData['players']>([]);
	let turnsState = $state<PageData['turns']>([]);
	// Initialize wasAPlayer from server data, but it will update reactively when isPlayer changes
	let wasAPlayer = $state(data.isPlayer || false);

	// Initialize and sync state with server data
	$effect(() => {
		if (data.game) {
			gameState = data.game;
		}
		if (data.players) {
			playersState = data.players;
		}
		if (data.turns) {
			turnsState = data.turns;
		}
	});

	// Derived values
	const isCreator = $derived(
		gameState && auth.user
			? auth.user.id === (gameState as NonNullable<PageData['game']>).created_by
			: false
	);
	const currentPlayer = $derived(
		auth.user
			? playersState.find((p: PageData['players'][number]) => p.user_id === auth.user?.id)
			: undefined
	);
	const isPlayer = $derived(currentPlayer !== undefined);

	// Track if we are/were a player - update when isPlayer changes
	// This will trigger when currentPlayer becomes available (when auth.user loads)
	$effect(() => {
		if (isPlayer) {
			wasAPlayer = true;
		}
	});

	// Detect if player was kicked (when they disappear from players list)
	$effect(() => {
		if (!auth.loading && auth.user && wasAPlayer && !isPlayer) {
			// Player was kicked - redirect to show kicked message
			wasAPlayer = false;
			window.location.href = `/games/${gameCode}?kicked=true`;
		}
	});

	const isActive = $derived(
		gameState ? (gameState as NonNullable<PageData['game']>).current_phase < 4 : false
	);

	// Set up real-time subscriptions
	$effect(() => {
		if (!browser || !gameState) return;

		const supabase = createClient();
		const gameId = (gameState as NonNullable<PageData['game']>).id;

		// Subscribe to game changes
		const gameChannel = supabase
			.channel(`game:${gameId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'games',
					filter: `id=eq.${gameId}`
				},
				(payload) => {
					if (payload.eventType === 'UPDATE' && payload.new) {
						// Update gameState with the new data, preserving reactivity
						gameState = { ...payload.new } as PageData['game'];
					} else if (payload.eventType === 'INSERT' && payload.new) {
						// Handle insert (shouldn't happen for existing game, but just in case)
						gameState = { ...payload.new } as PageData['game'];
					}
				}
			)
			.subscribe((status) => {
				if (status === 'CHANNEL_ERROR') {
					console.error('Error subscribing to game changes');
				}
			});

		// Subscribe to player changes
		const playersChannel = supabase
			.channel(`players:${gameId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'players',
					filter: `game_id=eq.${gameId}`
				},
				async () => {
					// Refetch players when changes occur - this will trigger derived values to update
					const { data: players } = await supabase
						.from('players')
						.select('id, display_name, user_id, turn_order')
						.eq('game_id', gameId)
						.order('turn_order', { ascending: true });
					if (players) {
						playersState = players as PageData['players'];
					}
				}
			)
			.subscribe();

		// Subscribe to turns changes (for phase 2 and 3)
		const turnsChannel = supabase
			.channel(`turns:${gameId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'turns',
					filter: `game_id=eq.${gameId}`
				},
				async () => {
					// Refetch turns based on current phase
					const currentPhase = (gameState as NonNullable<PageData['game']>).current_phase;
					if (currentPhase === 2) {
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

						if (faceCardTurns) {
							turnsState = faceCardTurns.map((turn: any) => ({
								...turn,
								prompt_text: turn.face_card_prompts?.prompt || null
							})) as PageData['turns'];
						}
					} else if (currentPhase === 3) {
						// Phase 3: Fetch numbered card prompts
						const { data: numberedCardTurns } = await supabase
							.from('turns')
							.select('id, game_id, player_id, card_number, draw_order, created_at')
							.eq('game_id', gameId)
							.not('card_number', 'is', null)
							.order('created_at', { ascending: true });

						if (numberedCardTurns && numberedCardTurns.length > 0) {
							// Fetch prompts for each turn
							const promptPromises = numberedCardTurns.map(async (turn: any) => {
								const { data: prompt, error } = await supabase
									.from('numbered_card_prompts')
									.select('prompt')
									.eq('card_number', turn.card_number)
									.eq('draw_order', turn.draw_order)
									.single();

								return {
									...turn,
									prompt_text: error ? null : (prompt as any)?.prompt || null
								};
							});

							turnsState = (await Promise.all(promptPromises)) as PageData['turns'];
						} else {
							turnsState = [];
						}
					}
				}
			)
			.subscribe();

		// Cleanup subscriptions on unmount
		return () => {
			gameChannel.unsubscribe();
			playersChannel.unsubscribe();
			turnsChannel.unsubscribe();
		};
	});
</script>

<div class="game-room-container">
	{#if !gameState}
		<p>Loading game...</p>
	{:else if wasKicked}
		<!-- Kicked player message -->
		<div class="kicked-message">
			<h1>You've been removed from the game</h1>
			<p>You were kicked from "{gameState?.title || 'this game'}" by the game creator.</p>
			<a href="/games/join" class="btn btn-primary">Join a Different Game</a>
		</div>
	{:else if !isActive && !isPlayer}
		<!-- Game ended and user is not a player -->
		<h1>Game Ended</h1>
		<p>This game has already ended.</p>
	{:else if !isPlayer}
		<!-- Join form for non-players -->
		<div class="join-prompt">
			<h1>Join Game</h1>
			<p class="game-title">"{(gameState as NonNullable).title}"</p>
			<p class="game-code">Game Code: {gameCode}</p>

			{#if form?.error}
				<div class="error-message">{form.error}</div>
			{/if}

			<form method="POST" action="?/join" use:enhance>
				<div class="form-group">
					<label for="displayName">Display Name</label>
					<input
						type="text"
						id="displayName"
						name="displayName"
						bind:value={displayName}
						placeholder="Enter your display name"
						required
						maxlength="50"
						class="name-input" />
					<p class="help-text">This is how other players will see you in the game</p>
				</div>

				<button type="submit" class="join-button" disabled={!displayName.trim()}>
					Join Game
				</button>
			</form>
		</div>
	{:else if gameState && isPlayer}
		<!-- Game room for players -->
		<GameHeader game={gameState} />
		{#if gameState.current_phase === 0}
			<WaitingRoom game={gameState} players={playersState} user={data.user} {form} />
		{:else if gameState.current_phase === 1}
			<TimeLength game={gameState} players={playersState} user={data.user} {form} />
		{:else if gameState.current_phase === 2}
			<Establishing
				game={gameState}
				players={playersState}
				user={data.user}
				turns={turnsState}
				{form} />
		{:else if gameState.current_phase === 3}
			<DrawingCards
				game={gameState}
				players={playersState}
				user={data.user}
				turns={turnsState}
				{form} />
		{:else if gameState.current_phase === 4}
			<EndGame game={gameState} players={playersState} turns={turnsState} />
		{/if}
	{/if}
</div>

<style>
	.game-room-container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
	}

	.join-prompt {
		text-align: center;
	}

	.join-prompt h1 {
		margin-bottom: 1rem;
	}

	.game-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #333;
		margin: 1rem 0;
	}

	.game-code {
		font-size: 1.1rem;
		color: #666;
		margin-bottom: 2rem;
		font-family: monospace;
		letter-spacing: 0.1em;
	}

	.form-group {
		margin-bottom: 1.5rem;
		text-align: left;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 1rem;
	}

	.name-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.name-input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
	}

	.name-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.help-text {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 0;
	}

	.error-message {
		padding: 1rem;
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.join-button {
		width: 100%;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-top: 1rem;
	}

	.join-button:hover:not(:disabled) {
		background-color: #0056b3;
	}

	.join-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.kicked-message {
		text-align: center;
		padding: 3rem 2rem;
	}

	.kicked-message h1 {
		color: #dc3545;
		margin-bottom: 1rem;
	}

	.kicked-message p {
		font-size: 1.1rem;
		color: #666;
		margin-bottom: 2rem;
	}

	.kicked-message .btn {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		text-decoration: none;
		border-radius: 4px;
	}
</style>
