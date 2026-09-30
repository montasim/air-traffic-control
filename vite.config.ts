import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: mode === 'desktop' ? [] : [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'favicon-airplane-32.png', 'apple-touch-icon-airplane.png'],
      manifest: {
        name: 'Air Traffic Control',
        short_name: 'Air Traffic',
        description: 'Draw flight paths. Land aircraft. Avoid collisions.',
        theme_color: '#254039',
        background_color: '#254039',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/app-icon-airplane-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-airplane-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/app-icon-airplane-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,mp3,ogg}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600
  }
}));
