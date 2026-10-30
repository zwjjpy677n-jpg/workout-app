import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// ルーティン（別アプリ）。ソースは routine/、出力は dist-routine/
export default defineConfig({
  root: 'routine',
  base: './',
  build: { outDir: '../dist-routine', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'ルーティン',
        short_name: 'ルーティン',
        description: '毎日のルーティンとやること',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#0B0B0D',
        background_color: '#0B0B0D',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        runtimeCaching: [
          { urlPattern: /\.woff2$/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 300 } } },
        ],
      },
    }),
  ],
});
