import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://rt3norio.github.io/app-nutrition/
const BASE = '/app-nutrition/';

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nutrição — Plano Alimentar',
        short_name: 'Nutrição',
        description:
          'Acompanhe o que comer, quando e quanto. Aberto, gratuito e sem servidor — seus dados ficam no seu Google Drive.',
        lang: 'pt-BR',
        theme_color: '#2f9e6f',
        background_color: '#f4f7f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Google scripts/APIs must hit the network — never serve them from cache.
        navigateFallbackDenylist: [/^\/drive/, /accounts\.google\.com/],
      },
    }),
  ],
});
