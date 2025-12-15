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

	const isCreator = $derived(user?.id === game.created_by);
	const currentPlayer = $derived(
		user ? players.find((p: Player) => p.user_id === user.id) : undefined
	);

	const initialLocation = $derived(game.location || '');
	let locationInput = $state('');
	let isEditingLocation = $state(false);
	let isSubmitting = $state(false);
	let showLocationForm = $state(false);
	let playerToKick = $state<Player | null>(null);

	// Initialize locationInput from game.location
	$effect(() => {
		if (!locationInput && initialLocation) {
			locationInput = initialLocation;
		}
	});

	// Sync locationInput with game.location when it changes (but don't overwrite while editing)
	$effect(() => {
		const currentLocation = game.location || '';
		// Only sync if user is not actively editing and not submitting
		if (!isEditingLocation && !isSubmitting && currentLocation !== locationInput) {
			locationInput = currentLocation;
		}
		// Show form if no location is set
		if (!currentLocation && isCreator) {
			showLocationForm = true;
		}
	});

	const confirmedPlayerIds = $derived(game.confirmed_player_ids || []);
	const allPlayersConfirmed = $derived(
		players.length > 0 && players.every((p: Player) => confirmedPlayerIds.includes(p.id))
	);
	const isCurrentPlayerConfirmed = $derived(
		currentPlayer ? confirmedPlayerIds.includes(currentPlayer.id) : false
	);
	const canStartGame = $derived(
		isCreator &&
			game.location &&
			game.location.trim().length > 0 &&
			players.length >= 2 &&
			allPlayersConfirmed
	);

	// Form submission handler to ensure value is preserved
	function handleSetLocationSubmit({ formElement }: { formElement: HTMLFormElement }) {
		return async ({ update }: { update: (options?: { reset: boolean }) => Promise<void> }) => {
			isSubmitting = true;
			// Ensure the input value is set before submission
			const input = formElement.querySelector<HTMLInputElement>('input[name="location"]');
			if (input && input.value !== locationInput) {
				input.value = locationInput;
			}
			await update();
			isSubmitting = false;
			isEditingLocation = false;
			showLocationForm = false;
		};
	}

	function toggleLocationForm() {
		showLocationForm = !showLocationForm;
		if (showLocationForm) {
			isEditingLocation = true;
		}
	}

	function confirmKickPlayer(player: Player) {
		playerToKick = player;
	}

	function cancelKickPlayer() {
		playerToKick = null;
	}

	function handleKickPlayerSubmit({ formElement }: { formElement: HTMLFormElement }) {
		return async ({ update }: { update: (options?: { reset: boolean }) => Promise<void> }) => {
			await update();
			playerToKick = null;
		};
	}
</script>

<div class="waiting-room">
	<h1>Waiting Room</h1>

	{#if (game.location && game.location.trim().length > 0) || !isCreator}
		<div class="proposed-location">
			{#if game.location && game.location.trim().length > 0}
				<p class="proposed-location-label">Proposed Location:</p>
				<p class="proposed-location-value">"{game.location}"</p>
				{#if !isCreator && currentPlayer}
					{#if !isCurrentPlayerConfirmed}
						<form
							method="POST"
							action="?/confirmLocation"
							use:enhance
							class="confirm-location-form">
							<button type="submit" class="btn btn-primary btn-confirm">Confirm Location</button>
						</form>
					{:else}
						<form
							method="POST"
							action="?/unconfirmLocation"
							use:enhance
							class="confirm-location-form">
							<button type="submit" class="btn btn-secondary btn-confirm"
								>Unconfirm Location</button>
						</form>
					{/if}
				{/if}
			{:else}
				<p class="proposed-location-label">Proposed Location:</p>
				<p class="proposed-location-value awaiting">Awaiting location</p>
			{/if}
		</div>
	{/if}

	<div class="players-section">
		<h2>Players ({players.length})</h2>
		<div class="players-list">
			{#each players as player}
				<div class="player-item">
					<div class="player-name-section">
						{#if confirmedPlayerIds.includes(player.id)}
							<span class="badge confirmed">✓</span>
						{/if}
						<span class="player-name">{player.display_name}</span>
					</div>
					<div class="player-badges">
						{#if player.user_id === game.created_by}
							<span class="badge creator">Creator</span>
						{/if}
					</div>
					{#if isCreator && player.user_id !== game.created_by}
						<button
							type="button"
							class="btn-kick"
							title="Kick player"
							onclick={() => confirmKickPlayer(player)}>
							×
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if form?.error}
		<div class="error-message">{form.error}</div>
	{/if}

	{#if playerToKick}
		<div class="modal-overlay" onclick={cancelKickPlayer}>
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<h3>Kick Player</h3>
				<p>
					Are you sure you want to kick <strong>{playerToKick.display_name}</strong> from the game?
				</p>
				<p class="modal-warning">This action cannot be undone.</p>
				<div class="modal-actions">
					<form method="POST" action="?/kickPlayer" use:enhance={handleKickPlayerSubmit}>
						<input type="hidden" name="playerId" value={playerToKick.id} />
						<button type="submit" class="btn btn-danger">Kick Player</button>
					</form>
					<button type="button" class="btn btn-secondary" onclick={cancelKickPlayer}>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if isCreator}
		<div class="creator-section">
			<h2>Game Creator Controls</h2>

			<div class="location-section">
				{#if game.location && game.location.trim().length > 0 && !showLocationForm}
					<div class="location-controls">
						<button type="button" class="btn btn-secondary" onclick={toggleLocationForm}>
							Change Location
						</button>
					</div>
				{:else}
					<h3>
						{game.location && game.location.trim().length > 0 ? 'Change Location' : 'Set Location'}
					</h3>
					<form method="POST" action="?/setLocation" use:enhance={handleSetLocationSubmit}>
						<div class="form-group">
							<label for="location">Location</label>
							<input
								type="text"
								id="location"
								name="location"
								bind:value={locationInput}
								onfocus={() => (isEditingLocation = true)}
								onblur={() => {
									// Delay resetting isEditingLocation to allow form submission to complete
									setTimeout(() => {
										if (!isSubmitting) {
											isEditingLocation = false;
										}
									}, 150);
								}}
								placeholder="Enter the location for this game"
								required
								maxlength="200"
								class="location-input" />
							<p class="help-text">
								This is the place where your story will take place (e.g., "A small coastal town",
								"The abandoned factory", "Grandma's attic")
							</p>
						</div>
						<div class="form-actions">
							<button type="submit" class="btn btn-primary">
								{game.location && game.location.trim().length > 0
									? 'Update Location'
									: 'Set Location'}
							</button>
							{#if game.location && game.location.trim().length > 0}
								<button type="button" class="btn btn-secondary" onclick={toggleLocationForm}>
									Cancel
								</button>
							{/if}
						</div>
					</form>
				{/if}
			</div>

			{#if game.location && game.location.trim().length > 0}
				<div class="start-game-section">
					<form method="POST" action="?/startGame" use:enhance>
						<button type="submit" class="btn btn-success btn-large" disabled={!canStartGame}>
							Start Game
						</button>
						{#if !canStartGame}
							<p class="help-text">
								{#if !game.location || game.location.trim().length === 0}
									Set a location first
								{:else if players.length < 2}
									Need at least 2 players to start
								{:else if !allPlayersConfirmed}
									All players must confirm the location
								{/if}
							</p>
						{/if}
					</form>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.waiting-room {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		text-align: center;
		margin-bottom: 2rem;
	}

	.proposed-location {
		text-align: center;
		margin-bottom: 2rem;
		padding: 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.proposed-location-label {
		font-size: 1rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.9);
		margin: 0 0 0.75rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.proposed-location-value {
		font-size: 2rem;
		font-weight: 600;
		color: white;
		margin: 0 0 1.5rem 0;
		line-height: 1.3;
	}

	.proposed-location-value.awaiting {
		font-size: 1.5rem;
		font-weight: 500;
		font-style: italic;
		opacity: 0.8;
	}

	.confirm-location-form {
		margin: 0;
		padding: 0;
	}

	.btn-confirm {
		padding: 0.75rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		background-color: white;
		color: #667eea;
		border: 2px solid white;
	}

	.btn-confirm:hover:not(:disabled) {
		background-color: rgba(255, 255, 255, 0.9);
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.btn-confirm.btn-secondary {
		background-color: rgba(255, 255, 255, 0.2);
		color: white;
		border-color: rgba(255, 255, 255, 0.5);
	}

	.btn-confirm.btn-secondary:hover:not(:disabled) {
		background-color: rgba(255, 255, 255, 0.3);
	}

	.players-section {
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.3rem;
		margin-bottom: 1rem;
		color: #333;
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background-color: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background-color: white;
		border-radius: 4px;
		border: 1px solid #e0e0e0;
		position: relative;
	}

	.player-item:hover {
		background-color: #f8f9fa;
	}

	.player-name-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
	}

	.player-name {
		font-weight: 500;
	}

	.player-badges {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.kick-form {
		margin: 0;
		padding: 0;
	}

	.btn-kick {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background-color: #dc3545;
		color: white;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color 0.2s,
			opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		opacity: 0;
		pointer-events: none;
	}

	.player-item:hover .btn-kick {
		opacity: 1;
		pointer-events: auto;
	}

	.btn-kick:hover {
		background-color: #c82333;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.badge.creator {
		background-color: #007bff;
		color: white;
	}

	.badge.confirmed {
		background-color: #28a745;
		color: white;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		min-width: 1.5rem;
		text-align: center;
	}

	.creator-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background-color: #e7f3ff;
		border-radius: 8px;
		border: 1px solid #b3d9ff;
	}

	.creator-section h2 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.info {
		color: #666;
		font-style: italic;
		margin-top: 0.5rem;
	}

	.error-message {
		padding: 1rem;
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.location-section {
		margin-bottom: 2rem;
	}

	.location-section h3 {
		font-size: 1.1rem;
		margin-bottom: 0.75rem;
		color: #333;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.location-input {
		width: 100%;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.location-input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
	}

	.location-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.help-text {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #666;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s;
		font-weight: 500;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #007bff;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #0056b3;
	}

	.btn-success {
		background-color: #28a745;
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		background-color: #218838;
	}

	.btn-secondary {
		background-color: #6c757d;
		color: white;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #5a6268;
	}

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1.2rem;
	}

	.location-controls {
		margin-bottom: 1rem;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.start-game-section {
		margin-top: 2rem;
		text-align: center;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background-color: white;
		border-radius: 8px;
		padding: 2rem;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.modal-content h3 {
		margin-top: 0;
		margin-bottom: 1rem;
		color: #333;
		font-size: 1.5rem;
	}

	.modal-content p {
		margin-bottom: 1rem;
		color: #666;
		line-height: 1.5;
	}

	.modal-warning {
		color: #dc3545;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	.btn-danger {
		background-color: #dc3545;
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		background-color: #c82333;
	}
</style>
