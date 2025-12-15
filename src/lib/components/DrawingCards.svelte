<script lang="ts">
	import { enhance } from '$app/forms';
	import PromptDisplay from './PromptDisplay.svelte';
	import TenAlert from './TenAlert.svelte';
	import Focused from './Focused.svelte';
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
	const isMyTurn = $derived(currentPlayer && currentPlayer.id === game.current_turn_player_id);

	// Filter turns to only numbered card prompts (drawing cards phase)
	const numberedCardTurns = $derived(
		turns
			.filter((turn: Turn) => turn.card_number !== null)
			.sort((a: Turn, b: Turn) => {
				const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
				const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
				return aTime - bTime;
			})
	);

	const currentPrompt = $derived(
		numberedCardTurns.length > 0 ? numberedCardTurns[numberedCardTurns.length - 1] : null
	);
	const previousPrompt = $derived(
		numberedCardTurns.length > 1 ? numberedCardTurns[numberedCardTurns.length - 2] : null
	);

	// Calculate cycle info
	const currentCycle = $derived(game.cycle || 1);
	const isCycleEnd = $derived(game.ten_flag || false);
	const isFocused = $derived(game.focused_flag || false);

	// Check if the current player just drew the most recent card
	// This happens when last_turn_player_id matches current player and it's still their turn
	// (turn hasn't rotated yet because they need to choose focused situation or continue)
	const isMyCard = $derived(
		currentPrompt && currentPlayer && game.last_turn_player_id === currentPlayer.id && isMyTurn
	);
</script>

<div class="drawing-cards">
	<h2 class="phase-header">Cycle {currentCycle}</h2>

	{#if isCycleEnd}
		<TenAlert {game} {players} {user} {form} />
	{:else if isFocused}
		<Focused {game} {form} />
	{:else}
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
				<p class="turn-label">Turn not initialized</p>
			{/if}
		</div>

		{#if form?.error}
			<div class="error-message">{form.error}</div>
		{/if}

		{#if isMyTurn}
			{#if isMyCard}
				<!-- Player just drew a card - show option to enter focused situation -->
				<div class="card-actions">
					<p class="action-instruction">You drew a card. Choose what to do:</p>
					<div class="action-buttons">
						<form method="POST" action="?/enterFocused" use:enhance>
							<button type="submit" class="btn btn-secondary"> Enter Focused Situation </button>
						</form>
						<form method="POST" action="?/continueTurn" use:enhance>
							<button type="submit" class="btn btn-primary"> Continue Turn </button>
						</form>
					</div>
				</div>
			{:else}
				<!-- Player's turn but no card drawn yet -->
				<form method="POST" action="?/drawNumberedCard" use:enhance>
					<button type="submit" class="btn btn-primary">
						{currentPrompt ? 'Draw Next Card' : 'Draw First Card'}
					</button>
				</form>
			{/if}
		{:else if !isMyTurn}
			<div class="waiting-turn">
				<p>
					Waiting for {currentTurnPlayer?.display_name || 'another player'} to draw the next card...
				</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.drawing-cards {
		width: 80%;
		max-width: 1440px;
		font-family: 'Merriweather', serif;
		font-size: 1.2rem;
		margin: 2rem auto;
		padding: 2rem;
	}

	.phase-header {
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
		display: block;
		margin-left: auto;
		margin-right: auto;
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

	.btn-secondary {
		background-color: #6c757d;
		border-color: #6c757d;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #5a6268;
		border-color: #545b62;
	}

	.card-actions {
		margin-top: 2rem;
		padding: 2rem;
		background-color: #f8f9fa;
		border-radius: 8px;
		border: 2px solid #e6e6e6;
		text-align: center;
	}

	.action-instruction {
		font-size: 1.2rem;
		color: #333;
		margin-bottom: 1.5rem;
		font-weight: 500;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}
</style>
