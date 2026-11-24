import { Hono } from "hono";
import type { AppEnv } from "./types";
import type { Env } from "./env";
import { loadSettings } from "./settings";
import { loadPlugins } from "./plugins/registry";
import "./plugins/index";
import { resolveAccessEmail } from "./auth";
import { STATUS, getUserByEmail } from "./models";
import mainRoutes from "./routes/main";
import statementRoutes from "./routes/statements";
import userRoutes from "./routes/users";
import searchRoutes from "./routes/search";
import stampRoutes from "./routes/stamps";
import pluginRoutes from "./routes/plugins";

const app = new Hono<AppEnv>();

// 全リクエスト共通: 設定の読み込み、プラグインの有効化、Access の識別、
// 現在のユーザ（users テーブル）の解決。
app.use("*", async (c, next) => {
  const settings = loadSettings(c.env);
  const plugins = loadPlugins(settings, { env: c.env, settings, db: c.env.DB });
  // icon プラグイン（icon/rotate 等）があれば icon_dir を差し替える（元の helper 上書きに相当）。
  if (plugins.icon.length > 0) {
    settings.resource.icon_dir = plugins.icon[0].iconDir(new Date());
  }
  c.set("settings", settings);
  c.set("plugins", plugins);
  const email = resolveAccessEmail(c);
  c.set("accessEmail", email);
  c.set("currentUser", email ? await getUserByEmail(c.env.DB, email) : null);
  await next();
});

// 認可ガード（元のログイン必須・未認可ユーザの扱いに相当）。
// 静的アセットと公開ページは素通りさせる。
const PUBLIC_PATHS = new Set([
  "/login",
  "/logout",
  "/unauthorized",
  "/__health",
  "/favicon.ico",
  "/default.json",
]);
app.use("*", async (c, next) => {
  const path = c.req.path;
  if (
    PUBLIC_PATHS.has(path) ||
    path.startsWith("/css/") ||
    path.startsWith("/js/") ||
    path.startsWith("/img/") ||
    path.startsWith("/media/")
  ) {
    return next();
  }
  if (!c.get("accessEmail")) return c.redirect("/login");
  const me = c.get("currentUser");
  if (!me) {
    // Access 認証済みだが未登録 → 登録フォームへ。
    if (path === "/user") return next();
    return c.redirect("/user");
  }
  if (me.status === STATUS.UNAUTHORIZED && path !== "/user") {
    return c.redirect("/unauthorized");
  }
  return next();
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

app.route("/", mainRoutes);
app.route("/", statementRoutes);
app.route("/", userRoutes);
app.route("/", searchRoutes);
app.route("/", stampRoutes);
app.route("/", pluginRoutes);

export type { Env };
export default app;
