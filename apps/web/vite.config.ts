import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    // The app shell, fonts, the face model and its WASM runtime are cached so a reload works offline.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'exam',
        short_name: 'exam',
        theme_color: '#16153a',
        background_color: '#f3f4fa',
        display: 'standalone',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,wasm,tflite}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { transformer: 'lightningcss' },
  build: { cssMinify: 'lightningcss', target: 'es2023' },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'happy-dom', setupFiles: ['fake-indexeddb/auto'] },
})
