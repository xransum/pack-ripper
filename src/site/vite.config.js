import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE_PATH || '/pack-ripper/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
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
