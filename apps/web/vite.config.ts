import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { transformer: 'lightningcss' },
  build: { cssMinify: 'lightningcss' },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'happy-dom', setupFiles: ['fake-indexeddb/auto'] },
})
