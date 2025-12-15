import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Check if HTTPS certificates exist
const certPath = path.resolve('certs/localhost.pem');
const keyPath = path.resolve('certs/localhost-key.pem');
const httpsEnabled = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173, // Changed from default 5173 to avoid conflicts
		strictPort: false, // Allow fallback to next available port
		host: true,
		...(httpsEnabled && {
			https: {
				key: fs.readFileSync(keyPath),
				cert: fs.readFileSync(certPath)
			}
		})
	}
});
