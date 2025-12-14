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
			}
		}
	}

	// Fetch players list for the game
	const { data: players } = await supabase
		.from('players')
		.select('id, display_name, user_id, turn_order, confirm_location')
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
	}
};
