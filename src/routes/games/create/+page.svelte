<script lang="ts">
	import { getAuthContext } from '$lib/auth/context';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	const auth = getAuthContext();

	let redirected = $state(false);
	let gameTitle = $state('');
	let { data } = $props<{ data: PageData }>();

	onMount(() => {
		const checkAuth = () => {
			if (redirected) return;
			if (!auth.loading && !auth.user) {
				redirected = true;
				goto('/auth/login');
			}
		};

		checkAuth();

		const interval = setInterval(checkAuth, 100);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<div class="create-game-container">
	<h1>Create New Game</h1>

	{#if auth.loading}
		<p>Loading...</p>
	{:else if !auth.user}
		<p>Redirecting to login...</p>
	{:else}
		<div class="create-game-content">
			<p>Welcome, {auth.user.email}!</p>
			<p>Ready to start a new game of Ground Itself?</p>

			{#if data?.form?.error}
				<div class="error-message">{data.form.error}</div>
			{/if}

			<form method="POST" use:enhance>
				<div class="form-group">
					<label for="game-title">Game Title</label>
					<input
						type="text"
						id="game-title"
						name="title"
						bind:value={gameTitle}
						placeholder="e.g., 'The Mysterious Forest' or 'City of Dreams'"
						required
						maxlength="100"
						class="title-input" />
					<p class="help-text">Give your game a memorable title so players can identify it</p>
				</div>

				<button type="submit" class="create-button">Create Game</button>
			</form>

			<div class="info-section">
				<h2>How it works:</h2>
				<ul>
					<li>You'll create a game with a title and get a unique game code</li>
					<li>Share the code with other players to join</li>
					<li>
						Players can see the game title when joining to make sure they're in the right game
					</li>
					<li>Players can join anonymously with just a display name</li>
					<li>Once everyone is ready, you'll start the game</li>
				</ul>
			</div>

			<div class="links">
				<p>
					Want to join an existing game instead? <a href="/games/join">Join Game</a>
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.create-game-container {
		max-width: 600px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.create-game-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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

	.title-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.title-input:focus {
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

	.create-button {
		width: 100%;
		padding: 1rem 2rem;
		font-size: 1.2rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.create-button:hover {
		background-color: #0056b3;
	}

	.create-button:disabled {
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
