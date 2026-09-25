import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills()],
  server: {
    port: 3000,
    open: true,
    // Browser profiles created in the workspace must not be watched by Vite.
    // Watching locked SQLite/Cookie files can terminate the dev server on Windows.
    watch: {
      ignored: ['**/.edge-debug/**', '**/.edge-test/**'],
    },
  }
});
