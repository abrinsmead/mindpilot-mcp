import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../../dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Change this port if running the backend on a different port
      '/api': `http://localhost:${process.env.MINDPILOT_API_PORT || process.env.VITE_API_PORT || 4000}`,
    },
  },
})
