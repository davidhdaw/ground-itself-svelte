<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from '../../routes/games/[gameCode]/$types';

	type Player = PageData['players'][number];

	let { game, players, user, form } = $props<{
		game: PageData['game'];
		players: PageData['players'];
		user: PageData['user'];
		form?: ActionData;
	}>();

	const currentPlayer = $derived(
		user ? players.find((p: Player) => p.user_id === user.id) : undefined
	);

	const isCycleEndPlayer = $derived(currentPlayer && game.last_turn_player_id === currentPlayer.id);

	const cycleEndPlayerName = $derived(
		players.find((p: Player) => p.id === game.last_turn_player_id)?.display_name || 'A player'
	);

	const currentCycle = $derived(game.cycle || 1);
	// When card 10 is drawn, cycle increments, so we need to show the cycle that's ending
	const endingCycle = $derived(currentCycle > 1 ? currentCycle - 1 : 1);
	const roll = $derived(game.roll || null);
	const playLength = $derived(game.play_length || null);
	const selectedTens = $derived((game.selected_tens || []) as string[]);

	// Check if cycle-end question has been selected
	const questionSelected = $derived(selectedTens.length > 0);
	const lastSelectedQuestion = $derived(
		selectedTens.length > 0 ? selectedTens[selectedTens.length - 1] : null
	);

	// Check if we're in transition questions phase (after question selected)
	const inTransitionPhase = $derived(questionSelected);

	// Check if cycle 4 is complete (currentCycle will be 5 when cycle 4 ends)
	const isFinalCycle = $derived(endingCycle >= 4);

	const cycleEndQuestions = [
		{ id: 'gardens', text: "The 'gardens' are planted..." },
		{ id: 'victory', text: 'There is a great victory...' },
		{ id: 'loss', text: "There's a great loss..." },
		{ id: 'death', text: 'Someone important dies...' },
		{ id: 'resting', text: 'It is a resting day...' }
	];

	const transitionQuestions = [
		'How has the place changed?',
		'What remains the same?',
		'What new things have appeared?'
	];
</script>

<div class="ten-alert">
	<h2 class="alert-header">Cycle {endingCycle} End</h2>

	{#if !questionSelected}
		<!-- Phase 1: Select cycle-end question -->
		<div class="question-selection">
			<p class="instructions">
				{#if isCycleEndPlayer}
					You drew card 10! Select one cycle-end question for the group to answer:
				{:else}
					{cycleEndPlayerName} drew card 10! Waiting for them to select a cycle-end question...
				{/if}
			</p>

			{#if isCycleEndPlayer}
				<div class="questions-grid">
					{#each cycleEndQuestions as question}
						<form method="POST" action="?/selectCycleEndQuestion" use:enhance>
							<input type="hidden" name="question" value={question.id} />
							<button type="submit" class="question-btn">{question.text}</button>
						</form>
					{/each}
				</div>
			{:else}
				<div class="waiting-message">
					<p>Waiting for the player who ended the cycle to select a question...</p>
				</div>
			{/if}
		</div>
	{:else if inTransitionPhase && !isFinalCycle}
		<!-- Phase 2: Time advancement and transition questions -->
		<div class="transition-phase">
			<div class="selected-question">
				<h3>Selected Question:</h3>
				<p class="question-text">
					{cycleEndQuestions.find((q) => q.id === lastSelectedQuestion)?.text ||
						lastSelectedQuestion}
				</p>
				<p class="group-instruction">The group should discuss and answer this question together.</p>
			</div>

			{#if roll && playLength}
				<div class="time-advancement">
					<h3>Time Advances</h3>
					<p class="time-display">
						{roll}
						{playLength.toLowerCase()}
					</p>
					<p class="time-instruction">Time has passed. The place has changed during this period.</p>
				</div>
			{/if}

			<div class="transition-questions">
				<h3>Transition Questions</h3>
				<p class="instructions">
					Answer these questions together as a group to transition to the next cycle:
				</p>
				<ul class="questions-list">
					{#each transitionQuestions as question}
						<li>{question}</li>
					{/each}
				</ul>
			</div>

			<div class="continue-section">
				<form method="POST" action="?/continueCycle" use:enhance>
					<button type="submit" class="btn btn-success">
						Continue to Cycle {currentCycle}
					</button>
				</form>
			</div>
		</div>
	{:else if isFinalCycle}
		<!-- Final cycle - transition to end game -->
		<div class="final-cycle">
			<div class="selected-question">
				<h3>Selected Question:</h3>
				<p class="question-text">
					{cycleEndQuestions.find((q) => q.id === lastSelectedQuestion)?.text ||
						lastSelectedQuestion}
				</p>
				<p class="group-instruction">The group should discuss and answer this question together.</p>
			</div>

			{#if roll && playLength}
				<div class="time-advancement">
					<h3>Time Advances</h3>
					<p class="time-display">
						{roll}
						{playLength.toLowerCase()}
					</p>
				</div>
			{/if}

			<div class="transition-questions">
				<h3>Final Transition Questions</h3>
				<p class="instructions">Answer these final questions together as a group:</p>
				<ul class="questions-list">
					{#each transitionQuestions as question}
						<li>{question}</li>
					{/each}
				</ul>
			</div>

			<div class="continue-section">
				<form method="POST" action="?/continueCycle" use:enhance>
					<button type="submit" class="btn btn-success"> End Game </button>
				</form>
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div class="error-message">{form.error}</div>
	{/if}
</div>

<style>
	.ten-alert {
		width: 80%;
		max-width: 1440px;
		font-family: 'Merriweather', serif;
		font-size: 1.2rem;
		margin: 2rem auto;
		padding: 2rem;
	}

	.alert-header {
		text-align: center;
		margin-bottom: 2rem;
		font-size: 2.5rem;
		color: #dc3545;
	}

	.question-selection {
		margin-top: 2rem;
	}

	.instructions {
		text-align: center;
		margin-bottom: 2rem;
		font-size: 1.2rem;
		color: #333;
	}

	.questions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
		margin-top: 2rem;
	}

	.question-btn {
		padding: 1.5rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1.1rem;
		cursor: pointer;
		transition: background-color 0.2s;
		text-align: center;
		font-family: 'Merriweather', serif;
	}

	.question-btn:hover {
		background-color: #0056b3;
	}

	.waiting-message {
		text-align: center;
		padding: 2rem;
		background-color: #fff3cd;
		border-radius: 8px;
		border: 2px solid #ffc107;
		margin-top: 2rem;
	}

	.waiting-message p {
		font-size: 1.2rem;
		color: #856404;
		margin: 0;
	}

	.transition-phase,
	.final-cycle {
		margin-top: 2rem;
	}

	.selected-question {
		background-color: #e7f3ff;
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 2rem;
		border: 2px solid #007bff;
	}

	.selected-question h3 {
		margin-top: 0;
		color: #004085;
	}

	.question-text {
		font-size: 1.5rem;
		font-weight: 600;
		color: #004085;
		margin: 1rem 0;
	}

	.group-instruction {
		color: #666;
		font-style: italic;
		margin-top: 1rem;
	}

	.time-advancement {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 2rem;
		text-align: center;
		color: white;
	}

	.time-advancement h3 {
		margin-top: 0;
		color: white;
	}

	.time-display {
		font-size: 3rem;
		font-weight: 700;
		margin: 1rem 0;
	}

	.time-instruction {
		font-size: 1.1rem;
		opacity: 0.9;
		margin-top: 1rem;
	}

	.transition-questions {
		background-color: #f8f9fa;
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.transition-questions h3 {
		margin-top: 0;
		color: #333;
	}

	.questions-list {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0 0;
	}

	.questions-list li {
		padding: 1rem;
		margin-bottom: 0.5rem;
		background-color: white;
		border-radius: 4px;
		border-left: 4px solid #007bff;
		font-size: 1.1rem;
	}

	.continue-section {
		text-align: center;
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 2px solid #e6e6e6;
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

	.btn-success {
		background-color: #28a745;
		border-color: #28a745;
		padding: 1rem 2rem;
		font-size: 1.2rem;
	}

	.btn-success:hover:not(:disabled) {
		background-color: #218838;
		border-color: #218838;
	}
</style>
