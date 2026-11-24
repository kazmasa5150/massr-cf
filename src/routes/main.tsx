import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  PAGE_LIMIT,
  countResNotifications,
  clearResNotifications,
  cursorOf,
  getStatements,
  parseDateCursor,
  statementToHash,
} from "../models";
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
  const statements = await getStatements(c.env.DB, {
    before: parseDateCursor(c.req.query("date")),
  });
  const resSize = await countResNotifications(c.env.DB, me.id);
  const notifyHtml = (
    await Promise.all(c.get("plugins").notify.map((p) => p.render()))
  ).filter((html) => html.length > 0);
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
  });
});

app.get("/favicon.ico", (c) => c.redirect("/img/default-icon.svg"));

export default app;
