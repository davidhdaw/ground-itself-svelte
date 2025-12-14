<script lang="ts">
	import { getAuthContext } from '$lib/auth/context';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const auth = getAuthContext();

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	// Redirect if already logged in
	onMount(() => {
		const checkAuth = () => {
			if (!auth.loading && auth.user) {
				goto('/games/create');
			}
		};

		checkAuth();
		const interval = setInterval(checkAuth, 100);

		return () => {
			clearInterval(interval);
		};
	});

	const handleSubmit = async () => {
		error = null;
		loading = true;

		try {
			await auth.signIn(email, password);
			// Redirect to game creation page
			await goto('/games/create');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sign in';
		} finally {
			loading = false;
		}
	};
</script>

<div class="auth-container">
	<h1>Sign In</h1>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}>
		<div class="form-group">
			<label for="email">Email</label>
			<input
				type="email"
				id="email"
				bind:value={email}
				required
				disabled={loading}
				autocomplete="email" />
		</div>

		<div class="form-group">
			<label for="password">Password</label>
			<input
				type="password"
				id="password"
				bind:value={password}
				required
				disabled={loading}
				autocomplete="current-password" />
		</div>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Signing in...' : 'Sign In'}
		</button>
	</form>

	<p class="auth-link">
		Don't have an account? <a href="/auth/signup">Sign up</a>
	</p>
</div>

<style>
	.auth-container {
		max-width: 400px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		margin-top: 1rem;
	}

	button:hover:not(:disabled) {
		background-color: #0056b3;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #dc3545;
		margin-top: 0.5rem;
		padding: 0.5rem;
		background-color: #f8d7da;
		border-radius: 4px;
	}

	.auth-link {
		margin-top: 1.5rem;
		text-align: center;
	}

	.auth-link a {
		color: #007bff;
		text-decoration: none;
	}

	.auth-link a:hover {
		text-decoration: underline;
	}
</style>
