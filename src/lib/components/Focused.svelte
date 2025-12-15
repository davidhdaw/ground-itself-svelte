<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from '../../routes/games/[gameCode]/$types';

	let { game, form } = $props<{
		game: PageData['game'];
		form?: ActionData;
	}>();

	const focusedSituations = [
		{
			id: 'story',
			name: 'Tell a story',
			description: 'Share a story about something that happened in this place'
		},
		{
			id: 'party',
			name: 'Throw a party',
			description: 'Describe a celebration or gathering that occurs here'
		},
		{
			id: 'discover',
			name: 'Discover something',
			description: 'Reveal something new or hidden about this place'
		},
		{
			id: 'omen',
			name: 'See an omen',
			description: 'Describe a sign or portent that appears'
		},
		{
			id: 'leave',
			name: 'Leave the frame',
			description: 'Move the focus away from this place temporarily'
		}
	];
</script>

<div class="focused">
	<h2 class="focused-header">Focused Situation</h2>

	<div class="instructions">
		<p>
			Instead of answering a prompt, you can enter a focused situation. Choose one of the following
			types and explore it with the group:
		</p>
	</div>

	<div class="situations-grid">
		{#each focusedSituations as situation}
			<div class="situation-card">
				<h3 class="situation-name">{situation.name}</h3>
				<p class="situation-description">{situation.description}</p>
			</div>
		{/each}
	</div>

	<div class="exit-section">
		<p class="exit-instruction">
			When you're ready to return to normal card drawing, click the button below:
		</p>
		<form method="POST" action="?/exitFocused" use:enhance>
			<button type="submit" class="btn btn-primary">Return to Card Drawing</button>
		</form>
	</div>

	{#if form?.error}
		<div class="error-message">{form.error}</div>
	{/if}
</div>

<style>
	.focused {
		width: 80%;
		max-width: 1440px;
		font-family: 'Merriweather', serif;
		font-size: 1.2rem;
		margin: 2rem auto;
		padding: 2rem;
	}

	.focused-header {
		text-align: center;
		margin-bottom: 2rem;
		font-size: 2.5rem;
		color: #007bff;
	}

	.instructions {
		text-align: center;
		margin-bottom: 2rem;
		padding: 1.5rem;
		background-color: #e7f3ff;
		border-radius: 8px;
		border: 2px solid #007bff;
	}

	.instructions p {
		font-size: 1.2rem;
		color: #004085;
		margin: 0;
		line-height: 1.6;
	}

	.situations-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin: 2rem 0;
	}

	.situation-card {
		background-color: white;
		border: 2px solid #007bff;
		border-radius: 8px;
		padding: 1.5rem;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.situation-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 123, 255, 0.2);
	}

	.situation-name {
		font-size: 1.3rem;
		font-weight: 600;
		color: #007bff;
		margin: 0 0 0.75rem 0;
	}

	.situation-description {
		font-size: 1rem;
		color: #666;
		margin: 0;
		line-height: 1.5;
	}

	.exit-section {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 2px solid #e6e6e6;
		text-align: center;
	}

	.exit-instruction {
		font-size: 1.1rem;
		color: #666;
		margin-bottom: 1.5rem;
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

	.btn-primary {
		background-color: #007bff;
		border-color: #007bff;
		padding: 1rem 2rem;
		font-size: 1.2rem;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #0056b3;
		border-color: #0056b3;
	}
</style>
