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
      // En CI : app pré-buildée servie par serve (rapide)
      // En local : ng serve avec hot-reload
      command: process.env['CI'] || process.env['USE_STATIC_SERVE']
        ? 'npx serve dist/croissant-angular/browser -l 4201 --single'
        : 'npx ng serve --configuration e2e --port 4201',
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: process.env['CI'] || process.env['USE_STATIC_SERVE'] ? 15_000 : 120_000,
    },
  ],
});
