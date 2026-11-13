import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on IPv4 loopback: on Windows "localhost" can resolve to ::1 only, and
    // `netlify dev` then intermittently fails to proxy (500 "Could not proxy request").
    host: '127.0.0.1',
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true
      }
    }
  }
})
