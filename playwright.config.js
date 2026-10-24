import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { tourSeen } from './tests/e2e/seen.js';

// The system Chromium has the H.264 encoder, so it records MP4 like Chrome does.
// Without it, Playwright's own Chromium records WebM.
const SYSTEM_CHROMIUM = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';
const PORT = Number(process.env.PORT ?? 4179);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/poprocks/`,
    permissions: ['camera', 'microphone'],
    // Most tests start past the how-to tour; tests/e2e/tour.spec.js starts without this.
    storageState: tourSeen(`http://127.0.0.1:${PORT}`),
    launchOptions: {
      executablePath: existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/poprocks/`,
    reuseExistingServer: false,
  },
});
