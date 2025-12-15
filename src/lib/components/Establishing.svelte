<script lang="ts">
	import { enhance } from '$app/forms';
	import PromptDisplay from './PromptDisplay.svelte';
	import type { PageData, ActionData } from '../../routes/games/[gameCode]/$types';

	type Player = PageData['players'][number];
	type Turn = PageData['turns'][number];

	let { game, players, user, turns, form } = $props<{
		game: PageData['game'];
		players: PageData['players'];
		user: PageData['user'];
		turns: PageData['turns'];
		form?: ActionData;
	}>();

	const isCreator = $derived(user?.id === game.created_by);
	const currentPlayer = $derived(
		user ? players.find((p: Player) => p.user_id === user.id) : undefined
	);

	// Get the current turn player
	const currentTurnPlayer = $derived(
		game.current_turn_player_id
			? players.find((p: Player) => p.id === game.current_turn_player_id)
			: null
	);

	// Check if it's the current player's turn
	// If current_turn_player_id is not set, allow any player to draw (fallback for initialization)
	const isMyTurn = $derived(
		currentPlayer &&
			(!game.current_turn_player_id ||
				currentPlayer.id === game.current_turn_player_id ||
				(currentTurnPlayer && currentPlayer.id === currentTurnPlayer.id))
	);

	// Filter turns to only face card prompts (establishing phase)
	const faceCardTurns = $derived(
		turns
			.filter((turn: Turn) => turn.face_prompt_id !== null)
			.sort((a: Turn, b: Turn) => {
				const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
				const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
				return aTime - bTime;
			})
	);

	const currentPrompt = $derived(
		faceCardTurns.length > 0 ? faceCardTurns[faceCardTurns.length - 1] : null
	);
	const previousPrompt = $derived(
		faceCardTurns.length > 1 ? faceCardTurns[faceCardTurns.length - 2] : null
	);

	// Calculate available prompts (12 total, minus already drawn)
	const availablePromptsCount = $derived(12 - faceCardTurns.length);
	const canDrawMore = $derived(availablePromptsCount > 0);
	const canEndPhase = $derived(faceCardTurns.length >= 3);

	// Get players ready to end phase
	const playersReadyToEndPhase = $derived((game.players_ready_to_end_phase as string[]) || []);
	const isCurrentPlayerReady = $derived(
		currentPlayer ? playersReadyToEndPhase.includes(currentPlayer.id) : false
	);
	const allPlayersReady = $derived(
		players.length > 0 && players.every((p: Player) => playersReadyToEndPhase.includes(p.id))
	);
	const readyPlayers = $derived(
		players.filter((p: Player) => playersReadyToEndPhase.includes(p.id))
	);
	const notReadyPlayers = $derived(
		players.filter((p: Player) => !playersReadyToEndPhase.includes(p.id))
	);
</script>

<div class="establishing">
	{#if faceCardTurns.length === 0 || faceCardTurns.length < 2}
		<h3 class="establishing-header">Establishing Our Place</h3>
	{/if}

	{#if previousPrompt}
		<PromptDisplay prompt={previousPrompt.prompt_text || ''} isPrevious={true} />
	{/if}

	{#if currentPrompt}
		<PromptDisplay prompt={currentPrompt.prompt_text || ''} />
	{/if}

	<div class="turn-indicator">
		{#if currentTurnPlayer}
			<p class="turn-label">Current Turn:</p>
			<p class="turn-player">{currentTurnPlayer.display_name}</p>
		{:else if game.current_turn_player_id}
			<p class="turn-label">Current Turn:</p>
			<p class="turn-player">Loading player info...</p>
		{:else}
			<p class="turn-label">Turn not initialized - any player can start</p>
		{/if}
	</div>

	<p class="establishing-rules">
		Players should take turns answering the prompts to establish the nature of our place. Keep going
		until the world feels established or there are no more questions, whichever happens first. Try
		to keep this discussion under 25 minutes. You may wish to make brief notes to jog your memory
		later.
	</p>

	{#if form?.error}
		<div class="error-message">{form.error}</div>
	{/if}

	{#if canDrawMore && isMyTurn}
		{#if currentPrompt}
			<form method="POST" action="?/drawFaceCard" use:enhance>
				<button type="submit" class="btn btn-primary">Next Question</button>
			</form>
		{:else}
			<form method="POST" action="?/drawFaceCard" use:enhance>
				<button type="submit" class="btn btn-primary">First Question</button>
			</form>
		{/if}
	{:else if canDrawMore && !isMyTurn}
		<div class="waiting-turn">
			<p>
				Waiting for {currentTurnPlayer?.display_name || 'another player'} to draw the next question...
			</p>
		</div>
	{/if}

	{#if canEndPhase}
		<div class="end-phase-section">
			{#if canDrawMore}
				<span class="btn-separator"></span>
			{/if}
			<div class="end-phase-controls">
				{#if isCurrentPlayerReady}
					<form method="POST" action="?/unreadyToEndPhase" use:enhance>
						<button type="submit" class="btn btn-secondary">Not Ready to End</button>
					</form>
				{:else}
					<form method="POST" action="?/readyToEndPhase" use:enhance>
						<button type="submit" class="btn btn-success">Ready to End Phase</button>
					</form>
				{/if}
			</div>

			<div class="ready-status">
				<p class="ready-label">Players ready to end phase:</p>
				{#if readyPlayers.length === 0}
					<p class="ready-count">None yet</p>
				{:else}
					<p class="ready-count">
						{readyPlayers.length} of {players.length} players
					</p>
					<ul class="ready-list">
						{#each readyPlayers as player}
							<li>{player.display_name}</li>
						{/each}
					</ul>
				{/if}

				{#if allPlayersReady}
					<p class="all-ready-message">
						All players are ready! The phase will end automatically...
					</p>
				{:else if readyPlayers.length > 0}
					<p class="waiting-message">
						Waiting for: {notReadyPlayers.map((p) => p.display_name).join(', ')}
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.establishing {
		width: 80%;
		max-width: 1440px;
		font-family: 'Merriweather', serif;
		font-size: 1.2rem;
		margin: 2rem auto;
		padding: 2rem;
	}

	.establishing-header {
		text-align: center;
		margin-bottom: 2rem;
		font-size: 2rem;
	}

	.turn-indicator {
		text-align: center;
		margin: 1.5rem 0;
		padding: 1rem;
		background-color: #e7f3ff;
		border-radius: 8px;
		border: 1px solid #b3d9ff;
	}

	.turn-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: #666;
		margin: 0 0 0.5rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.turn-player {
		font-size: 1.5rem;
		font-weight: 700;
		color: #007bff;
		margin: 0;
	}

	.establishing-rules {
		border-top: 2px solid #e6e6e6;
		border-bottom: 2px solid #e6e6e6;
		margin: 1rem 0;
		padding: 1rem 0;
		line-height: 1.6;
	}

	.waiting-turn {
		text-align: center;
		margin: 1.5rem 0;
		padding: 1rem;
		background-color: #fff3cd;
		border-radius: 8px;
		border: 1px solid #ffc107;
		color: #856404;
	}

	.error-message {
		padding: 1rem;
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		margin-bottom: 1rem;
		text-align: center;
	}

	.btn {
		background-color: black;
		color: white;
		align-self: center;
		padding: 10px 20px;
		margin-top: 1rem;
		margin-bottom: 1rem;
		border: 1px solid grey;
		border-radius: 5px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn:hover:not(:disabled) {
		background-color: #333;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #007bff;
		border-color: #007bff;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #0056b3;
		border-color: #0056b3;
	}

	.btn-success {
		background-color: #28a745;
		border-color: #28a745;
	}

	.btn-success:hover:not(:disabled) {
		background-color: #218838;
		border-color: #218838;
	}

	.btn-secondary {
		background-color: #6c757d;
		border-color: #6c757d;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #5a6268;
		border-color: #545b62;
	}

	.btn-separator {
		display: inline-block;
		width: 1rem;
	}

	.end-phase-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 2px solid #e6e6e6;
	}

	.end-phase-controls {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.ready-status {
		background-color: #f8f9fa;
		border-radius: 8px;
		padding: 1.5rem;
		margin-top: 1rem;
	}

	.ready-label {
		font-weight: 600;
		margin-bottom: 0.5rem;
		font-size: 1rem;
	}

	.ready-count {
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
		color: #333;
	}

	.ready-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
	}

	.ready-list li {
		padding: 0.25rem 0;
		color: #28a745;
		font-weight: 500;
	}

	.all-ready-message {
		margin-top: 1rem;
		padding: 0.75rem;
		background-color: #d4edda;
		border: 1px solid #c3e6cb;
		border-radius: 4px;
		color: #155724;
		font-weight: 500;
		text-align: center;
	}

	.waiting-message {
		margin-top: 1rem;
		padding: 0.75rem;
		background-color: #fff3cd;
		border: 1px solid #ffeaa7;
		border-radius: 4px;
		color: #856404;
		text-align: center;
	}
</style>
