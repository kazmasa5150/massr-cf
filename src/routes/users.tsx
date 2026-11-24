import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../types";
import {
  PAGE_LIMIT,
  STATUS,
  changeUserStatus,
  clearResNotifications,
  countResNotifications,
  createUser,
  cursorOf,
  deleteUserCascade,
  getRepliesToUser,
  getStatements,
  getUserByMassrId,
  listResNotificationIds,
  listUsers,
  parseDateCursor,
  statementToHash,
  updateUserProfile,
} from "../models";
import { term } from "../settings";
import { PhotosPage, UserFormPage, UserStatementsPage, UsersPage } from "../views/pages";

const app = new Hono<AppEnv>();

const MASSR_ID_PATTERN = /^[A-Za-z0-9_]{1,30}$/;

async function uploadIcon(c: Context<AppEnv>, file: unknown): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const media = c.get("plugins").media[0];
  if (!media) return null;
  // 元の DEFAULT_ICON_SIZE = 90、正方形切り抜き。
  return media.upload(await file.arrayBuffer(), file.type || "application/octet-stream", {
    maxSize: 90,
    square: true,
  });
}

/* ---------- メンバー一覧 ---------- */

app.get("/users.html", async (c) => {
  const me = c.get("currentUser")!;
  const users = await listUsers(c.env.DB);
  return c.html(
    <UsersPage
      settings={c.get("settings")}
      me={me}
      resSize={await countResNotifications(c.env.DB, me.id)}
      users={users}
      unauthCount={users.filter((u) => u.status === STATUS.UNAUTHORIZED).length}
    />,
  );
});

/* ---------- 自分の登録 / プロフィール ---------- */

app.get("/user", (c) => {
  return c.html(
    <UserFormPage
      settings={c.get("settings")}
      me={c.get("currentUser")}
      email={c.get("accessEmail") ?? ""}
    />,
  );
});

app.post("/user", async (c) => {
  const settings = c.get("settings");
  const me = c.get("currentUser");
  const email = c.get("accessEmail")!;
  const form = await c.req.parseBody();
  const name = typeof form["name"] === "string" ? form["name"].trim() : "";
  const iconUrl = await uploadIcon(c, form["newicon"]);

  if (me) {
    // プロフィール更新（massr_id と status は変えない）。
    await updateUserProfile(c.env.DB, me.id, {
      name: name || me.name,
      ...(iconUrl ? { icon_url: iconUrl } : {}),
    });
    return c.redirect("/");
  }

  // 新規登録。最初期のユーザは管理者になる（モデル側で判定）。
  const massrId = typeof form["massr_id"] === "string" ? form["massr_id"].trim() : "";
  if (!MASSR_ID_PATTERN.test(massrId)) {
    return c.html(
      <UserFormPage
        settings={settings}
        me={null}
        email={email}
        error="ID は半角英数字とアンダースコア、30 文字以内で入力してください。"
      />,
    );
  }
  if (await getUserByMassrId(c.env.DB, massrId)) {
    return c.html(
      <UserFormPage
        settings={settings}
        me={null}
        email={email}
        error="その ID は既に使われています。"
      />,
    );
  }
  await createUser(c.env.DB, {
    massr_id: massrId,
    email,
    name: name || massrId,
    icon_url: iconUrl,
  });
  return c.redirect("/");
});

/* ---------- ユーザページ ---------- */

function splitJsonSuffix(raw: string): { key: string; json: boolean } {
  return raw.endsWith(".json")
    ? { key: raw.slice(0, -".json".length), json: true }
    : { key: raw, json: false };
}

app.get("/user/:massr_id", async (c) => {
  const { key, json } = splitJsonSuffix(c.req.param("massr_id"));
  const profile = await getUserByMassrId(c.env.DB, key);
  if (!profile) return c.notFound();
  const statements = await getStatements(c.env.DB, {
    before: parseDateCursor(c.req.query("date")),
    userId: profile.id,
  });
  if (json) return c.json(statements.map(statementToHash));
  const me = c.get("currentUser")!;
  const nextCursor =
    statements.length === PAGE_LIMIT
      ? cursorOf(statements[statements.length - 1].row.created_at)
      : null;
  return c.html(
    <UserStatementsPage
      settings={c.get("settings")}
      me={me}
      resSize={await countResNotifications(c.env.DB, me.id)}
      profile={profile}
      statements={statements.map(statementToHash)}
      nextCursor={nextCursor}
      nextPath={`/user/${profile.massr_id}`}
      heading={`${profile.name}の発言`}
    />,
  );
});

/** 自分（プロフィール主）の発言へのレス一覧。開くと自分の新着通知をクリアする（元の仕様）。 */
async function userResPage(c: Context<AppEnv>, json: boolean) {
  const profile = await getUserByMassrId(c.env.DB, c.req.param("massr_id") ?? "");
  if (!profile) return c.notFound();
  const me = c.get("currentUser")!;
  const pendingIds = await listResNotificationIds(c.env.DB, me.id);
  await clearResNotifications(c.env.DB, me.id);
  const statements = await getRepliesToUser(
    c.env.DB,
    profile.id,
    parseDateCursor(c.req.query("date")),
  );
  if (json) return c.json(statements.map(statementToHash));
  const nextCursor =
    statements.length === PAGE_LIMIT
      ? cursorOf(statements[statements.length - 1].row.created_at)
      : null;
  return c.html(
    <UserStatementsPage
      settings={c.get("settings")}
      me={me}
      resSize={0}
      profile={profile}
      statements={statements.map(statementToHash)}
      nextCursor={nextCursor}
      nextPath={`/user/${profile.massr_id}/res`}
      highlightIds={new Set(pendingIds.map(String))}
      heading={`${profile.name}へのレス`}
    />,
  );
}

app.get("/user/:massr_id/res", (c) => userResPage(c, false));
app.get("/user/:massr_id/res.json", (c) => userResPage(c, true));

/* ---------- 写真 / liked / likes ページ（元の user_photos 等） ---------- */

async function userListPage(
  c: Context<AppEnv>,
  json: boolean,
  kind: "photos" | "liked" | "likes",
) {
  const profile = await getUserByMassrId(c.env.DB, c.req.param("massr_id") ?? "");
  if (!profile) return c.notFound();
  const before = parseDateCursor(c.req.query("date"));
  const query =
    kind === "photos"
      ? { before, userId: profile.id, hasPhotos: true }
      : kind === "liked"
        ? { before, userId: profile.id, hasLikes: true }
        : { before, likedBy: profile.id };
  const statements = await getStatements(c.env.DB, query);
  if (json) return c.json(statements.map(statementToHash));
  const me = c.get("currentUser")!;
  const settings = c.get("settings");
  const resSize = await countResNotifications(c.env.DB, me.id);
  if (kind === "photos") {
    const nextCursor =
      statements.length === PAGE_LIMIT
        ? cursorOf(statements[statements.length - 1].row.created_at)
        : null;
    return c.html(
      <PhotosPage
        settings={settings}
        me={me}
        resSize={resSize}
        title={`${profile.name} - ${term(settings, "photos")}`}
        statements={statements.map(statementToHash)}
        nextCursor={nextCursor}
        nextPath={`/user/${profile.massr_id}/photos`}
      />,
    );
  }
  const nextCursor =
    statements.length === PAGE_LIMIT
      ? cursorOf(statements[statements.length - 1].row.created_at)
      : null;
  return c.html(
    <UserStatementsPage
      settings={settings}
      me={me}
      resSize={resSize}
      profile={profile}
      statements={statements.map(statementToHash)}
      nextCursor={nextCursor}
      nextPath={`/user/${profile.massr_id}/${kind}`}
      heading={
        kind === "liked"
          ? `${profile.name}の${term(settings, "liked")}`
          : `${profile.name}の${term(settings, "likes")}`
      }
    />,
  );
}

app.get("/user/:massr_id/photos", (c) => userListPage(c, false, "photos"));
app.get("/user/:massr_id/photos.json", (c) => userListPage(c, true, "photos"));
app.get("/user/:massr_id/liked", (c) => userListPage(c, false, "liked"));
app.get("/user/:massr_id/liked.json", (c) => userListPage(c, true, "liked"));
app.get("/user/:massr_id/likes", (c) => userListPage(c, false, "likes"));
app.get("/user/:massr_id/likes.json", (c) => userListPage(c, true, "likes"));

/* ---------- 管理画面（元の /admin。管理者のみ、自分以外の一覧） ---------- */

app.get("/admin", async (c) => {
  const me = c.get("currentUser")!;
  if (me.status !== STATUS.ADMIN) return c.redirect("/");
  const users = (await listUsers(c.env.DB)).filter((u) => u.id !== me.id);
  return c.html(
    <UsersPage
      settings={c.get("settings")}
      me={me}
      resSize={await countResNotifications(c.env.DB, me.id)}
      users={users}
      unauthCount={users.filter((u) => u.status === STATUS.UNAUTHORIZED).length}
      headingKey="admin_menu"
    />,
  );
});

/* ---------- 管理者操作（元の PUT / DELETE /user/:massr_id） ---------- */

async function adminChangeStatus(c: Context<AppEnv>, massrId: string): Promise<boolean> {
  const me = c.get("currentUser");
  if (!me || me.status !== STATUS.ADMIN) return false;
  const form = await c.req.parseBody();
  const status = Number(form["status"]);
  await changeUserStatus(c.env.DB, massrId, status);
  return true;
}

async function adminDeleteUser(c: Context<AppEnv>, massrId: string): Promise<boolean> {
  const me = c.get("currentUser");
  if (!me || me.status !== STATUS.ADMIN) return false;
  const target = await getUserByMassrId(c.env.DB, massrId);
  if (target) await deleteUserCascade(c.env.DB, target);
  return true;
}

app.put("/user/:massr_id", async (c) => {
  const ok = await adminChangeStatus(c, c.req.param("massr_id"));
  return ok ? c.body(null, 204) : c.redirect("/");
});

app.delete("/user/:massr_id", async (c) => {
  const ok = await adminDeleteUser(c, c.req.param("massr_id"));
  return ok ? c.body(null, 204) : c.redirect("/");
});

/** HTML フォームからの管理者操作（_method による振り分け、JS なしでも動くように）。 */
app.post("/user/:massr_id", async (c) => {
  const massrId = c.req.param("massr_id");
  const form = await c.req.parseBody();
  const method = typeof form["_method"] === "string" ? form["_method"] : "";
  // parseBody は一度読むと再読できないため、状態変更はここで直接行う。
  const me = c.get("currentUser");
  if (!me || me.status !== STATUS.ADMIN) return c.redirect("/");
  if (method === "put") {
    await changeUserStatus(c.env.DB, massrId, Number(form["status"]));
  } else if (method === "delete") {
    const target = await getUserByMassrId(c.env.DB, massrId);
    if (target) await deleteUserCascade(c.env.DB, target);
  }
  return c.redirect("/users.html");
});

export default app;
