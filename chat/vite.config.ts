import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Browsers refuse to load <script type="module" src> files from file://, so a
// double-clicked dist/index.html would stay blank. Inlining the (single) JS
// bundle and the CSS into index.html makes the build work straight from disk
// as well as on any host. config.js stays separate: classic scripts load fine
// from file:// and it can still be edited without rebuilding.
function inlineIntoHtml(): Plugin {
  return {
    name: 'cityline-inline-into-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          const tag = new RegExp(`<script type="module" crossorigin src="\\./${name}"></script>`);
          // `</script` inside the code would end the inline tag early
          const code = file.code.replace(/<\/script/gi, '<\\/script');
          source = source.replace(tag, () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (file.type === 'asset' && name.endsWith('.css')) {
          const tag = new RegExp(`<link rel="stylesheet" crossorigin href="\\./${name}">`);
          source = source.replace(tag, () => `<style>${String(file.source)}</style>`);
          delete bundle[name];
        }
      }
      html.source = source;
    },
  };
}

// base: './' keeps every remaining path relative, so the site works from any
// folder or sub-path (Netlify, Vercel, GitHub Pages, Cloudflare Pages, a USB stick…).
export default defineConfig({
  base: './',
  plugins: [react(), inlineIntoHtml()],
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    // one bundle, so nothing has to be fetched as a module at runtime
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
