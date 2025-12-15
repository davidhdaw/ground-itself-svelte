<script lang="ts">
	import type { PageData } from '../../routes/games/[gameCode]/$types';

	type Player = PageData['players'][number];
	type Turn = PageData['turns'][number];

	let { game, players, turns } = $props<{
		game: PageData['game'];
		players: PageData['players'];
		turns: PageData['turns'];
	}>();

	// Separate face card and numbered card turns
	const faceCardTurns = $derived(
		turns
			.filter((turn: Turn) => turn.face_prompt_id !== null)
			.sort((a: Turn, b: Turn) => {
				const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
				const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
				return aTime - bTime;
			})
	);

	const numberedCardTurns = $derived(
		turns
			.filter((turn: Turn) => turn.card_number !== null)
			.sort((a: Turn, b: Turn) => {
				const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
				const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
				return aTime - bTime;
			})
	);

	// Get player name by ID
	const getPlayerName = (playerId: string) => {
		return players.find((p: Player) => p.id === playerId)?.display_name || 'Unknown Player';
	};

	const totalTurns = $derived(faceCardTurns.length + numberedCardTurns.length);
</script>

<div class="end-game">
	<h1 class="end-game-header">Game Complete</h1>

	<div class="game-summary">
		<h2>Game Summary</h2>
		<div class="summary-grid">
			<div class="summary-item">
				<span class="summary-label">Title:</span>
				<span class="summary-value">{game.title}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Location:</span>
				<span class="summary-value">{game.location || 'Not set'}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Cycle Length:</span>
				<span class="summary-value">{game.play_length || 'Not set'}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Cycles Completed:</span>
				<span class="summary-value">{game.cycle || 1}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Players:</span>
				<span class="summary-value">{players.length}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Total Prompts:</span>
				<span class="summary-value">{totalTurns}</span>
			</div>
		</div>
	</div>

	<div class="players-list">
		<h2>Players</h2>
		<ul class="players-ul">
			{#each players as player}
				<li class="player-item">
					<span class="player-name">{player.display_name}</span>
					{#if player.turn_order !== null}
						<span class="player-order">(Turn {player.turn_order + 1})</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	{#if faceCardTurns.length > 0}
		<div class="prompts-section">
			<h2>Establishing Prompts (Phase 2)</h2>
			<div class="prompts-list">
				{#each faceCardTurns as turn}
					<div class="prompt-item">
						<div class="prompt-header">
							<span class="prompt-player">{getPlayerName(turn.player_id)}</span>
							<span class="prompt-date">
								{#if turn.created_at}
									{new Date(turn.created_at).toLocaleString()}
								{/if}
							</span>
						</div>
						<p class="prompt-text">{turn.prompt_text || 'No prompt text available'}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if numberedCardTurns.length > 0}
		<div class="prompts-section">
			<h2>Numbered Card Prompts (Phase 3)</h2>
			<div class="prompts-list">
				{#each numberedCardTurns as turn}
					<div class="prompt-item">
						<div class="prompt-header">
							<span class="prompt-player">{getPlayerName(turn.player_id)}</span>
							<span class="prompt-card">
								Card {turn.card_number}
								{#if turn.draw_order !== null}
									(Draw {turn.draw_order})
								{/if}
							</span>
							<span class="prompt-date">
								{#if turn.created_at}
									{new Date(turn.created_at).toLocaleString()}
								{/if}
							</span>
						</div>
						<p class="prompt-text">{turn.prompt_text || 'No prompt text available'}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="completion-message">
		<p>Thank you for playing! The story of this place is now complete.</p>
	</div>
</div>

<style>
	.end-game {
		width: 80%;
		max-width: 1440px;
		font-family: 'Merriweather', serif;
		font-size: 1.2rem;
		margin: 2rem auto;
		padding: 2rem;
	}

	.end-game-header {
		text-align: center;
		font-size: 3rem;
		color: #28a745;
		margin-bottom: 2rem;
	}

	.game-summary {
		background-color: #f8f9fa;
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.game-summary h2 {
		margin-top: 0;
		color: #333;
		font-size: 1.8rem;
		margin-bottom: 1.5rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.summary-label {
		font-weight: 600;
		color: #666;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.summary-value {
		font-size: 1.2rem;
		color: #333;
	}

	.players-list {
		background-color: #e7f3ff;
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.players-list h2 {
		margin-top: 0;
		color: #004085;
		font-size: 1.8rem;
		margin-bottom: 1.5rem;
	}

	.players-ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.player-item {
		background-color: white;
		padding: 1rem;
		border-radius: 4px;
		border-left: 4px solid #007bff;
	}

	.player-name {
		font-weight: 600;
		color: #333;
		display: block;
		margin-bottom: 0.25rem;
	}

	.player-order {
		font-size: 0.9rem;
		color: #666;
	}

	.prompts-section {
		margin-bottom: 2rem;
	}

	.prompts-section h2 {
		font-size: 1.8rem;
		color: #333;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #e6e6e6;
		padding-bottom: 0.5rem;
	}

	.prompts-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.prompt-item {
		background-color: white;
		border: 1px solid #e6e6e6;
		border-radius: 8px;
		padding: 1.5rem;
		transition: box-shadow 0.2s;
	}

	.prompt-item:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.prompt-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.prompt-player {
		font-weight: 600;
		color: #007bff;
		font-size: 1.1rem;
	}

	.prompt-card {
		font-size: 0.9rem;
		color: #666;
		background-color: #f8f9fa;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
	}

	.prompt-date {
		font-size: 0.85rem;
		color: #999;
	}

	.prompt-text {
		font-size: 1.1rem;
		line-height: 1.6;
		color: #333;
		margin: 0;
	}

	.completion-message {
		text-align: center;
		padding: 3rem 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		color: white;
		margin-top: 3rem;
	}

	.completion-message p {
		font-size: 1.5rem;
		margin: 0;
		font-weight: 500;
	}
</style>
