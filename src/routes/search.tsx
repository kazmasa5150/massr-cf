import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../types";
import {
  PAGE_LIMIT,
  countResNotifications,
  createSearchPin,
  cursorOf,
  deleteSearchPin,
  getStatements,
  listSearchPins,
  parseDateCursor,
  statementToHash,
  updateSearchPinLabel,
} from "../models";
import { SearchPage, toSidebarData } from "../views/pages";

const app = new Hono<AppEnv>();

/** q パラメータ（元の before フィルタ相当: 無ければトップへ、前後の空白は除去）。 */
function queryParam(c: Context<AppEnv>): { q: string; raw: string } | null {
  const raw = c.req.query("q");
  if (raw === undefined) return null;
  return { q: raw.trim(), raw };
}

app.get("/search", async (c) => {
  const param = queryParam(c);
  if (!param || param.q.length === 0) return c.redirect("/");
  if (param.q !== param.raw) {
    return c.redirect(`/search?q=${encodeURIComponent(param.q)}`);
  }
  const me = c.get("currentUser")!;
  const [statements, pins, resSize] = await Promise.all([
    getStatements(c.env.DB, {
      before: parseDateCursor(c.req.query("date")),
      search: param.q,
    }),
    listSearchPins(c.env.DB),
    countResNotifications(c.env.DB, me.id),
  ]);
  const nextCursor =
    statements.length === PAGE_LIMIT
      ? cursorOf(statements[statements.length - 1].row.created_at)
      : null;
  return c.html(
    <SearchPage
      sidebar={toSidebarData(c.get("sidebar"))}
      settings={c.get("settings")}
      me={me}
      resSize={resSize}
      q={param.q}
      statements={statements.map(statementToHash)}
      pins={pins}
      nextCursor={nextCursor}
    />,
  );
});

app.get("/search.json", async (c) => {
  const param = queryParam(c);
  if (!param) return c.redirect("/");
  const statements = await getStatements(c.env.DB, {
    before: parseDateCursor(c.req.query("date")),
    search: param.q,
  });
  return c.json(statements.map(statementToHash));
});

/* ---------- 検索ピン（元の /search/pin 系） ---------- */

app.get("/search/pins.json", async (c) => {
  const pins = await listSearchPins(c.env.DB);
  // 元の実装は {'q' => h[pin.word]} というバグで常に null を返していた。
  // ここでは意図された形 {q: word, label} を返す。
  return c.json(pins.map((p) => ({ q: p.word, label: p.label })));
});

app.post("/search/pin", async (c) => {
  const form = await c.req.parseBody();
  const q = typeof form["q"] === "string" ? form["q"].trim() : "";
  const label = typeof form["label"] === "string" && form["label"] ? form["label"] : null;
  if (!q) return c.body(null, 400);
  const pin = await createSearchPin(c.env.DB, q, label);
  if (!pin) return c.body(null, 409);
  return c.json([{ q: pin.word, label: pin.label }]);
});

app.put("/search/pin", async (c) => {
  const form = await c.req.parseBody();
  const q = typeof form["q"] === "string" ? form["q"] : "";
  const label = typeof form["label"] === "string" ? form["label"] : "";
  const pin = await updateSearchPinLabel(c.env.DB, q, label);
  if (!pin) return c.body(null, 404);
  return c.json([{ q: pin.word, label: pin.label }]);
});

app.delete("/search/pin", async (c) => {
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const q =
    (typeof form["q"] === "string" ? form["q"] : undefined) ?? c.req.query("q") ?? "";
  const pin = await deleteSearchPin(c.env.DB, q);
  if (!pin) return c.body(null, 404);
  return c.json([{ q: pin.word, label: pin.label }]);
});

export default app;
