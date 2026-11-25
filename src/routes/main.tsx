import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  PAGE_LIMIT,
  STATUS,
  clearResNotifications,
  countResNotifications,
  countUnauthorizedUsers,
  cursorOf,
  getStatements,
  parseDateCursor,
  statementToHash
} from "../models";
import { iconDir } from "../settings";
import { LoginPage, TimelinePage, UnauthorizedPage, toSidebarData } from "../views/pages";

const app = new Hono<AppEnv>();

app.get("/login", (c) => {
  const me = c.get("currentUser");
  if (me && me.status !== 9) return c.redirect("/");
  return c.html(<LoginPage settings={c.get("settings")} />);
});

app.get("/logout", (c) => {
  // 本番では Cloudflare Access のログアウトへ。開発時はログイン画面へ戻す。
  if (c.env.ENVIRONMENT === "production") {
    return c.redirect("/cdn-cgi/access/logout");
  }
  return c.redirect("/login");
});

app.get("/unauthorized", (c) => {
  return c.html(
    <UnauthorizedPage settings={c.get("settings")} me={c.get("currentUser")} />,
  );
});

app.get("/", async (c) => {
  const me = c.get("currentUser")!;
  const [statements, resSize, notifyRenders, unauthCount] = await Promise.all([
    getStatements(c.env.DB, { before: parseDateCursor(c.req.query("date")) }),
    countResNotifications(c.env.DB, me.id),
    Promise.all(c.get("plugins").notify.map((p) => p.render())),
    me.status === STATUS.ADMIN
      ? countUnauthorizedUsers(c.env.DB)
      : Promise.resolve(0),
  ]);
  const notifyHtml = notifyRenders.filter((html) => html.length > 0);
  const nextCursor =
    statements.length === PAGE_LIMIT
      ? cursorOf(statements[statements.length - 1].row.created_at)
      : null;
  return c.html(
    <TimelinePage
      settings={c.get("settings")}
      me={me}
      resSize={resSize}
      statements={statements.map(statementToHash)}
      nextCursor={nextCursor}
      notifyHtml={notifyHtml}
      unauthCount={unauthCount}
      sidebar={toSidebarData(c.get("sidebar"))}
    />,
  );
});

app.get("/index.json", async (c) => {
  const statements = await getStatements(c.env.DB, {
    before: parseDateCursor(c.req.query("date")),
  });
  return c.json(statements.map(statementToHash));
});

/** レス新着件数（元の /ressize.json）。 */
app.get("/ressize.json", async (c) => {
  const me = c.get("currentUser")!;
  return c.json({
    user: me.massr_id,
    size: await countResNotifications(c.env.DB, me.id),
  });
});

/** レス新着のクリア（元の DELETE /newres）。 */
app.delete("/newres", async (c) => {
  const me = c.get("currentUser")!;
  await clearResNotifications(c.env.DB, me.id);
  return c.body(null, 204);
});

/** R2 に保存したメディアの配信。キーは media/ 配下に一意に生成される。 */
app.get("/media/*", async (c) => {
  const key = c.req.path.replace(/^\/media\//, "media/");
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  return c.body(obj.body, 200, {
    "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    // 万一の混入に備え、メディアはスクリプト実行できない形で配信する。
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  });
});

// 元の routes/icon.rb: favicon と apple-touch-icon は icon_dir のセットから配信する。
app.get("/favicon.ico", async (c) => {
  const dir = iconDir(c.get("settings"));
  return c.env.ASSETS.fetch(
    new Request(`https://assets.local/img/icons/${dir}/favicon.ico`),
  );
});

app.get("/img/apple-touch-icon-*", async (c) => {
  const m = c.req.path.match(/^\/img\/apple-touch-icon-(\d+x\d+)\.png$/);
  if (!m) return c.notFound();
  const dir = iconDir(c.get("settings"));
  const res = await c.env.ASSETS.fetch(
    new Request(`https://assets.local/img/icons/${dir}/apple-touch-icon-${m[1]}.png`),
  );
  return res.status === 200 ? res : c.notFound();
});

export default app;
