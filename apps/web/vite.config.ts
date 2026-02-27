import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve workspace packages to TS source to avoid CJS/ESM interop issues
      '@freecord/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@freecord/permissions': path.resolve(__dirname, '../../packages/permissions/src/index.ts'),
      '@freecord/markdown': path.resolve(__dirname, '../../packages/markdown/src/index.ts'),
      '@freecord/snowflake': path.resolve(__dirname, '../../packages/snowflake/src/index.ts'),
      '@freecord/logger': path.resolve(__dirname, '../../packages/logger/src/index.ts'),
    },
  },
  envDir: path.resolve(__dirname, '../../'),
  server: {
    port: 5173,
    host: true,
    hmr: { clientPort: 5173 },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          zustand: ['zustand'],
          mediasoup: ['mediasoup-client'],
          emoji: ['emoji-mart', '@emoji-mart/data', '@emoji-mart/react'],
        },
      },
    },
  },
})
