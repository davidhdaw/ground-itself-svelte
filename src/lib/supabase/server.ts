import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { RequestEvent } from '@sveltejs/kit';
import type { Database } from './types';

/**
 * Create a Supabase server client for use in load functions
 * Note: For most cases, use event.locals.supabase from hooks.server.ts instead
 * @param event - The SvelteKit request event (from +page.server.ts or +layout.server.ts)
 */
export function createClient(event: RequestEvent) {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll() {
				return event.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});
}
