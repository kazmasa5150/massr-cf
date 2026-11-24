import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../types";
import {
  addLike,
  countResNotifications,
  createStatement,
  deleteStatement,
  getStatementById,
  removeLike,
  statementToHash,
} from "../models";
import { StatementPage } from "../views/pages";

const app = new Hono<AppEnv>();

/** media プラグインでファイルをアップロードし、URL を返す。写真が無い場合は null。 */
async function uploadPhoto(
  c: Context<AppEnv>,
  file: unknown,
  maxSize: number,
  square = false,
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const media = c.get("plugins").media[0];
  if (!media) return null; // 元の NoPhotoError 相当（メディアプラグイン未設定）
  return media.upload(await file.arrayBuffer(), file.type || "application/octet-stream", {
    maxSize,
    square,
  });
}

/** 投稿（元の POST /statement(.json)）。stamp がある場合はスタンプ投稿。 */
async function postStatement(c: Context<AppEnv>, format: "html" | "json") {
  const me = c.get("currentUser")!;
  const settings = c.get("settings");
  const form = await c.req.parseBody();

  const photoUrl = await uploadPhoto(c, form["photo"], settings.setting.upload_photo_size);
  const photos = photoUrl ? [photoUrl] : [];

  const bodyText = typeof form["body"] === "string" ? form["body"] : "";
  const stamp = typeof form["stamp"] === "string" && form["stamp"] ? form["stamp"] : null;
  const stampId = typeof form["stamp_id"] === "string" ? Number(form["stamp_id"]) : NaN;
  const resIdRaw = typeof form["res_id"] === "string" ? Number(form["res_id"]) : NaN;
  const resId = Number.isInteger(resIdRaw) && resIdRaw > 0 ? resIdRaw : null;

  // 元の仕様: stamp が無ければ body が空の投稿は保存しない。
  const shouldSave = stamp !== null ? stamp.length > 0 : bodyText.length > 0;
  if (!shouldSave) {
    return format === "json"
      ? c.json({ error: "Please enter the body or stamp." }, 400)
      : c.redirect("/");
  }

  const created = await createStatement(c.env.DB, {
    userId: me.id,
    body: bodyText.length > 0 ? bodyText : null,
    stampUrl: stamp,
    resId,
    photos,
  });

  if (stamp !== null && Number.isInteger(stampId)) {
    await c.env.DB.prepare(
      "UPDATE stamps SET popular = popular + 1, updated_at = ? WHERE id = ?",
    )
      .bind(Math.floor(Date.now() / 1000), stampId)
      .run();
  }

  // レス通知メールは Phase 3（Email Sending）で対応する。
  // 本文 URL の自動写真化（async_request）も Phase 3。

  return format === "json" ? c.json(statementToHash(created)) : c.redirect("/");
}

app.post("/statement", (c) => postStatement(c, "html"));
app.post("/statement.json", (c) => postStatement(c, "json"));

function parseIdParam(raw: string): { id: number; json: boolean } {
  const json = raw.endsWith(".json");
  const id = Number(json ? raw.slice(0, -".json".length) : raw);
  return { id, json };
}

app.get("/statement/:id", async (c) => {
  const { id, json } = parseIdParam(c.req.param("id"));
  const statement = Number.isInteger(id) ? await getStatementById(c.env.DB, id) : null;
  if (!statement) return c.notFound();
  if (json) return c.json(statementToHash(statement));
  const me = c.get("currentUser")!;
  return c.html(
    <StatementPage
      settings={c.get("settings")}
      me={me}
      resSize={await countResNotifications(c.env.DB, me.id)}
      statement={statementToHash(statement)}
    />,
  );
});

/** 削除は発言者本人のみ（元の仕様）。 */
app.delete("/statement/:id", async (c) => {
  const me = c.get("currentUser")!;
  const id = Number(c.req.param("id"));
  if (Number.isInteger(id)) {
    const statement = await getStatementById(c.env.DB, id);
    if (statement && statement.row.user_id === me.id) {
      await deleteStatement(c.env.DB, id);
    }
  }
  return c.redirect("/");
});

app.post("/statement/:id/like", async (c) => {
  const me = c.get("currentUser")!;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.notFound();
  await addLike(c.env.DB, id, me.id);
  const statement = await getStatementById(c.env.DB, id);
  if (!statement) return c.notFound();
  return c.json(statementToHash(statement));
});

app.delete("/statement/:id/like", async (c) => {
  const me = c.get("currentUser")!;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.notFound();
  await removeLike(c.env.DB, id, me.id);
  const statement = await getStatementById(c.env.DB, id);
  if (!statement) return c.notFound();
  return c.json(statementToHash(statement));
});

export default app;
