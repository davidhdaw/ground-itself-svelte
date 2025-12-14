import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173, // Changed from default 5173 to avoid conflicts
		strictPort: false, // Allow fallback to next available port
		host: true
	}
});
