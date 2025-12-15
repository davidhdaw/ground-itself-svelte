<script lang="ts">
	import { setAuthContext, type AuthContext } from './context';
	import { createClient } from '$lib/supabase/client';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { User } from '@supabase/supabase-js';

	let { children } = $props();

	let supabase = $state<ReturnType<typeof createClient> | null>(null);

	let user = $state<User | null>(null);
	let loading = $state(true);

	// Initialize auth state
	// Initialize auth state (client-side only)
	onMount(async () => {
		if (!browser) {
			loading = false;
			return;
		}

		supabase = createClient();

		// Get initial session
		const {
			data: { session }
		} = await supabase.auth.getSession();
		user = session?.user ?? null;
		loading = false;

		// Listen for auth changes
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => {
			user = session?.user ?? null;
			loading = false;
		});

		return () => {
			subscription.unsubscribe();
		};
	});

	const signIn = async (email: string, password: string) => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			throw error;
		}
	};

	const signUp = async (email: string, password: string) => {
		const { error } = await supabase.auth.signUp({
			email,
			password
		});

		if (error) {
			throw error;
		}
	};

	const signOut = async () => {
		const { error } = await supabase.auth.signOut();

		if (error) {
			throw error;
		}
	};

	const signInAnonymously = async () => {
		const { error } = await supabase.auth.signInAnonymously();

		if (error) {
			throw error;
		}
	};

	const authContext: AuthContext = {
		get user() {
			return user;
		},
		get loading() {
			return loading;
		},
		signIn,
		signUp,
		signOut,
		signInAnonymously
	};

	setAuthContext(authContext);
</script>

{@render children()}
