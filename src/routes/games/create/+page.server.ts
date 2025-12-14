import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';

/**
 * Generate a unique game code (6 character alphanumeric)
 */
function generateGameCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * Generate a unique game code that doesn't exist in the database
 */
async function generateUniqueGameCode(supabase: App.Locals['supabase']): Promise<string> {
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const code = generateGameCode();

		// Check if code already exists
		const { data, error } = await supabase.from('games').select('id').eq('code', code).single();

		// If no game found with this code (PGRST116 = not found), it's unique
		if (error && error.code === 'PGRST116') {
			return code;
		}

		attempts++;
	}

	// Fallback: use timestamp-based code if we can't find a unique one
	return `G${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export const actions: Actions = {
	default: async (event) => {
		const supabase = event.locals.supabase;

		// Get authenticated user
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return fail(401, { error: 'You must be logged in to create a game' });
		}

		// Get form data
		const formData = await event.request.formData();
		const title = formData.get('title')?.toString().trim();

		if (!title || title.length === 0) {
			return fail(400, { error: 'Game title is required' });
		}

		if (title.length > 100) {
			return fail(400, { error: 'Game title must be 100 characters or less' });
		}

		// Generate unique game code
		const gameCode = await generateUniqueGameCode(supabase);

		// Create game record
		const { data: game, error: gameError } = await supabase
			.from('games')
			.insert({
				code: gameCode,
				title: title,
				created_by: user.id,
				current_phase: 0,
				location: ''
			})
			.select()
			.single();

		if (gameError || !game) {
			console.error('Error creating game:', gameError);
			return fail(500, { error: 'Failed to create game. Please try again.' });
		}

		// Create player record for the creator
		const { data: player, error: playerError } = await supabase
			.from('players')
			.insert({
				game_id: game.id,
				display_name: user.email?.split('@')[0] || 'Player',
				user_id: user.id,
				turn_order: 0,
				connected: true,
				confirm_location: false
			})
			.select()
			.single();

		if (playerError || !player) {
			console.error('Error creating player:', playerError);
			// Clean up game if player creation fails
			await supabase.from('games').delete().eq('id', game.id);
			return fail(500, { error: 'Failed to create player. Please try again.' });
		}

		// Redirect to game room using game code
		throw redirect(303, `/games/${game.code}`);
	}
};
