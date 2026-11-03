import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages-də layihə /pille/ alt yolunda yayımlanır.
const base = process.env.GITHUB_PAGES ? '/pille/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Pillə',
        short_name: 'Pillə',
        description: 'Abituriyent, magistr və dövlət qulluğu hazırlığı. Qalanı daş-daş tik.',
        lang: 'az',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a1620',
        theme_color: '#0a1620',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'] },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
