import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para funcionar como arquivos estáticos e dentro do Tauri 2.
export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  // porta fixa do Vértice tauri (devUrl em src-tauri/tauri.conf.json)
  server: { port: 5184, strictPort: true, host: '127.0.0.1' },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1500 },
});
