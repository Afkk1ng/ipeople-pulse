import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// A small, server-free build for GitHub Pages and iPhone home-screen use.
export default defineConfig({
  root: 'static',
  base: './',
  publicDir: '../public',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    copyPublicDir: true,
  },
});
