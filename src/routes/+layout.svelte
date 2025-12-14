<script lang="ts">
	import AuthProvider from '$lib/auth/AuthProvider.svelte';
	import Header from '$lib/components/Header.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

<AuthProvider>
	<Header />
	{@render children()}
</AuthProvider>
