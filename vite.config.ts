import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Nạp toàn bộ biến môi trường bắt đầu bằng VITE_ từ file .env mà không bị cache
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), nodePolyfills()],
    envPrefix: ['VITE_'],
    server: {
      port: 3000,
      open: true,
      // Browser profiles created in the workspace must not be watched by Vite.
      // Watching locked SQLite/Cookie files can terminate the dev server on Windows.
      watch: {
        ignored: ['**/.edge-debug/**', '**/.edge-test/**'],
      },
    },
    define: {
      // Đảm bảo các biến Supabase luôn được bind động theo môi trường runtime
      __VITE_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || ''),
      __VITE_SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
    },
  };
});
