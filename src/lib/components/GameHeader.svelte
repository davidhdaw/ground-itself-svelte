<script lang="ts">
	import type { PageData } from '../../routes/games/[gameCode]/$types';

	let { game } = $props<{
		game: PageData['game'];
	}>();

	const phaseNames: Record<number, string> = {
		0: 'Waiting Room',
		1: 'Time Length',
		2: 'Establishing',
		3: 'Drawing Cards',
		4: 'End Game'
	};

	const currentPhaseName = $derived(phaseNames[game.current_phase] || 'Unknown');
</script>

<div class="game-header">
	<h1 class="game-title">{game.title}</h1>
	<div class="game-info">
		<span class="game-code">Code: {game.code}</span>
		<span class="phase-badge">Phase: {currentPhaseName}</span>
	</div>
</div>

<style>
	.game-header {
		background-color: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		border: 1px solid #e0e0e0;
	}

	.game-title {
		margin: 0 0 0.75rem 0;
		font-size: 1.75rem;
		font-weight: 600;
		color: #333;
	}

	.game-info {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}

	.game-code {
		font-family: monospace;
		font-size: 0.9rem;
		color: #666;
		background-color: white;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		border: 1px solid #ddd;
	}

	.phase-badge {
		font-size: 0.9rem;
		color: #007bff;
		background-color: #e7f3ff;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.location {
		font-size: 0.9rem;
		color: #28a745;
		background-color: #d4edda;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
	}
</style>
