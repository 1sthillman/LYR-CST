import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path - Environment variable ile dinamik
  // GitHub Pages için '/LYR-CST/' gerekli, Android/local için '/' olmalı
  // GitHub Actions'da VITE_BASE_PATH='/LYR-CST/' set edilecek
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@database': path.resolve(__dirname, './src/database'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    exclude: ['sql.js']
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    commonjsOptions: {
      include: [/sql.js/, /node_modules/]
    },
    outDir: 'dist'
  }
})

