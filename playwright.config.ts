import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  // Les tests partagent les émulateurs Firebase → un seul worker pour éviter les conflits
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4201',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Émulateurs Firebase Auth + Firestore
      command: 'npx firebase emulators:start --only auth,firestore --project demo-croissant',
      url: 'http://localhost:9099',
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
    {
      // App Angular avec environment e2e (pointe vers les émulateurs)
      command: 'ng serve --configuration e2e --port 4201',
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
