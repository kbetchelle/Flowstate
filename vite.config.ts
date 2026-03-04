import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Flowstate',
        short_name: 'Flowstate',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1976d2',
        background_color: '#ffffff',
      },
    }),
  ],
})
