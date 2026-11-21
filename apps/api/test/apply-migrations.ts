import { applyD1Migrations, env } from "cloudflare:test";
import type { D1Migration } from "@cloudflare/vitest-plugin";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
