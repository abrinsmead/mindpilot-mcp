import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import electron from 'vite-plugin-electron/simple'

const isElectron = process.env.ELECTRON === 'true'

export default defineConfig({
  plugins: [
    react(),
    // Only include electron plugin when building for Electron
    ...(isElectron ? [
      electron({
        main: {
          entry: '../electron/main.ts',
          vite: {
            build: {
              outDir: '../../dist/electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
        preload: {
          input: '../electron/preload.ts',
          vite: {
            build: {
              outDir: '../../dist/electron',
            },
          },
        },
      }),
    ] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Pre-bundle mermaid and its dynamic imports to avoid issues in Electron
  optimizeDeps: {
    include: ['mermaid'],
  },
  build: {
    outDir: '../../dist/public',
    emptyOutDir: true,
    // Use relative paths for Electron file:// loading
    base: isElectron ? './' : '/',
  },
  // Use relative base in Electron mode
  base: isElectron ? './' : '/',
  server: {
    port: 5173,
    proxy: {
      // Change this port if running the backend on a different port
      '/api': 'http://localhost:4000',
    },
  },
})