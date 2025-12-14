<script lang="ts">
	import type { PageData } from '../../routes/games/[gameCode]/$types';

	type Player = PageData['players'][number];

	let { game, players, user, playerId } = $props<{
		game: PageData['game'];
		players: PageData['players'];
		user: PageData['user'];
		playerId: PageData['playerId'];
	}>();

	const isCreator = $derived(user?.id === game.created_by);
	const currentPlayer = $derived(
		players.find((p: Player) => (user ? p.user_id === user.id : p.id === playerId))
	);
</script>

<div class="waiting-room">
	<h1>Waiting Room</h1>
	<p class="game-title">"{game.title}"</p>
	<p class="game-code">Game Code: {game.code}</p>

	<div class="players-section">
		<h2>Players ({players.length})</h2>
		<div class="players-list">
			{#each players as player}
				<div class="player-item">
					<span class="player-name">{player.display_name}</span>
					{#if player.user_id === game.created_by}
						<span class="badge creator">Creator</span>
					{/if}
					{#if player.confirm_location}
						<span class="badge confirmed">✓ Confirmed</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if isCreator}
		<div class="creator-section">
			<h2>Game Creator Controls</h2>
			<p>Set the location for this game and wait for players to confirm.</p>
			<p class="info">Waiting room functionality will be fully implemented in Phase 6!</p>
		</div>
	{:else if currentPlayer}
		<div class="player-section">
			<p>Welcome, {currentPlayer.display_name}!</p>
			<p class="info">Waiting for the game creator to set the location and start the game.</p>
		</div>
	{/if}
</div>

<style>
	.waiting-room {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		text-align: center;
		margin-bottom: 1rem;
	}

	.game-title {
		text-align: center;
		font-size: 1.5rem;
		font-weight: 600;
		color: #333;
		margin-bottom: 0.5rem;
	}

	.game-code {
		text-align: center;
		font-size: 1.1rem;
		color: #666;
		margin-bottom: 2rem;
		font-family: monospace;
		letter-spacing: 0.1em;
	}

	.players-section {
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.3rem;
		margin-bottom: 1rem;
		color: #333;
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background-color: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background-color: white;
		border-radius: 4px;
		border: 1px solid #e0e0e0;
	}

	.player-name {
		font-weight: 500;
		flex: 1;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.badge.creator {
		background-color: #007bff;
		color: white;
	}

	.badge.confirmed {
		background-color: #28a745;
		color: white;
	}

	.creator-section,
	.player-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background-color: #e7f3ff;
		border-radius: 8px;
		border: 1px solid #b3d9ff;
	}

	.creator-section h2 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.info {
		color: #666;
		font-style: italic;
		margin-top: 0.5rem;
	}
</style>
