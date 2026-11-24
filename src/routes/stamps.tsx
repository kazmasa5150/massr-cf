import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  countResNotifications,
  createStamp,
  deleteStampByUrl,
  getStampById,
  listStamps,
  stampToHash,
  updateStampTag,
} from "../models";
import { StampsPage, toSidebarData } from "../views/pages";

const app = new Hono<AppEnv>();

app.get("/stamps", async (c) => {
  const me = c.get("currentUser")!;
  const stamps = await listStamps(c.env.DB);
  return c.html(
    <StampsPage
      sidebar={toSidebarData(c.get("sidebar"))}
      settings={c.get("settings")}
      me={me}
      resSize={await countResNotifications(c.env.DB, me.id)}
      stamps={await Promise.all(stamps.map((s) => stampToHash(c.env.DB, s)))}
    />,
  );
});

app.get("/stamps.json", async (c) => {
  const stamps = await listStamps(c.env.DB);
  return c.json(await Promise.all(stamps.map((s) => stampToHash(c.env.DB, s))));
});

/** 写真をスタンプに登録する（元の POST /stamp）。 */
app.post("/stamp", async (c) => {
  const form = await c.req.parseBody();
  const method = typeof form["_method"] === "string" ? form["_method"] : "";
  if (method === "delete") {
    const imageUrl = typeof form["image_url"] === "string" ? form["image_url"] : "";
    if (imageUrl) await deleteStampByUrl(c.env.DB, imageUrl);
    return c.redirect("/");
  }
  const imageUrl = typeof form["image_url"] === "string" ? form["image_url"] : "";
  const statementId = typeof form["statement_id"] === "string" ? Number(form["statement_id"]) : NaN;
  if (!imageUrl || !Number.isInteger(statementId)) return c.body(null, 400);
  const stamp = await createStamp(c.env.DB, imageUrl, statementId);
  return c.json(await stampToHash(c.env.DB, stamp));
});

/** スタンプをやめる（元の DELETE /stamp）。 */
app.delete("/stamp", async (c) => {
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const imageUrl =
    (typeof form["image_url"] === "string" ? form["image_url"] : undefined) ??
    c.req.query("image_url") ??
    "";
  if (imageUrl) await deleteStampByUrl(c.env.DB, imageUrl);
  return c.redirect("/");
});

/** スタンプのタグ更新（元の POST /stamp/tag）。 */
app.post("/stamp/tag", async (c) => {
  const form = await c.req.parseBody();
  const stampId = typeof form["stamp_id"] === "string" ? Number(form["stamp_id"]) : NaN;
  const tag = typeof form["tag"] === "string" ? form["tag"] : "";
  if (!Number.isInteger(stampId)) return c.body(null, 400);
  const stamp = await updateStampTag(c.env.DB, stampId, tag);
  if (!stamp) return c.notFound();
  return c.json(await stampToHash(c.env.DB, stamp));
});

export default app;
