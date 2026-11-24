import { Hono } from "hono";
import type { AppEnv } from "../types";
import {
  getNotifyLikeMap,
  setNotifyLikeMap,
  userToHash,
} from "../models";
import { parsePluginKey } from "../plugins/registry";

const app = new Hono<AppEnv>();

/**
 * notify/like プラグインの API（元の /plugin/notify/like/:name 系）。
 * :name はプラグインのラベル（インスタンス ID）。
 * delete モードはそのインスタンスの設定から引く。
 */
function deleteMode(c: { get: (k: "settings") => AppEnv["Variables"]["settings"] }, name: string): "any" | "owner" {
  const settings = c.get("settings");
  for (const [key, opts] of Object.entries(settings.plugin)) {
    const info = parsePluginKey(key);
    if (info && info.genre === "notify" && info.name === "like" && (info.label || "like") === name) {
      return (opts as Record<string, unknown>)["delete"] === "any" ? "any" : "owner";
    }
  }
  return "owner";
}

function instanceLoaded(
  c: { get: (k: "plugins") => AppEnv["Variables"]["plugins"] },
  name: string,
): boolean {
  return c
    .get("plugins")
    .notify.some((p) => p.name === "like" && (p.label || "like") === name);
}

app.get("/plugin/notify/like/:name", async (c) => {
  // パスは /plugin/notify/like/<name>.json の形で来る。
  const raw = c.req.param("name") ?? "";
  const name = raw.endsWith(".json") ? raw.slice(0, -".json".length) : raw;
  if (!instanceLoaded(c, name)) return c.notFound();
  return c.json(await getNotifyLikeMap(c.env.DB, name));
});

app.post("/plugin/notify/like/:name", async (c) => {
  const name = c.req.param("name") ?? "";
  if (!instanceLoaded(c, name)) return c.notFound();
  const me = c.get("currentUser")!;
  const map = await getNotifyLikeMap(c.env.DB, name);
  const icon = userToHash(me).twitter_icon_url_https;
  map[me.massr_id] = [icon, icon];
  await setNotifyLikeMap(c.env.DB, name, map);
  return c.json(map);
});

app.delete("/plugin/notify/like/:name/:user", async (c) => {
  const name = c.req.param("name") ?? "";
  const target = c.req.param("user") ?? "";
  if (!instanceLoaded(c, name)) return c.notFound();
  const me = c.get("currentUser")!;
  const mode = deleteMode(c, name);
  // 元の仕様: "owner" では自分の分だけ、"any" では誰の分でも取り消せる。
  if (mode === "owner" && target !== me.massr_id) {
    return c.json(await getNotifyLikeMap(c.env.DB, name));
  }
  const map = await getNotifyLikeMap(c.env.DB, name);
  delete map[target];
  await setNotifyLikeMap(c.env.DB, name, map);
  return c.json(map);
});

export default app;
