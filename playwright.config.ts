import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  workers: 1, // one shared SQLite file
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    permissions: ["camera"],
    launchOptions: {
      // Chromium's built-in fake webcam (animated test pattern) stands in for a real camera.
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], permissions: ["camera"] } }],
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/settings`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
