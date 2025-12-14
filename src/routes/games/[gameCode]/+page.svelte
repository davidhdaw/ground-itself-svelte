<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { getAuthContext } from '$lib/auth/context';
	import { enhance } from '$app/forms';
	import { createClient } from '$lib/supabase/client';
	import WaitingRoom from '$lib/components/WaitingRoom.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import type { PageData, ActionData } from './$types';

	const auth = getAuthContext();

	let { data, form } = $props<{ data: PageData; form?: ActionData }>();

	const gameCode = $derived($page.params.gameCode);
	const wasKicked = $derived($page.url.searchParams.get('kicked') === 'true');

	let displayName = $state('');

	// Reactive game state (initialized from server data, updated via real-time)
	let gameState = $state<PageData['game'] | null>(null);
	let playersState = $state<PageData['players']>([]);
	let playerIdFromCookie = $state<string | null>(null);
	let wasAPlayer = $state(data.isPlayer || false);

	// Initialize and sync state with server data
	$effect(() => {
		if (data.game) {
			gameState = data.game;
		}
		if (data.players) {
			playersState = data.players;
		}
		if (data.playerId) {
			playerIdFromCookie = data.playerId;
		}
	});

	// Derived values
	const isCreator = $derived(
		gameState && auth.user
			? auth.user.id === (gameState as NonNullable<PageData['game']>).created_by
			: false
	);
	const currentPlayer = $derived(
		playersState.find((p: PageData['players'][number]) =>
			auth.user ? p.user_id === auth.user.id : p.id === playerIdFromCookie
		)
	);
	const isPlayer = $derived(currentPlayer !== undefined);

	// Track if we were a player (for detecting kicks)
	$effect(() => {
		if (isPlayer) {
			wasAPlayer = true;
		}
	});
	const isActive = $derived(
		gameState ? (gameState as NonNullable<PageData['game']>).current_phase < 4 : false
	);

	// Set up real-time subscriptions
	$effect(() => {
		if (!browser || !gameState) return;

		const supabase = createClient();
		const gameId = (gameState as NonNullable<PageData['game']>).id;

		// Subscribe to game changes
		const gameChannel = supabase
			.channel(`game:${gameId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'games',
					filter: `id=eq.${gameId}`
				},
				(payload) => {
					if (payload.eventType === 'UPDATE' && payload.new) {
						// Update gameState with the new data, preserving reactivity
						gameState = { ...payload.new } as PageData['game'];
					} else if (payload.eventType === 'INSERT' && payload.new) {
						// Handle insert (shouldn't happen for existing game, but just in case)
						gameState = { ...payload.new } as PageData['game'];
					}
				}
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					console.log('Subscribed to game changes');
				} else if (status === 'CHANNEL_ERROR') {
					console.error('Error subscribing to game changes');
				}
			});

		// Subscribe to player changes
		const playersChannel = supabase
			.channel(`players:${gameId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'players',
					filter: `game_id=eq.${gameId}`
				},
				async () => {
					// Refetch players when changes occur
					const { data: players } = await supabase
						.from('players')
						.select('id, display_name, user_id, turn_order')
						.eq('game_id', gameId)
						.order('turn_order', { ascending: true });
					if (players) {
						playersState = players as PageData['players'];

						// Update playerIdFromCookie from cookie if we're anonymous
						if (!auth.user && browser && gameState) {
							const cookieName = `player_${gameState.id}`;
							const cookies = document.cookie.split(';');
							for (const cookie of cookies) {
								const [name, value] = cookie.trim().split('=');
								if (name === cookieName && value) {
									// Verify this player exists in the players list
									if (players.some((p) => p.id === value)) {
										playerIdFromCookie = value;
										wasAPlayer = true;
									}
								}
							}
						}

						// Check if current player was kicked (only if they were previously a player)
						const stillAPlayer = auth.user
							? players.some((p) => p.user_id === auth.user.id)
							: players.some((p) => p.id === playerIdFromCookie);

						if (!stillAPlayer && wasAPlayer) {
							// Player was kicked - redirect to show kicked message
							wasAPlayer = false;
							window.location.href = `/games/${gameCode}?kicked=true`;
						}
					}
				}
			)
			.subscribe();

		// Cleanup subscriptions on unmount
		return () => {
			gameChannel.unsubscribe();
			playersChannel.unsubscribe();
		};
	});
</script>

<div class="game-room-container">
	{#if !gameState}
		<p>Loading game...</p>
	{:else if !isActive}
		<h1>Game Ended</h1>
		<p>This game has already ended.</p>
	{:else if wasKicked}
		<!-- Kicked player message -->
		<div class="kicked-message">
			<h1>You've been removed from the game</h1>
			<p>You were kicked from "{gameState?.title || 'this game'}" by the game creator.</p>
			<a href="/games/join" class="btn btn-primary">Join a Different Game</a>
		</div>
	{:else if !isPlayer}
		<!-- Join form for non-players -->
		<div class="join-prompt">
			<h1>Join Game</h1>
			<p class="game-title">"{(gameState as NonNullable).title}"</p>
			<p class="game-code">Game Code: {gameCode}</p>

			{#if form?.error}
				<div class="error-message">{form.error}</div>
			{/if}

			<form method="POST" action="?/join" use:enhance>
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

				<button type="submit" class="join-button" disabled={!displayName.trim()}>
					Join Game
				</button>
			</form>
		</div>
	{:else if gameState && isPlayer}
		<!-- Game room for players -->
		<GameHeader game={gameState} />
		<WaitingRoom
			game={gameState}
			players={playersState}
			user={data.user}
			playerId={data.playerId}
			{form} />
	{/if}
</div>

<style>
	.game-room-container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
	}

	.join-prompt {
		text-align: center;
	}

	.join-prompt h1 {
		margin-bottom: 1rem;
	}

	.game-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #333;
		margin: 1rem 0;
	}

	.game-code {
		font-size: 1.1rem;
		color: #666;
		margin-bottom: 2rem;
		font-family: monospace;
		letter-spacing: 0.1em;
	}

	.form-group {
		margin-bottom: 1.5rem;
		text-align: left;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 1rem;
	}

	.name-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.name-input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
	}

	.name-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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

	.join-button:hover:not(:disabled) {
		background-color: #0056b3;
	}

	.join-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.kicked-message {
		text-align: center;
		padding: 3rem 2rem;
	}

	.kicked-message h1 {
		color: #dc3545;
		margin-bottom: 1rem;
	}

	.kicked-message p {
		font-size: 1.1rem;
		color: #666;
		margin-bottom: 2rem;
	}

	.kicked-message .btn {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		text-decoration: none;
		border-radius: 4px;
	}
</style>
