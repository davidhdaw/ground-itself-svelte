<script lang="ts">
	import { getAuthContext } from '$lib/auth/context';
	import { goto } from '$app/navigation';

	const auth = getAuthContext();

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);
	let success = $state(false);

	const handleSubmit = async () => {
		error = null;
		success = false;

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		loading = true;

		try {
			await auth.signUp(email, password);

			// Wait a moment for auth state to update
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Check if user was automatically logged in
			if (auth.user) {
				// Auto-login happened, redirect to game creation
				await goto('/games/create');
				return;
			}

			// Otherwise, show success message (email confirmation required)
			success = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to sign up';
		} finally {
			loading = false;
		}
	};
</script>

<div class="auth-container">
	<h1>Sign Up</h1>

	{#if success && !auth.user}
		<div class="success">
			<p>Account created successfully!</p>
			<p>Please check your email to confirm your account.</p>
			<a href="/auth/login">Go to sign in</a>
		</div>
	{:else}
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
					autocomplete="new-password"
					minlength="6" />
			</div>

			<div class="form-group">
				<label for="confirmPassword">Confirm Password</label>
				<input
					type="password"
					id="confirmPassword"
					bind:value={confirmPassword}
					required
					disabled={loading}
					autocomplete="new-password"
					minlength="6" />
			</div>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<button type="submit" disabled={loading}>
				{loading ? 'Creating account...' : 'Sign Up'}
			</button>
		</form>

		<p class="auth-link">
			Already have an account? <a href="/auth/login">Sign in</a>
		</p>
	{/if}
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

	.success {
		text-align: center;
		padding: 1rem;
		background-color: #d4edda;
		border: 1px solid #c3e6cb;
		border-radius: 4px;
		color: #155724;
	}

	.success a {
		display: inline-block;
		margin-top: 1rem;
		color: #007bff;
		text-decoration: none;
	}

	.success a:hover {
		text-decoration: underline;
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
