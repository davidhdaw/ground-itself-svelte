import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const supabase = locals.supabase;
	const gameCode = params.gameCode;

	if (!gameCode) {
		throw error(400, 'Game code is required');
	}

	// Fetch game by code (including players_ready_to_end_phase)
	const { data: game, error: gameError } = await supabase
		.from('games')
		.select('*, players_ready_to_end_phase')
		.eq('code', gameCode.toUpperCase())
		.single();

	if (gameError || !game) {
		throw error(404, 'Game not found');
	}

	// Check if game is active (not ended - phase 4 is end game)
	const isActive = game.current_phase < 4;

	// Get current user (should always be set now due to anonymous auth)
	const {
		data: { user }
	} = await supabase.auth.getUser();

	// Check if user is a player in this game
	let isPlayer = false;
	let playerId: string | null = null;

	if (user) {
		// Look up player by user_id (works for both anonymous and authenticated users)
		const { data: player } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (player) {
			isPlayer = true;
			playerId = player.id;
		}
	}

	// Fetch players list for the game
	const { data: players } = await supabase
		.from('players')
		.select('id, display_name, user_id, turn_order')
		.eq('game_id', game.id)
		.order('turn_order', { ascending: true });

	// Fetch turns based on current phase
	let turns: any[] = [];
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
			.eq('game_id', game.id)
			.not('face_prompt_id', 'is', null)
			.order('created_at', { ascending: true });

		// Flatten the nested structure
		turns =
			faceCardTurns?.map((turn: any) => ({
				...turn,
				prompt_text: turn.face_card_prompts?.prompt || null
			})) || [];
	} else if (game.current_phase === 3) {
		// Phase 3: Fetch numbered card prompts (for future implementation)
		// Note: We need to join numbered_card_prompts on card_number and draw_order
		// Since Supabase doesn't support multi-column joins directly, we'll fetch turns
		// and then fetch prompts separately
		const { data: numberedCardTurns } = await supabase
			.from('turns')
			.select('id, game_id, player_id, card_number, draw_order, created_at')
			.eq('game_id', game.id)
			.not('card_number', 'is', null)
			.order('created_at', { ascending: true });

		if (numberedCardTurns && numberedCardTurns.length > 0) {
			// Fetch prompts for each turn
			const promptPromises = numberedCardTurns.map(async (turn: any) => {
				const { data: prompt } = await supabase
					.from('numbered_card_prompts')
					.select('prompt')
					.eq('card_number', turn.card_number)
					.eq('draw_order', turn.draw_order)
					.single();

				return {
					...turn,
					prompt_text: prompt?.prompt || null
				};
			});

			turns = await Promise.all(promptPromises);
		} else {
			turns = [];
		}
	}

	return {
		game,
		isPlayer,
		isActive,
		user: user || null,
		playerId,
		players: players || [],
		turns
	};
};

export const actions: Actions = {
	join: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		const formData = await event.request.formData();
		const displayName = formData.get('displayName')?.toString().trim();

		if (!displayName || displayName.length === 0) {
			return fail(400, { error: 'Display name is required' });
		}

		if (displayName.length > 50) {
			return fail(400, { error: 'Display name must be 50 characters or less' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, current_phase')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if game is active
		if (game.current_phase >= 4) {
			return fail(400, { error: 'This game has already ended.' });
		}

		// Check if display name is already taken in this game (case-insensitive)
		const { data: existingPlayerWithName, error: nameCheckError } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.ilike('display_name', displayName)
			.maybeSingle();

		if (nameCheckError) {
			console.error('Error checking duplicate display name:', nameCheckError);
			return fail(500, { error: 'Failed to validate display name. Please try again.' });
		}

		if (existingPlayerWithName) {
			return fail(400, {
				error: 'This display name is already taken. Please choose a different name.'
			});
		}

		// Get the current user (if authenticated)
		let {
			data: { user }
		} = await supabase.auth.getUser();

		// If not authenticated, sign in anonymously
		if (!user) {
			const { data: anonymousData, error: anonymousError } =
				await supabase.auth.signInAnonymously();
			if (anonymousError) {
				console.error('Error signing in anonymously:', anonymousError);
				console.error('Error details:', JSON.stringify(anonymousError, null, 2));
				return fail(500, {
					error: `Failed to authenticate: ${anonymousError.message || 'Unknown error'}. Please try again.`
				});
			}

			// Use the user from signInAnonymously directly (session cookies are set automatically)
			if (!anonymousData.user) {
				console.error('No user returned from anonymous sign-in');
				return fail(500, { error: 'Failed to establish session. Please try again.' });
			}
			user = anonymousData.user;
		}

		// Check if user is already a player
		if (user) {
			const { data: existingPlayer, error: existingPlayerError } = await supabase
				.from('players')
				.select('id')
				.eq('game_id', game.id)
				.eq('user_id', user.id)
				.maybeSingle();

			if (existingPlayerError) {
				console.error('Error checking existing player:', existingPlayerError);
				return fail(500, { error: 'Failed to validate player status. Please try again.' });
			}

			if (existingPlayer) {
				// Already a player, redirect
				throw redirect(303, `/games/${game.code}`);
			}
		}

		// Get the highest turn_order
		const { data: players, error: playersError } = await supabase
			.from('players')
			.select('turn_order')
			.eq('game_id', game.id)
			.order('turn_order', { ascending: false })
			.limit(1);

		if (playersError) {
			console.error('Error fetching players:', playersError);
			return fail(500, { error: 'Failed to join game. Please try again.' });
		}

		// Calculate next turn_order
		const nextTurnOrder = players && players.length > 0 ? players[0].turn_order + 1 : 0;

		// Add player to game (user should always be set now due to anonymous sign-in)
		if (!user) {
			return fail(500, { error: 'Authentication failed. Please try again.' });
		}

		const { data: player, error: playerError } = await supabase
			.from('players')
			.insert({
				game_id: game.id,
				display_name: displayName,
				user_id: user.id, // Always set now (never null)
				turn_order: nextTurnOrder,
				connected: true,
				confirm_location: false
			})
			.select()
			.single();

		if (playerError || !player) {
			console.error('Error creating player:', playerError);
			return fail(500, { error: 'Failed to join game. Please try again.' });
		}

		// Redirect to game room (will reload with isPlayer = true)
		throw redirect(303, `/games/${game.code}`);
	},
	setLocation: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to set the location' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, created_by, current_phase')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if user is the creator
		if (game.created_by !== user.id) {
			return fail(403, { error: 'Only the game creator can set the location' });
		}

		// Check if game is in waiting room phase
		if (game.current_phase !== 0) {
			return fail(400, { error: 'Location can only be set in the waiting room phase' });
		}

		const formData = await event.request.formData();
		const location = formData.get('location')?.toString().trim();

		if (!location || location.length === 0) {
			return fail(400, { error: 'Location is required' });
		}

		if (location.length > 200) {
			return fail(400, { error: 'Location must be 200 characters or less' });
		}

		// Get creator's player ID before updating
		const { data: creatorPlayer } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', user.id)
			.maybeSingle();

		// Update game location and reset confirmations to only include creator
		const updateData: { location: string; updated_at: string; confirmed_player_ids: string[] } = {
			location,
			updated_at: new Date().toISOString(),
			confirmed_player_ids: creatorPlayer ? [creatorPlayer.id] : []
		};

		const { error: updateError } = await supabase
			.from('games')
			.update(updateData)
			.eq('id', game.id);

		if (updateError) {
			console.error('Error updating location:', updateError);
			return fail(500, { error: 'Failed to update location. Please try again.' });
		}

		return { success: true };
	},
	confirmLocation: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, current_phase, location')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if game is in waiting room phase
		if (game.current_phase !== 0) {
			return fail(400, { error: 'Location can only be confirmed in the waiting room phase' });
		}

		// Check if location is set
		if (!game.location || game.location.trim().length === 0) {
			return fail(400, { error: 'The game creator must set a location first' });
		}

		// Get current user (should always be set now due to anonymous auth)
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to confirm location' });
		}

		// Get player ID by user_id
		const { data: player } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!player) {
			return fail(403, { error: 'You must be a player in this game to confirm location' });
		}

		const playerId = player.id;

		// Call the PostgreSQL function to add player to confirmed list
		const { error: functionError } = await supabase.rpc('confirm_player_location', {
			game_id_param: game.id,
			player_id_param: playerId
		});

		if (functionError) {
			console.error('Error confirming location:', functionError);
			return fail(500, { error: 'Failed to confirm location. Please try again.' });
		}

		return { success: true };
	},
	unconfirmLocation: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, current_phase, location, confirmed_player_ids')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if game is in waiting room phase
		if (game.current_phase !== 0) {
			return fail(400, { error: 'Location can only be unconfirmed in the waiting room phase' });
		}

		// Get current user (should always be set now due to anonymous auth)
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to unconfirm location' });
		}

		// Get player ID by user_id
		const { data: player } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!player) {
			return fail(403, { error: 'You must be a player in this game to unconfirm location' });
		}

		const playerId = player.id;

		// Call the PostgreSQL function to remove player from confirmed list
		const { error: functionError } = await supabase.rpc('unconfirm_player_location', {
			game_id_param: game.id,
			player_id_param: playerId
		});

		if (functionError) {
			console.error('Error unconfirming location:', functionError);
			return fail(500, { error: 'Failed to unconfirm location. Please try again.' });
		}

		return { success: true };
	},
	startGame: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to start the game' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, created_by, current_phase, location')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if user is the creator
		if (game.created_by !== user.id) {
			return fail(403, { error: 'Only the game creator can start the game' });
		}

		// Check if game is in waiting room phase
		if (game.current_phase !== 0) {
			return fail(400, { error: 'Game can only be started from the waiting room phase' });
		}

		// Check if location is set
		if (!game.location || game.location.trim().length === 0) {
			return fail(400, { error: 'You must set a location before starting the game' });
		}

		// Check if there are at least 2 players
		const { data: players, error: playersError } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id);

		if (playersError) {
			console.error('Error fetching players:', playersError);
			return fail(500, { error: 'Failed to validate players. Please try again.' });
		}

		if (!players || players.length < 2) {
			return fail(400, { error: 'You need at least 2 players to start the game' });
		}

		// Update game to phase 1 (Time Length Selection)
		const { error: updateError } = await supabase
			.from('games')
			.update({ current_phase: 1, updated_at: new Date().toISOString() })
			.eq('id', game.id);

		if (updateError) {
			console.error('Error starting game:', updateError);
			return fail(500, { error: 'Failed to start game. Please try again.' });
		}

		return { success: true };
	},
	kickPlayer: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to kick players' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, created_by, current_phase')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if user is the creator
		if (game.created_by !== user.id) {
			return fail(403, { error: 'Only the game creator can kick players' });
		}

		// Check if game is in waiting room phase
		if (game.current_phase !== 0) {
			return fail(400, { error: 'Players can only be kicked in the waiting room phase' });
		}

		const formData = await event.request.formData();
		const playerIdToKick = formData.get('playerId')?.toString();

		if (!playerIdToKick) {
			return fail(400, { error: 'Player ID is required' });
		}

		// Verify the player exists and belongs to this game
		const { data: player, error: playerError } = await supabase
			.from('players')
			.select('id, user_id')
			.eq('id', playerIdToKick)
			.eq('game_id', game.id)
			.single();

		if (playerError || !player) {
			return fail(404, { error: 'Player not found' });
		}

		// Prevent kicking the creator
		if (player.user_id === game.created_by) {
			return fail(400, { error: 'You cannot kick yourself' });
		}

		// Get current confirmed_player_ids and remove the kicked player
		const { data: currentGame } = await supabase
			.from('games')
			.select('confirmed_player_ids')
			.eq('id', game.id)
			.single();

		let updatedConfirmedIds = currentGame?.confirmed_player_ids || [];
		updatedConfirmedIds = updatedConfirmedIds.filter((id: string) => id !== playerIdToKick);

		// Update game to remove player from confirmed list, then delete the player
		const { error: updateError } = await supabase
			.from('games')
			.update({ confirmed_player_ids: updatedConfirmedIds })
			.eq('id', game.id);

		if (updateError) {
			console.error('Error updating confirmed players:', updateError);
			// Continue with deletion even if update fails
		}

		// Delete the player (cascade will handle related records)
		const { error: deleteError } = await supabase.from('players').delete().eq('id', playerIdToKick);

		if (deleteError) {
			console.error('Error kicking player:', deleteError);
			return fail(500, { error: 'Failed to kick player. Please try again.' });
		}

		return { success: true };
	},
	rollTimeLength: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to roll the cycle length' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, created_by, current_phase')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if user is the creator
		if (game.created_by !== user.id) {
			return fail(403, { error: 'Only the game creator can roll the cycle length' });
		}

		// Check if game is in phase 1 (Time Length Selection)
		if (game.current_phase !== 1) {
			return fail(400, {
				error: 'Cycle length can only be rolled in the time length selection phase'
			});
		}

		// Generate random cycle length
		const playLengthOptions = ['Days', 'Weeks', 'Years', 'Decades', 'Centuries', 'Millennia'];
		const randomIndex = Math.floor(Math.random() * playLengthOptions.length);
		const playLength = playLengthOptions[randomIndex];

		// Update game with new play_length
		const { error: updateError } = await supabase
			.from('games')
			.update({ play_length: playLength, updated_at: new Date().toISOString() })
			.eq('id', game.id);

		if (updateError) {
			console.error('Error rolling cycle length:', updateError);
			return fail(500, { error: 'Failed to roll cycle length. Please try again.' });
		}

		return { success: true, playLength };
	},
	confirmTimeLength: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to confirm the cycle length' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, created_by, current_phase, play_length')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if user is the creator
		if (game.created_by !== user.id) {
			return fail(403, { error: 'Only the game creator can confirm the cycle length' });
		}

		// Check if game is in phase 1 (Time Length Selection)
		if (game.current_phase !== 1) {
			return fail(400, {
				error: 'Cycle length can only be confirmed in the time length selection phase'
			});
		}

		// Check if play_length is set
		if (!game.play_length || game.play_length.trim().length === 0) {
			return fail(400, { error: 'You must roll a cycle length before confirming' });
		}

		// Get all players ordered by turn_order to initialize turn tracking
		const { data: allPlayers } = await supabase
			.from('players')
			.select('id, turn_order, connected')
			.eq('game_id', game.id)
			.order('turn_order', { ascending: true });

		if (!allPlayers || allPlayers.length === 0) {
			return fail(400, { error: 'No players found in game' });
		}

		// Find first connected player to start with
		const firstPlayer = allPlayers.find((p) => p.connected) || allPlayers[0];

		// Update game to phase 2 (Establishing Phase) and set first player's turn
		const { error: updateError } = await supabase
			.from('games')
			.update({
				current_phase: 2,
				current_turn_player_id: firstPlayer.id,
				updated_at: new Date().toISOString()
			})
			.eq('id', game.id);

		if (updateError) {
			console.error('Error confirming cycle length:', updateError);
			return fail(500, { error: 'Failed to confirm cycle length. Please try again.' });
		}

		return { success: true };
	},
	drawFaceCard: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, created_by, current_phase, current_turn_player_id')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if game is in phase 2 (Establishing Phase)
		if (game.current_phase !== 2) {
			return fail(400, {
				error: 'Face card prompts can only be drawn in the establishing phase'
			});
		}

		// Get current user (should always be set now due to anonymous auth)
		const {
			data: { user: currentUser }
		} = await supabase.auth.getUser();

		if (!currentUser) {
			return fail(401, { error: 'You must be authenticated to draw prompts' });
		}

		// Get current player by user_id
		const { data: player } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', currentUser.id)
			.maybeSingle();

		if (!player) {
			return fail(403, { error: 'You must be a player in this game to draw prompts' });
		}

		const playerId = player.id;

		// Check if it's this player's turn
		if (game.current_turn_player_id && game.current_turn_player_id !== playerId) {
			return fail(403, { error: "It's not your turn to draw a prompt" });
		}

		// Initialize turn tracking if not set (fallback - should have been set in confirmTimeLength)
		if (!game.current_turn_player_id) {
			// Get all players ordered by turn_order
			const { data: allPlayers } = await supabase
				.from('players')
				.select('id, turn_order, connected')
				.eq('game_id', game.id)
				.order('turn_order', { ascending: true });

			if (allPlayers && allPlayers.length > 0) {
				// Use the player who is trying to draw as the first turn (they initiated it)
				const { error: initError } = await supabase
					.from('games')
					.update({ current_turn_player_id: playerId })
					.eq('id', game.id);

				if (initError) {
					console.error('Error initializing turn tracking:', initError);
					return fail(500, { error: 'Failed to initialize turn tracking. Please try again.' });
				}
			} else {
				return fail(400, { error: 'No players found in game' });
			}
		}

		// Get already-drawn face card prompt IDs
		const { data: drawnTurns } = await supabase
			.from('turns')
			.select('face_prompt_id')
			.eq('game_id', game.id)
			.not('face_prompt_id', 'is', null);

		const drawnIds = new Set(
			(drawnTurns || []).map((turn) => turn.face_prompt_id).filter((id) => id !== null)
		);

		// Build available pool (1-12 minus drawn)
		const allIds = Array.from({ length: 12 }, (_, i) => i + 1);
		const availableIds = allIds.filter((id) => !drawnIds.has(id));

		if (availableIds.length === 0) {
			return fail(400, { error: 'All face card prompts have been drawn' });
		}

		// Randomly select from available pool
		const randomIndex = Math.floor(Math.random() * availableIds.length);
		const selectedPromptId = availableIds[randomIndex];

		// Create turn record with face_prompt_id
		const { error: insertError } = await supabase.from('turns').insert({
			game_id: game.id,
			player_id: playerId,
			face_prompt_id: selectedPromptId
		});

		if (insertError) {
			console.error('Error drawing face card:', insertError);
			console.error('Player ID:', playerId);
			console.error('Game ID:', game.id);
			console.error('Selected Prompt ID:', selectedPromptId);

			// Check if it's a unique constraint violation (shouldn't happen, but handle gracefully)
			if (insertError.code === '23505') {
				return fail(400, {
					error: 'This prompt has already been drawn. Please try again.'
				});
			}

			// Check if it's an RLS policy violation
			if (insertError.code === '42501' || insertError.message?.includes('policy')) {
				return fail(403, {
					error: `Permission denied: ${insertError.message || 'RLS policy violation'}`
				});
			}

			return fail(500, {
				error: `Failed to draw face card prompt: ${insertError.message || insertError.code || 'Unknown error'}`
			});
		}

		// Rotate to next player's turn
		// Get all players ordered by turn_order
		const { data: allPlayers } = await supabase
			.from('players')
			.select('id, turn_order, connected')
			.eq('game_id', game.id)
			.order('turn_order', { ascending: true });

		if (allPlayers && allPlayers.length > 0) {
			// Find current player's index
			const currentIndex = allPlayers.findIndex((p) => p.id === playerId);
			if (currentIndex !== -1) {
				// Find next connected player (wrap around if needed)
				let nextIndex = (currentIndex + 1) % allPlayers.length;
				let attempts = 0;
				// Skip disconnected players, but don't loop forever
				while (!allPlayers[nextIndex].connected && attempts < allPlayers.length) {
					nextIndex = (nextIndex + 1) % allPlayers.length;
					attempts++;
				}
				const nextPlayer = allPlayers[nextIndex];

				// Update game with next player's turn
				await supabase
					.from('games')
					.update({
						current_turn_player_id: nextPlayer.id,
						last_turn_player_id: playerId,
						updated_at: new Date().toISOString()
					})
					.eq('id', game.id);
			}
		} else {
			// Fallback: just update timestamp
			await supabase
				.from('games')
				.update({ updated_at: new Date().toISOString() })
				.eq('id', game.id);
		}

		return { success: true, promptId: selectedPromptId };
	},
	readyToEndPhase: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated to indicate readiness' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, current_phase')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if game is in phase 2 (Establishing Phase)
		if (game.current_phase !== 2) {
			return fail(400, {
				error: 'Can only indicate readiness in the establishing phase'
			});
		}

		// Check if at least 3 prompts have been drawn
		const { data: drawnTurns, count } = await supabase
			.from('turns')
			.select('id', { count: 'exact', head: true })
			.eq('game_id', game.id)
			.not('face_prompt_id', 'is', null);

		if ((count || 0) < 3) {
			return fail(400, {
				error: 'At least 3 prompts must be drawn before indicating readiness to end the phase'
			});
		}

		// Get player ID by user_id
		const { data: player } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!player) {
			return fail(403, { error: 'You must be a player in this game' });
		}

		// Call the PostgreSQL function to add player to ready list
		const { error: functionError } = await supabase.rpc('ready_to_end_phase', {
			game_id_param: game.id,
			player_id_param: player.id
		});

		if (functionError) {
			console.error('Error indicating readiness:', functionError);
			return fail(500, { error: 'Failed to indicate readiness. Please try again.' });
		}

		return { success: true };
	},
	unreadyToEndPhase: async (event) => {
		const supabase = event.locals.supabase;
		const gameCode = event.params.gameCode;

		if (!gameCode) {
			return fail(400, { error: 'Game code is required' });
		}

		// Get current user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			return fail(401, { error: 'You must be authenticated' });
		}

		// Get game
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, current_phase')
			.eq('code', gameCode.toUpperCase())
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found' });
		}

		// Check if game is in phase 2 (Establishing Phase)
		if (game.current_phase !== 2) {
			return fail(400, {
				error: 'Can only unready in the establishing phase'
			});
		}

		// Get player ID by user_id
		const { data: player } = await supabase
			.from('players')
			.select('id')
			.eq('game_id', game.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!player) {
			return fail(403, { error: 'You must be a player in this game' });
		}

		// Call the PostgreSQL function to remove player from ready list
		const { error: functionError } = await supabase.rpc('unready_to_end_phase', {
			game_id_param: game.id,
			player_id_param: player.id
		});

		if (functionError) {
			console.error('Error unreadying:', functionError);
			return fail(500, { error: 'Failed to update readiness. Please try again.' });
		}

		return { success: true };
	}
};
