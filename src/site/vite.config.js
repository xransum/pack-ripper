import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE_PATH || '/pack-ripper/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      base,
      manifest: {
        name: 'Pack Ripper',
        short_name: 'Pack Ripper',
        description: 'Trading card pack opening simulator',
        theme_color: '#1e1b4b',
        background_color: '#111827',
        display: 'standalone',
        start_url: base,
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,avif}'],
      },
    }),
  ],
  root: __dirname,
  build: {
    outDir: resolve(__dirname, '../../dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@data': resolve(__dirname, '../data'),
      '@simulator': resolve(__dirname, './simulator'),
    },
  },
});
