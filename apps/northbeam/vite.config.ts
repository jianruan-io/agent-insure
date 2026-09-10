import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One consolidated .env.local at the repo root instead of a per-app copy — see
  // the root .env.example's "ENS spending rules" section for what's read from here.
  envDir: '../../',
  server: {
    historyApiFallback: true,
  },
});
