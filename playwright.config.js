import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) process.loadEnvFile('.env');

// Dedicated ports so E2E runs never collide with your normal dev servers (4000 / 5180).
const API_PORT = 4100;
const WEB_PORT = 5190;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Assertions wait up to 10 s: with four browsers in parallel, sign-up (Argon2 + email)
  // can take longer than the 5 s default without any problem for real users.
  expect: { timeout: 10_000 },
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    // Browse like a family in Morocco: French locale (date formats) and local time zone.
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      // The real API, pointed at the *_test database.
      command: 'node apps/api/src/server.js',
      // Show the API's warnings/errors in the test output (it only logs at warn level here).
      stdout: 'pipe',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        API_PORT: String(API_PORT),
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
        // The suite signs up many people from one IP; real limits are covered by API tests.
        RATE_LIMIT_SCALE: '100',
      },
    },
    {
      command: 'npm run dev -w @tigmi/web',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        WEB_PORT: String(WEB_PORT),
        VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
