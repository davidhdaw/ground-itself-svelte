<script lang="ts">
	import { getAuthContext } from '$lib/auth/context';
	import { goto } from '$app/navigation';

	const auth = getAuthContext();

	const handleSignOut = async () => {
		try {
			await auth.signOut();
			await goto('/auth/login');
		} catch (error) {
			console.error('Error signing out:', error);
		}
	};
</script>

<header class="header">
	<div class="header-content">
		<div class="logo">
			<a href="/" data-sveltekit-preload-data="hover">The Ground Itself</a>
		</div>

		{#if !auth.loading && auth.user}
			<div class="user-section">
				<span class="user-email">{auth.user.email}</span>
				<button class="logout-button" onclick={handleSignOut}>Log Out</button>
			</div>
		{/if}
	</div>
</header>

<style>
	.header {
		background-color: #fff;
		border-bottom: 1px solid #e0e0e0;
		padding: 0;
		position: sticky;
		top: 0;
		z-index: 100;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.logo a {
		font-size: 1.5rem;
		font-weight: 600;
		color: #333;
		text-decoration: none;
		transition: color 0.2s;
	}

	.logo a:hover {
		color: #007bff;
	}

	.user-section {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-email {
		color: #666;
		font-size: 0.9rem;
	}

	.logout-button {
		padding: 0.5rem 1rem;
		background-color: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.logout-button:hover {
		background-color: #5a6268;
	}

	.logout-button:active {
		background-color: #545b62;
	}

	@media (max-width: 768px) {
		.header-content {
			padding: 1rem;
		}

		.user-section {
			flex-direction: column;
			gap: 0.5rem;
			align-items: flex-end;
		}

		.user-email {
			font-size: 0.85rem;
		}

		.logout-button {
			padding: 0.4rem 0.8rem;
			font-size: 0.85rem;
		}
	}
</style>
