import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.API_TARGET || 'http://localhost:8787'

// Same proxy config works for `vite dev` and `vite preview`, so the browser
// always talks to a relative /api/... URL (required for the Vercel preview host).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true }
    }
  },
  build: { outDir: 'dist', sourcemap: false }
})
