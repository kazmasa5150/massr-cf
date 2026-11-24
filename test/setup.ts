import { env, applyD1Migrations } from "cloudflare:test";
import type { D1Migration } from "cloudflare:test";
import { beforeAll, beforeEach } from "vitest";

const testEnv = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

// マイグレーションを適用し、テストごとに全テーブルを空にする
// （元の spec_helper がテスト用 DB を drop していたことに相当）。
beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await testEnv.DB.batch([
    testEnv.DB.prepare("DELETE FROM likes"),
    testEnv.DB.prepare("DELETE FROM statement_photos"),
    testEnv.DB.prepare("DELETE FROM res_notifications"),
    testEnv.DB.prepare("DELETE FROM stamps"),
    testEnv.DB.prepare("DELETE FROM statements"),
    testEnv.DB.prepare("DELETE FROM search_pins"),
    testEnv.DB.prepare("DELETE FROM plugin_settings"),
    testEnv.DB.prepare("DELETE FROM users"),
  ]);
});
