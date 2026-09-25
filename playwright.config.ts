import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.STUDENT_WEB_URL || 'https://language-metrics-student-web.vercel.app',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'laptop',
      use: {
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    },
    {
      name: 'tablet-ipad',
      use: {
        ...devices['iPad Mini'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone 14'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
