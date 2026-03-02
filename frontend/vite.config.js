import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Basic Vite + Vitest config for a React SPA.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
});

