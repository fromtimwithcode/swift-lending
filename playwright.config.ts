import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 3,
  use: { baseURL: "http://127.0.0.1:4178", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "pnpm exec vite --config tests/ui/vite.config.mts",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: !process.env.CI,
  },
});
