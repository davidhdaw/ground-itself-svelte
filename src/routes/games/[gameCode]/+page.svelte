<script lang="ts">
	import { page } from '$app/stores';
	import { getAuthContext } from '$lib/auth/context';
	import type { PageData } from './$types';

	const auth = getAuthContext();

	let { data } = $props<{ data: PageData }>();

	const gameCode = $derived($page.params.gameCode);
</script>

<div class="game-room-container">
	<h1>Game Room</h1>
	{#if data.game}
		<p>Game Code: {gameCode}</p>
		<p>Game Title: {data.game.title}</p>
	{:else if data.error}
		<p class="error">Error: {data.error}</p>
	{:else}
		<p>Loading game...</p>
	{/if}
	<p>Game room will be implemented in Phase 5!</p>
	{#if auth.user}
		<p>Logged in as: {auth.user.email}</p>
	{/if}
</div>

<style>
	.game-room-container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
		text-align: center;
	}

	.error {
		color: #dc3545;
		margin-top: 0.5rem;
		padding: 0.5rem;
		background-color: #f8d7da;
		border-radius: 4px;
	}
</style>
