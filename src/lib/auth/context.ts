import { setContext, getContext } from 'svelte';
import { createClient } from '$lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const AUTH_CONTEXT_KEY = Symbol('auth');

export interface AuthContext {
	user: User | null;
	loading: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
}

export function setAuthContext(context: AuthContext) {
	setContext(AUTH_CONTEXT_KEY, context);
}

export function getAuthContext(): AuthContext {
	const context = getContext<AuthContext>(AUTH_CONTEXT_KEY);
	if (!context) {
		throw new Error('Auth context not found. Make sure AuthProvider is in the component tree.');
	}
	return context;
}
