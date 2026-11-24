import { Hono } from "hono";
import type { Env } from "./env";
import { loadSettings, term, type MassrSettings } from "./settings";
import { loadPlugins, type LoadedPlugins } from "./plugins/registry";
import "./plugins/index";
import { resolveAccessEmail } from "./auth";
import { Layout } from "./views/layout";

interface Variables {
  accessEmail: string | null;
  settings: MassrSettings;
  plugins: LoadedPlugins;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 全リクエスト共通: 設定の読み込み、プラグインの有効化、Access の識別。
app.use("*", async (c, next) => {
  const settings = loadSettings(c.env);
  c.set("settings", settings);
  c.set(
    "plugins",
    loadPlugins(settings, { env: c.env, settings, db: c.env.DB }),
  );
  c.set("accessEmail", resolveAccessEmail(c));
  await next();
});

// 動作確認用: DB 接続と識別状態を返す。
app.get("/__health", async (c) => {
  let db = "down";
  try {
    await c.env.DB.prepare("SELECT 1").first();
    db = "up";
  } catch {
    db = "down";
  }
  return c.json({ ok: true, db, email: c.get("accessEmail") });
});

// Phase 0 のトップページ（基盤の確認用）。タイムラインは Phase 1 で実装する。
app.get("/", (c) => {
  const settings = c.get("settings");
  const siteName = term(settings, "site_name");
  const plugins = c.get("plugins");
  const loaded =
    plugins.all.map((p) => `${p.genre}/${p.name}`).join(", ") || "(none)";
  return c.html(
    <Layout title={siteName} siteName={siteName}>
      <h1>{siteName}</h1>
      <p>Phase 0 基盤の動作確認ページです。</p>
      <p>Access identity: {c.get("accessEmail") ?? "(none)"}</p>
      <p>Loaded plugins: {loaded}</p>
    </Layout>,
  );
});

export default app;
