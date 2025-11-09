import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
  ],
  server: {
    proxy: {
      // We'll use '/api' as the prefix for all backend requests
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://144.202.16.27:8000', // Your backend's address (can be overridden with env var)
        changeOrigin: true, // This is necessary for the proxy to work
        rewrite: (path) => path.replace(/^\/api/, ''), // This removes /api from the request
      },
    },
  },
})
