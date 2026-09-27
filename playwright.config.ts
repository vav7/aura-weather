import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1, // webgl + browser + server is memory-hungry
  fullyParallel: false,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: {
      // keep the browser tiny: this workspace (and some CIs) run on <=1GB boxes
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-zygote",
        "--renderer-process-limit=1",
        "--js-flags=--max-old-space-size=256",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
});
