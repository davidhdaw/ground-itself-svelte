<script lang="ts">
	let { prompt, isPrevious = false } = $props<{
		prompt: string;
		isPrevious?: boolean;
	}>();
</script>

{#if isPrevious}
	<p class="previous-prompt">{prompt}</p>
{:else}
	<h2 class="current-prompt">{prompt}</h2>
{/if}

<style>
	.current-prompt {
		min-height: 5rem;
		font-size: 2.5rem;
		margin: 1rem 0;
		text-align: center;
	}

	.previous-prompt {
		min-height: 5rem;
		font-size: 2rem;
		opacity: 0.5;
		text-align: left;
		max-width: 85%;
		margin: 1rem 0;
	}
</style>
