import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test/**",
        "**/node_modules/**",
      ],
      // Fail CI when coverage drops below these floors. Raise as tests are added.
      // Current baselines (v1.0.0): lines 2.97%, functions 14.55%, branches 51.58%
      thresholds: {
        lines: 2,
        functions: 14,
        branches: 50,
      },
    },
  },
});
