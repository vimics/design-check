import { defineConfig } from '@playwright/test';

/** Builds against the fixture case, so the tests never depend on the case that is live. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4179',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4179 --strictPort',
    env: { CASE_DIR: 'e2e/fixture-case' },
    url: 'http://localhost:4179',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
