import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server proxies /api/* requests to the Flask backend running on port 5000.
// This avoids CORS issues during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
