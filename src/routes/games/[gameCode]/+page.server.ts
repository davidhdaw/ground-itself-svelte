import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const supabase = locals.supabase;
	const gameCode = params.gameCode;

	if (!gameCode) {
		throw error(400, 'Game code is required');
	}

	// Fetch game by code
	const { data: game, error: gameError } = await supabase
		.from('games')
		.select('*')
		.eq('code', gameCode.toUpperCase())
		.single();

	if (gameError || !game) {
		throw error(404, 'Game not found');
	}

	// Check if game is active (not ended - phase 4 is end game)
	const isActive = game.current_phase < 4;

	// Get current user (if authenticated)
	const {
		data: { user }
	} = await supabase.auth.getUser();

	// Check if user is a player in this game
	let isPlayer = false;
	let playerId: string | null = null;

	if (user) {
		// Check for authenticated user
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
	} else {
		// Check for anonymous player via cookie
		const playerIdCookie = cookies.get(`player_${game.id}`);
		if (playerIdCookie) {
			// Verify the player exists and belongs to this game
			const { data: player } = await supabase
				.from('players')
				.select('id')
				.eq('id', playerIdCookie)
				.eq('game_id', game.id)
				.maybeSingle();

			if (player) {
				isPlayer = true;
				playerId = player.id;
			} else {
				// Player was kicked - clear the cookie
				cookies.delete(`player_${game.id}`, { path: '/' });
			}
		}
	}

	// Fetch players list for the game
	const { data: players } = await supabase
		.from('players')
		.select('id, display_name, user_id, turn_order')
		.eq('game_id', game.id)
		.order('turn_order', { ascending: true });

	return {
		game,
		isPlayer,
		isActive,
		user: user || null,
		playerId,
		players: players || []
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

		// Get current user (if authenticated)
		const {
			data: { user }
		} = await supabase.auth.getUser();

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

		// Add player to game
		const { data: player, error: playerError } = await supabase
			.from('players')
			.insert({
				game_id: game.id,
				display_name: displayName,
				user_id: user?.id || null,
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

		// Set cookie for anonymous players to track their player ID
		if (!user) {
			event.cookies.set(`player_${game.id}`, player.id, {
				path: '/',
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});
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

		// Get current user (if authenticated)
		const {
			data: { user }
		} = await supabase.auth.getUser();

		// Get player ID
		let playerId: string | null = null;

		if (user) {
			const { data: player } = await supabase
				.from('players')
				.select('id')
				.eq('game_id', game.id)
				.eq('user_id', user.id)
				.maybeSingle();

			if (player) {
				playerId = player.id;
			}
		} else {
			// Check for anonymous player via cookie
			const playerIdCookie = event.cookies.get(`player_${game.id}`);
			if (playerIdCookie) {
				const { data: player } = await supabase
					.from('players')
					.select('id')
					.eq('id', playerIdCookie)
					.eq('game_id', game.id)
					.maybeSingle();

				if (player) {
					playerId = player.id;
				}
			}
		}

		if (!playerId) {
			return fail(403, { error: 'You must be a player in this game to confirm location' });
		}

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

		// Get current user (if authenticated)
		const {
			data: { user }
		} = await supabase.auth.getUser();

		// Get player ID
		let playerId: string | null = null;

		if (user) {
			const { data: player } = await supabase
				.from('players')
				.select('id')
				.eq('game_id', game.id)
				.eq('user_id', user.id)
				.maybeSingle();

			if (player) {
				playerId = player.id;
			}
		} else {
			// Check for anonymous player via cookie
			const playerIdCookie = event.cookies.get(`player_${game.id}`);
			if (playerIdCookie) {
				const { data: player } = await supabase
					.from('players')
					.select('id')
					.eq('id', playerIdCookie)
					.eq('game_id', game.id)
					.maybeSingle();

				if (player) {
					playerId = player.id;
				}
			}
		}

		if (!playerId) {
			return fail(403, { error: 'You must be a player in this game to unconfirm location' });
		}

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
	}
};
