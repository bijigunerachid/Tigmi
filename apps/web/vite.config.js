import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The single .env file lives at the repository root.
const envDir = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  // Third argument '' loads all variables for this config file only; the browser bundle
  // still only receives variables prefixed with VITE_.
  const env = loadEnv(mode, envDir, '');
  const port = Number(env.WEB_PORT || 5180);
  const proxy = {
    '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: false },
  };

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: { port, strictPort: true, proxy },
    preview: { port, strictPort: true, proxy },
    build: { sourcemap: false },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
      css: false,
    },
  };
});
