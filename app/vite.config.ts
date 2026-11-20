import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para funcionar como arquivos estáticos e dentro do Tauri 2.
export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1500 },
});
