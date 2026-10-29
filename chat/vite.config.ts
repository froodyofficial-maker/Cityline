import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps every asset path relative, so the built site works from any
// folder or sub-path (Netlify, Vercel, GitHub Pages, Cloudflare Pages, a USB stick…).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
