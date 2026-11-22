import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(root, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Fake Razorpay keys so signature checks can be tested. No test calls Razorpay.
          bindings: { TEST_MIGRATIONS: migrations, RAZORPAY_KEY_ID: "rzp_test_local", RAZORPAY_KEY_SECRET: "local-test-secret" },
        },
      };
    }),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
    include: ["test/**/*.spec.ts"],
  },
});
