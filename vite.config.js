import { defineConfig } from 'vite';
import { glob } from 'glob';
import injectHTML from 'vite-plugin-html-inject';
import FullReload from 'vite-plugin-full-reload';
import sortMediaQueries from 'postcss-sort-media-queries';

export default defineConfig(() => ({
  root: 'src',
  // проверь слаг репозитория и поправь строку ниже при необходимости
  base: '/greate-catch/',
  define: { global: {} }, // чтобы не ловить "global is not defined"
  build: {
    sourcemap: true,
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: glob.sync('./src/*.html'),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
        entryFileNames: chunk =>
          chunk.name === 'commonHelpers' ? 'commonHelpers.js' : '[name].js',
        assetFileNames: info =>
          info.name?.endsWith('.html') ? '[name][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    injectHTML(),
    FullReload(['src/**/*.html']),
  ],
  css: {
    postcss: {
      plugins: [sortMediaQueries({ sort: 'mobile-first' })],
    },
  },
}));
