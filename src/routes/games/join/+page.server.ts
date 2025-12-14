import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const supabase = event.locals.supabase;

		// Get form data
		const formData = await event.request.formData();
		const gameCode = formData.get('code')?.toString().trim().toUpperCase();
		const displayName = formData.get('displayName')?.toString().trim();

		if (!gameCode || gameCode.length === 0) {
			return fail(400, { error: 'Game code is required' });
		}

		if (gameCode.length !== 6) {
			return fail(400, { error: 'Game code must be exactly 6 characters' });
		}

		if (!displayName || displayName.length === 0) {
			return fail(400, { error: 'Display name is required' });
		}

		if (displayName.length > 50) {
			return fail(400, { error: 'Display name must be 50 characters or less' });
		}

		// Validate game code exists and game is active
		const { data: game, error: gameError } = await supabase
			.from('games')
			.select('id, code, title, current_phase')
			.eq('code', gameCode)
			.single();

		if (gameError || !game) {
			return fail(404, { error: 'Game not found. Please check the game code.' });
		}

		// Check if game is active (not ended - phase 4 is end game)
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
		const {
			data: { user }
		} = await supabase.auth.getUser();

		// Check if user is already a player in this game
		if (user) {
			const { data: existingPlayer, error: existingPlayerError } = await supabase
				.from('players')
				.select('id')
				.eq('game_id', game.id)
				.eq('user_id', user.id)
				.maybeSingle();

			if (existingPlayerError) {
				console.error('Error checking existing player:', existingPlayerError);
				// Continue with join process if check fails
			} else if (existingPlayer) {
				// User is already in the game, redirect them
				throw redirect(303, `/games/${game.code}`);
			}
		}

		// Get the highest turn_order to assign the next one
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

		// Calculate next turn_order (highest + 1, or 0 if no players)
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

		// Redirect to game room
		throw redirect(303, `/games/${game.code}`);
	}
};
