import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 1000,
  },
});
