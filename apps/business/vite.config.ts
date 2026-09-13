import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    historyApiFallback: true,
  },
  // @worldcoin/idkit-core ships its own .wasm module for client-side crypto, loaded via a
  // `new URL('./idkit_wasm_bg.wasm', import.meta.url)` reference. Vite's dev-server
  // pre-bundler doesn't rewrite that reference to its own content-hashed dev-cache filename
  // (confirmed: the literal unhashed path 404s and falls through to the SPA's index.html
  // instead of the real wasm binary). Excluding it from pre-bundling serves the package's
  // own original file layout directly, where the relative URL resolves correctly.
  optimizeDeps: {
    exclude: ['@worldcoin/idkit-core'],
  },
});
