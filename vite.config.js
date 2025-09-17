// vite.config.js (index.html у тебя в src)
import { defineConfig } from 'vite';
import injectHTML from 'vite-plugin-html-inject';
import FullReload from 'vite-plugin-full-reload';
import sortMediaQueries from 'postcss-sort-media-queries';

export default defineConfig(({ command }) => ({
  root: 'src',
  base: command === 'build' ? '/greate-catch/' : '/', // имя репо — точно!
  define: { global: {} },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    // НИКАКИХ кастомных entryFileNames/assetFileNames — пусть Vite сам вставит пути
  },
  plugins: [
    injectHTML(),
    FullReload(['./**/*.html']),
  ],
  css: { postcss: { plugins: [sortMediaQueries({ sort: 'mobile-first' })] } },
}));
