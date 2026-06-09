import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 5_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5199',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'pnpm exec vite --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  workers: 1,
  retries: 0,
  reporter: 'list',
})
