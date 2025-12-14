<script lang="ts">
	import { getAuthContext } from '$lib/auth/context';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const auth = getAuthContext();

	let redirected = $state(false);

	onMount(() => {
		const doRedirect = () => {
			if (redirected) return;
			if (!auth.loading) {
				redirected = true;
				if (!auth.user) {
					goto('/auth/login');
				} else {
					goto('/games/create');
				}
			}
		};

		doRedirect();

		// Check periodically until redirect happens
		const interval = setInterval(() => {
			doRedirect();
		}, 100);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<div>Redirecting...</div>
