import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5780,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        timeout: 300000 // 5 minute timeout for long-running requests
      }
    },
    // Force reload on file changes
    hmr: {
      overlay: true
    }
  },
  // Add timestamps to avoid caching issues in dev
  build: {
    rollupOptions: {
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash].[ext]'
      }
    }
  }
})
