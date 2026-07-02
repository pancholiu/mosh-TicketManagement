import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test', override: true })

export default defineConfig({
  testDir: './e2e/tests',
  // Run tests serially to avoid DB conflicts between tests
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './e2e/global-setup.ts',
  webServer: [
    {
      // Test server on port 3001 so it never conflicts with the dev server (3000)
      command: 'bun --env-file .env.test server/src/index.ts',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Test Vite on port 5174 (VITE_PORT) so it never conflicts with dev Vite (5173)
      command: 'bun run --filter client dev',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
