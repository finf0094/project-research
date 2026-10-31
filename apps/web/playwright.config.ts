import { defineConfig } from '@playwright/test'

// Runs against a live stack (API, worker, Vite) with seeded demo data — see the README.
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    permissions: ['camera', 'microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
})
