<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form } = $props<{ form?: ActionData }>();

	let gameCode = $state('');
	let displayName = $state('');

	// Convert game code to uppercase and filter invalid characters
	$effect(() => {
		if (gameCode) {
			const upperCode = gameCode
				.toUpperCase()
				.replace(/[^A-Z0-9]/g, '')
				.slice(0, 6);
			if (upperCode !== gameCode) {
				gameCode = upperCode;
			}
		}
	});
</script>

<div class="join-container">
	<h1>Join a Game</h1>

	{#if form?.error}
		<div class="error-message">{form.error}</div>
	{/if}

	<form method="POST" use:enhance>
		<div class="form-group">
			<label for="code">Game Code</label>
			<input
				type="text"
				id="code"
				name="code"
				bind:value={gameCode}
				placeholder="Enter 6-character game code"
				required
				maxlength="6"
				class="code-input" />
			<p class="help-text">Enter the 6-character code shared by the game creator</p>
		</div>

		<div class="form-group">
			<label for="displayName">Display Name</label>
			<input
				type="text"
				id="displayName"
				name="displayName"
				bind:value={displayName}
				placeholder="Enter your display name"
				required
				maxlength="50"
				class="name-input" />
			<p class="help-text">This is how other players will see you in the game</p>
		</div>

		<button type="submit" class="join-button">Join Game</button>
	</form>

	<div class="info-section">
		<h2>How to join:</h2>
		<ul>
			<li>Get the 6-character game code from the game creator</li>
			<li>Enter your display name (this can be anything you want)</li>
			<li>You don't need an account to join - anyone can play!</li>
			<li>Once you join, you'll be taken to the game room</li>
		</ul>
	</div>

	<div class="links">
		<p>
			Want to create a game instead? <a href="/games/create">Create Game</a>
		</p>
	</div>
</div>

<style>
	.join-container {
		max-width: 600px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 1rem;
	}

	.code-input,
	.name-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
		font-family: monospace;
		letter-spacing: 0.1em;
	}

	.code-input {
		font-size: 1.2rem;
		text-align: center;
	}

	.code-input:focus,
	.name-input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
	}

	.help-text {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 0;
	}

	.error-message {
		padding: 1rem;
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.join-button {
		width: 100%;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-top: 1rem;
	}

	.join-button:hover {
		background-color: #0056b3;
	}

	.join-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.info-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background-color: #f8f9fa;
		border-radius: 8px;
	}

	.info-section h2 {
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1.2rem;
	}

	.info-section ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	.info-section li {
		margin-bottom: 0.5rem;
	}

	.links {
		margin-top: 1.5rem;
		text-align: center;
	}

	.links a {
		color: #007bff;
		text-decoration: none;
	}

	.links a:hover {
		text-decoration: underline;
	}
</style>
