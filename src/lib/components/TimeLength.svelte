<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from '../../routes/games/[gameCode]/$types';

	type Player = PageData['players'][number];

	let { game, players, user, playerId, form } = $props<{
		game: PageData['game'];
		players: PageData['players'];
		user: PageData['user'];
		playerId: PageData['playerId'];
		form?: ActionData;
	}>();

	const isCreator = $derived(user?.id === game.created_by);
	const currentPlayer = $derived(
		players.find((p: Player) => (user ? p.user_id === user.id : p.id === playerId))
	);

	const currentPlayLength = $derived(game.play_length || null);
</script>

<div class="time-length">
	<h1>Determine Cycle Length</h1>

	<div class="instructions">
		<p>
			The cycle length determines how time advances in your story. Each cycle will span a certain
			amount of time based on this selection.
		</p>
	</div>

	{#if currentPlayLength}
		<div class="selected-length">
			<p class="label">Selected Cycle Length:</p>
			<p class="value">{currentPlayLength}</p>
		</div>
	{:else}
		<div class="no-selection">
			<p class="label">No cycle length selected yet</p>
			<p class="help-text">Roll to generate a random cycle length</p>
		</div>
	{/if}

	{#if form?.error}
		<div class="error-message">{form.error}</div>
	{/if}

	{#if isCreator}
		<div class="creator-section">
			<div class="actions">
				<form method="POST" action="?/rollTimeLength" use:enhance>
					<button type="submit" class="btn btn-primary btn-large">
						{currentPlayLength ? 'Re-roll Cycle Length' : 'Roll Cycle Length'}
					</button>
				</form>

				{#if currentPlayLength}
					<form method="POST" action="?/confirmTimeLength" use:enhance>
						<button type="submit" class="btn btn-success btn-large">
							Confirm and Continue to Establishing Phase
						</button>
					</form>
				{/if}
			</div>
		</div>
	{:else}
		<div class="waiting-section">
			<p class="waiting-text">
				Waiting for the game creator to roll and confirm the cycle length...
			</p>
		</div>
	{/if}
</div>

<style>
	.time-length {
		max-width: 800px;
		margin: 2rem auto;
		padding: 2rem;
	}

	h1 {
		text-align: center;
		margin-bottom: 2rem;
	}

	.instructions {
		text-align: center;
		margin-bottom: 2rem;
		color: #666;
	}

	.instructions p {
		font-size: 1.1rem;
		line-height: 1.6;
	}

	.selected-length {
		text-align: center;
		margin-bottom: 2rem;
		padding: 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.selected-length .label {
		font-size: 1rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.9);
		margin: 0 0 0.75rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.selected-length .value {
		font-size: 3rem;
		font-weight: 700;
		color: white;
		margin: 0;
		line-height: 1.2;
	}

	.no-selection {
		text-align: center;
		margin-bottom: 2rem;
		padding: 2rem;
		background-color: #f8f9fa;
		border-radius: 12px;
		border: 2px dashed #ccc;
	}

	.no-selection .label {
		font-size: 1.2rem;
		font-weight: 500;
		color: #666;
		margin: 0 0 0.5rem 0;
	}

	.no-selection .help-text {
		font-size: 0.95rem;
		color: #999;
		margin: 0;
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

	.creator-section {
		margin-top: 2rem;
		padding: 1.5rem;
		background-color: #e7f3ff;
		border-radius: 8px;
		border: 1px solid #b3d9ff;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
	}

	.waiting-section {
		margin-top: 2rem;
		padding: 2rem;
		text-align: center;
		background-color: #fff3cd;
		border-radius: 8px;
		border: 1px solid #ffc107;
	}

	.waiting-text {
		font-size: 1.1rem;
		color: #856404;
		margin: 0;
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

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1.2rem;
		min-width: 300px;
	}
</style>
