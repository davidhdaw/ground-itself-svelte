import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
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

	return {
		game
	};
};
