import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '.ondigitalocean.app', // Allows ALL subdomains of ondigitalocean.app
      'localhost',          // Keep localhost for local development
    ],
  },
  define: {
    global: 'globalThis',
  },
})
