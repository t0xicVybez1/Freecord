import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
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
