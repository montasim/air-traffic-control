import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
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
});
