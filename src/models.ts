/**
 * データ層。元の Mongoid モデル（User / Statement / Like）の振る舞いを
 * D1 上に再現する。JSON 出力は元の to_hash の形に合わせる。
 */

export const STATUS = { ADMIN: 0, AUTHORIZED: 1, UNAUTHORIZED: 9 } as const;
export const PAGE_LIMIT = 20;

export interface UserRow {
  id: number;
  massr_id: string;
  email: string;
  name: string;
  icon_url: string | null;
  status: number;
  created_at: number;
  updated_at: number;
}

export interface StatementRow {
  id: number;
  user_id: number;
  body: string | null;
  stamp_url: string | null;
  res_id: number | null;
  created_at: number;
  updated_at: number;
  // 著者（JOIN で取得）
  author_massr_id: string;
  author_name: string;
  author_email: string;
  author_icon_url: string | null;
  author_status: number;
}

/** デフォルトアイコン（登録時に icon_url が無い場合の表示用）。 */
export const DEFAULT_ICON_URL = "/img/default-icon.svg";

/* ---------- 日時ユーティリティ（JST 表示、元の localtime 前提） ---------- */

const JST_OFFSET_SEC = 9 * 60 * 60;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Unix 秒 → "YYYY-MM-DD HH:MM:SS"（JST）。元の strftime 形式。 */
export function formatJst(sec: number): string {
  const d = new Date((sec + JST_OFFSET_SEC) * 1000);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/** Unix 秒 → ページング用カーソル "YYYYMMDDHHMMSS"（JST）。元の param_date 形式。 */
export function cursorOf(sec: number): string {
  return formatJst(sec).replace(/[-: ]/g, "");
}

/**
 * date パラメータを Unix 秒に変換する。
 * 14 桁（JST の YYYYMMDDHHMMSS）を主に受け付け、Unix 秒と ISO 形式も許容する。
 * 省略時は元の通り「現在 + 10 秒」。
 */
export function parseDateCursor(param: string | undefined | null): number {
  if (!param) return Math.floor(Date.now() / 1000) + 10;
  if (/^\d{14}$/.test(param)) {
    const y = Number(param.slice(0, 4));
    const mo = Number(param.slice(4, 6)) - 1;
    const d = Number(param.slice(6, 8));
    const h = Number(param.slice(8, 10));
    const mi = Number(param.slice(10, 12));
    const s = Number(param.slice(12, 14));
    return Math.floor(Date.UTC(y, mo, d, h, mi, s) / 1000) - JST_OFFSET_SEC;
  }
  if (/^\d{1,10}$/.test(param)) return Number(param);
  const t = Date.parse(param);
  if (!Number.isNaN(t)) return Math.floor(t / 1000);
  return Math.floor(Date.now() / 1000) + 10;
}

/* ---------- User ---------- */

export interface UserHash {
  id: string;
  massr_id: string;
  name: string;
  email: string;
  status: number;
  icon_url: string;
  twitter_icon_url: string;
  twitter_icon_url_https: string;
}

export interface LikeHash {
  id: string;
  user: UserHash;
}

export interface StatementHash {
  id: string;
  created_at: string;
  body: string | null;
  user: UserHash;
  likes: LikeHash[];
  ref_ids: string[];
  res: StatementHash | null;
  photos: string[];
  stamp: string | null;
}

export function userToHash(u: {
  id: number;
  massr_id: string;
  email: string;
  name: string;
  icon_url: string | null;
  status: number;
}): UserHash {
  const icon = u.icon_url ?? DEFAULT_ICON_URL;
  return {
    id: String(u.id),
    massr_id: u.massr_id,
    name: u.name,
    email: u.email,
    status: u.status,
    icon_url: icon,
    // 元のクライアント互換のため、Twitter アイコン欄にも同じ URL を入れる。
    twitter_icon_url: icon,
    twitter_icon_url_https: icon,
  };
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<UserRow | null> {
  return (
    (await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first<UserRow>()) ?? null
  );
}

export async function getUserByMassrId(
  db: D1Database,
  massrId: string,
): Promise<UserRow | null> {
  return (
    (await db
      .prepare("SELECT * FROM users WHERE massr_id = ?")
      .bind(massrId)
      .first<UserRow>()) ?? null
  );
}

/** 登録。最初期のユーザは管理者になる（元の update_profile の仕様）。 */
export async function createUser(
  db: D1Database,
  input: { massr_id: string; email: string; name: string; icon_url?: string | null },
): Promise<UserRow> {
  const now = Math.floor(Date.now() / 1000);
  const count = await db
    .prepare("SELECT COUNT(*) AS c FROM users")
    .first<{ c: number }>();
  const status = count && count.c === 0 ? STATUS.ADMIN : STATUS.UNAUTHORIZED;
  const res = await db
    .prepare(
      "INSERT INTO users (massr_id, email, name, icon_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(input.massr_id, input.email, input.name, input.icon_url ?? null, status, now, now)
    .run();
  const user = await getUserByMassrId(db, input.massr_id);
  if (!user) throw new Error(`createUser failed: ${res.error ?? "unknown"}`);
  return user;
}

/** プロフィール更新（名前とアイコンのみ。massr_id と status は変えない）。 */
export async function updateUserProfile(
  db: D1Database,
  userId: number,
  input: { name: string; icon_url?: string | null },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  if (input.icon_url !== undefined) {
    await db
      .prepare("UPDATE users SET name = ?, icon_url = ?, updated_at = ? WHERE id = ?")
      .bind(input.name, input.icon_url, now, userId)
      .run();
  } else {
    await db
      .prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?")
      .bind(input.name, now, userId)
      .run();
  }
}

export async function listUsers(db: D1Database): Promise<UserRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all<UserRow>();
  return results;
}

/** 現在の管理者数。管理者が 0 人になる操作を防ぐためのガードに使う。 */
export async function countAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE status = ?")
    .bind(STATUS.ADMIN)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** 管理者によるステータス変更（元の change_status: 0/1/9 以外は無視）。 */
export async function changeUserStatus(
  db: D1Database,
  massrId: string,
  status: number,
): Promise<void> {
  if (![STATUS.ADMIN, STATUS.AUTHORIZED, STATUS.UNAUTHORIZED].includes(status as 0)) {
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("UPDATE users SET status = ?, updated_at = ? WHERE massr_id = ?")
    .bind(status, now, massrId)
    .run();
}

/** 管理者によるユーザ削除。本人の発言と、他人の発言へのイイネも消す（元の delete_all_statements 相当）。 */
export async function deleteUserCascade(
  db: D1Database,
  user: UserRow,
): Promise<void> {
  const stmts = await db
    .prepare("SELECT id FROM statements WHERE user_id = ?")
    .bind(user.id)
    .all<{ id: number }>();
  const ids = stmts.results.map((r) => r.id);
  const batch: D1PreparedStatement[] = [
    db.prepare("DELETE FROM likes WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM res_notifications WHERE user_id = ?").bind(user.id),
  ];
  for (const id of ids) {
    batch.push(db.prepare("DELETE FROM statement_photos WHERE statement_id = ?").bind(id));
    batch.push(db.prepare("DELETE FROM likes WHERE statement_id = ?").bind(id));
    batch.push(db.prepare("DELETE FROM res_notifications WHERE statement_id = ?").bind(id));
    batch.push(db.prepare("UPDATE stamps SET original_statement_id = NULL WHERE original_statement_id = ?").bind(id));
    batch.push(db.prepare("UPDATE statements SET res_id = NULL WHERE res_id = ?").bind(id));
  }
  batch.push(db.prepare("DELETE FROM statements WHERE user_id = ?").bind(user.id));
  batch.push(db.prepare("DELETE FROM users WHERE id = ?").bind(user.id));
  await db.batch(batch);
}

/* ---------- Statement ---------- */

export interface HydratedStatement {
  row: StatementRow;
  photos: string[];
  likes: { user: ReturnType<typeof userToHash> }[];
  refIds: string[];
  res: HydratedStatement | null;
}

const STATEMENT_SELECT = `
  SELECT s.*, u.massr_id AS author_massr_id, u.name AS author_name,
         u.email AS author_email, u.icon_url AS author_icon_url,
         u.status AS author_status
  FROM statements s JOIN users u ON u.id = s.user_id`;

async function hydrate(
  db: D1Database,
  rows: StatementRow[],
  depth = 0,
): Promise<HydratedStatement[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");

  const photosRes = await db
    .prepare(`SELECT statement_id, url FROM statement_photos WHERE statement_id IN (${ph}) ORDER BY sort, id`)
    .bind(...ids)
    .all<{ statement_id: number; url: string }>();
  const photosBy = new Map<number, string[]>();
  for (const p of photosRes.results) {
    const arr = photosBy.get(p.statement_id) ?? [];
    arr.push(p.url);
    photosBy.set(p.statement_id, arr);
  }

  const likesRes = await db
    .prepare(
      `SELECT l.statement_id, u.id, u.massr_id, u.email, u.name, u.icon_url, u.status
       FROM likes l JOIN users u ON u.id = l.user_id
       WHERE l.statement_id IN (${ph}) ORDER BY l.created_at`,
    )
    .bind(...ids)
    .all<{
      statement_id: number;
      id: number;
      massr_id: string;
      email: string;
      name: string;
      icon_url: string | null;
      status: number;
    }>();
  const likesBy = new Map<number, HydratedStatement["likes"]>();
  for (const l of likesRes.results) {
    const arr = likesBy.get(l.statement_id) ?? [];
    arr.push({ user: userToHash(l) });
    likesBy.set(l.statement_id, arr);
  }

  const refsRes = await db
    .prepare(`SELECT id, res_id FROM statements WHERE res_id IN (${ph}) ORDER BY created_at`)
    .bind(...ids)
    .all<{ id: number; res_id: number }>();
  const refsBy = new Map<number, string[]>();
  for (const r of refsRes.results) {
    const arr = refsBy.get(r.res_id) ?? [];
    arr.push(String(r.id));
    refsBy.set(r.res_id, arr);
  }

  // レス先（res）のハイドレーション。元の to_hash は res を再帰的に含む。
  const resIds = [...new Set(rows.map((r) => r.res_id).filter((v): v is number => v !== null))];
  const resBy = new Map<number, HydratedStatement>();
  if (resIds.length > 0 && depth < 10) {
    const rph = resIds.map(() => "?").join(",");
    const resRows = await db
      .prepare(`${STATEMENT_SELECT} WHERE s.id IN (${rph})`)
      .bind(...resIds)
      .all<StatementRow>();
    for (const h of await hydrate(db, resRows.results, depth + 1)) {
      resBy.set(h.row.id, h);
    }
  }

  return rows.map((row) => ({
    row,
    photos: photosBy.get(row.id) ?? [],
    likes: likesBy.get(row.id) ?? [],
    refIds: refsBy.get(row.id) ?? [],
    res: row.res_id !== null ? (resBy.get(row.res_id) ?? null) : null,
  }));
}

export function statementToHash(h: HydratedStatement): StatementHash {
  return {
    id: String(h.row.id),
    created_at: formatJst(h.row.created_at),
    body: h.row.body,
    user: userToHash({
      id: h.row.user_id,
      massr_id: h.row.author_massr_id,
      email: h.row.author_email,
      name: h.row.author_name,
      icon_url: h.row.author_icon_url,
      status: h.row.author_status,
    }),
    likes: h.likes.map((l, i) => ({ id: `${h.row.id}_${i}`, user: l.user })),
    ref_ids: h.refIds,
    res: h.res ? statementToHash(h.res) : null,
    photos: h.photos,
    stamp: h.row.stamp_url,
  };
}

export interface StatementQuery {
  before: number;
  userId?: number;
  hasPhotos?: boolean;
  onlyIds?: number[];
  /** そのユーザがイイネした発言のみ（元の likes ページ）。 */
  likedBy?: number;
  /** イイネが付いている発言のみ（元の liked ページ）。 */
  hasLikes?: boolean;
  /** 本文の部分一致検索（元の正規表現検索を LIKE で代替）。 */
  search?: string;
}

/** 元の get_statements: created_at < date の新しい順に $limit 件。 */
export async function getStatements(
  db: D1Database,
  q: StatementQuery,
): Promise<HydratedStatement[]> {
  const where: string[] = ["s.created_at < ?"];
  const binds: unknown[] = [q.before];
  if (q.userId !== undefined) {
    where.push("s.user_id = ?");
    binds.push(q.userId);
  }
  if (q.hasPhotos) {
    where.push("EXISTS (SELECT 1 FROM statement_photos p WHERE p.statement_id = s.id)");
  }
  if (q.hasLikes) {
    where.push("EXISTS (SELECT 1 FROM likes l WHERE l.statement_id = s.id)");
  }
  if (q.likedBy !== undefined) {
    where.push("EXISTS (SELECT 1 FROM likes l WHERE l.statement_id = s.id AND l.user_id = ?)");
    binds.push(q.likedBy);
  }
  if (q.search) {
    where.push("s.body LIKE ? ESCAPE '\\'");
    binds.push(`%${q.search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  if (q.onlyIds) {
    if (q.onlyIds.length === 0) return [];
    where.push(`s.id IN (${q.onlyIds.map(() => "?").join(",")})`);
    binds.push(...q.onlyIds);
  }
  const { results } = await db
    .prepare(
      `${STATEMENT_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.created_at DESC LIMIT ${PAGE_LIMIT}`,
    )
    .bind(...binds)
    .all<StatementRow>();
  return hydrate(db, results);
}

export async function getStatementById(
  db: D1Database,
  id: number,
): Promise<HydratedStatement | null> {
  const row = await db
    .prepare(`${STATEMENT_SELECT} WHERE s.id = ?`)
    .bind(id)
    .first<StatementRow>();
  if (!row) return null;
  const [h] = await hydrate(db, [row]);
  return h ?? null;
}

/**
 * 発言を作成する。レスの場合はレス先の著者へ新着通知を記録する
 * （元の res_ids への push に相当。自分宛のレスは通知しない）。
 */
export async function createStatement(
  db: D1Database,
  input: {
    userId: number;
    body: string | null;
    stampUrl: string | null;
    resId: number | null;
    photos: string[];
  },
): Promise<HydratedStatement> {
  const now = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare(
      "INSERT INTO statements (user_id, body, stamp_url, res_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(input.userId, input.body, input.stampUrl, input.resId, now, now)
    .run();
  const id = Number(res.meta.last_row_id);
  const batch: D1PreparedStatement[] = input.photos.map((url, i) =>
    db
      .prepare("INSERT INTO statement_photos (statement_id, url, sort) VALUES (?, ?, ?)")
      .bind(id, url, i),
  );
  if (input.resId !== null) {
    const target = await db
      .prepare("SELECT user_id FROM statements WHERE id = ?")
      .bind(input.resId)
      .first<{ user_id: number }>();
    if (target && target.user_id !== input.userId) {
      batch.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO res_notifications (user_id, statement_id, created_at) VALUES (?, ?, ?)",
          )
          .bind(target.user_id, id, now),
      );
    }
  }
  if (batch.length > 0) await db.batch(batch);
  const created = await getStatementById(db, id);
  if (!created) throw new Error("createStatement: row vanished");
  return created;
}

/** 発言の削除（発言者本人のみ。呼び出し側で権限を確認すること）。 */
export async function deleteStatement(db: D1Database, id: number): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM statement_photos WHERE statement_id = ?").bind(id),
    db.prepare("DELETE FROM likes WHERE statement_id = ?").bind(id),
    db.prepare("DELETE FROM res_notifications WHERE statement_id = ?").bind(id),
    db.prepare("UPDATE stamps SET original_statement_id = NULL WHERE original_statement_id = ?").bind(id),
    db.prepare("UPDATE statements SET res_id = NULL WHERE res_id = ?").bind(id),
    db.prepare("DELETE FROM statements WHERE id = ?").bind(id),
  ]);
}

/* ---------- Like ---------- */

export async function addLike(
  db: D1Database,
  statementId: number,
  userId: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT OR IGNORE INTO likes (statement_id, user_id, created_at) VALUES (?, ?, ?)")
    .bind(statementId, userId, now)
    .run();
}

export async function removeLike(
  db: D1Database,
  statementId: number,
  userId: number,
): Promise<void> {
  await db
    .prepare("DELETE FROM likes WHERE statement_id = ? AND user_id = ?")
    .bind(statementId, userId)
    .run();
}

/* ---------- レス新着通知（元の user.res_ids） ---------- */

export async function countResNotifications(
  db: D1Database,
  userId: number,
): Promise<number> {
  const r = await db
    .prepare("SELECT COUNT(*) AS c FROM res_notifications WHERE user_id = ?")
    .bind(userId)
    .first<{ c: number }>();
  return r?.c ?? 0;
}

export async function listResNotificationIds(
  db: D1Database,
  userId: number,
): Promise<number[]> {
  const { results } = await db
    .prepare("SELECT statement_id FROM res_notifications WHERE user_id = ?")
    .bind(userId)
    .all<{ statement_id: number }>();
  return results.map((r) => r.statement_id);
}

export async function clearResNotifications(
  db: D1Database,
  userId: number,
): Promise<void> {
  await db
    .prepare("DELETE FROM res_notifications WHERE user_id = ?")
    .bind(userId)
    .run();
}

/** 自分の発言へのレス一覧（元の /user/:massr_id/res のクエリ）。 */
export async function getRepliesToUser(
  db: D1Database,
  userId: number,
  before: number,
): Promise<HydratedStatement[]> {
  const { results } = await db
    .prepare(
      `${STATEMENT_SELECT}
       WHERE s.res_id IN (SELECT id FROM statements WHERE user_id = ?)
         AND s.created_at < ?
       ORDER BY s.created_at DESC LIMIT ${PAGE_LIMIT}`,
    )
    .bind(userId, before)
    .all<StatementRow>();
  return hydrate(db, results);
}

/* ---------- 検索ピン（元の SearchPin） ---------- */

export interface SearchPinRow {
  word: string;
  label: string;
}

export async function listSearchPins(db: D1Database): Promise<SearchPinRow[]> {
  const { results } = await db
    .prepare("SELECT word, label FROM search_pins ORDER BY word")
    .all<SearchPinRow>();
  return results;
}

/** ピンを作る。word が重複したら null（元の 409 相当）。label 省略時は word と同じ。 */
export async function createSearchPin(
  db: D1Database,
  word: string,
  label: string | null,
): Promise<SearchPinRow | null> {
  const res = await db
    .prepare("INSERT OR IGNORE INTO search_pins (word, label) VALUES (?, ?)")
    .bind(word, label ?? word)
    .run();
  if (res.meta.changes === 0) return null;
  return { word, label: label ?? word };
}

export async function updateSearchPinLabel(
  db: D1Database,
  word: string,
  label: string,
): Promise<SearchPinRow | null> {
  const res = await db
    .prepare("UPDATE search_pins SET label = ? WHERE word = ?")
    .bind(label, word)
    .run();
  if (res.meta.changes === 0) return null;
  return { word, label };
}

export async function deleteSearchPin(
  db: D1Database,
  word: string,
): Promise<SearchPinRow | null> {
  const pin = await db
    .prepare("SELECT word, label FROM search_pins WHERE word = ?")
    .bind(word)
    .first<SearchPinRow>();
  if (!pin) return null;
  await db.prepare("DELETE FROM search_pins WHERE word = ?").bind(word).run();
  return pin;
}

/* ---------- スタンプ（元の Stamp） ---------- */

export interface StampRow {
  id: number;
  image_url: string;
  popular: number;
  tag: string | null;
  original_statement_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface StampHash {
  id: string;
  created_at: string;
  image_url: string;
  tag: string | null;
  popular: number;
  original: StatementHash | null;
}

export async function stampToHash(
  db: D1Database,
  stamp: StampRow,
): Promise<StampHash> {
  let original: StatementHash | null = null;
  if (stamp.original_statement_id !== null) {
    const stmt = await getStatementById(db, stamp.original_statement_id);
    original = stmt ? statementToHash(stmt) : null;
  }
  return {
    id: String(stamp.id),
    created_at: formatJst(stamp.created_at),
    image_url: stamp.image_url,
    tag: stamp.tag,
    popular: stamp.popular,
    original,
  };
}

/**
 * スタンプ一覧（popular 降順）。元の get_stamps と同様、
 * 元発言が消えているスタンプは掃除して返さない。
 */
export async function listStamps(db: D1Database): Promise<StampRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM stamps ORDER BY popular DESC, id ASC")
    .all<StampRow>();
  const alive: StampRow[] = [];
  for (const stamp of results) {
    if (stamp.original_statement_id !== null) {
      const exists = await db
        .prepare("SELECT id FROM statements WHERE id = ?")
        .bind(stamp.original_statement_id)
        .first();
      if (!exists) {
        await db.prepare("DELETE FROM stamps WHERE id = ?").bind(stamp.id).run();
        continue;
      }
    }
    alive.push(stamp);
  }
  return alive;
}

export async function getStampById(
  db: D1Database,
  id: number,
): Promise<StampRow | null> {
  return (
    (await db
      .prepare("SELECT * FROM stamps WHERE id = ?")
      .bind(id)
      .first<StampRow>()) ?? null
  );
}

/** 写真をスタンプに登録する（image_url が一意。既存ならそれを返す）。 */
export async function createStamp(
  db: D1Database,
  imageUrl: string,
  statementId: number,
): Promise<StampRow> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      "INSERT OR IGNORE INTO stamps (image_url, popular, tag, original_statement_id, created_at, updated_at) VALUES (?, 0, NULL, ?, ?, ?)",
    )
    .bind(imageUrl, statementId, now, now)
    .run();
  const stamp = await db
    .prepare("SELECT * FROM stamps WHERE image_url = ?")
    .bind(imageUrl)
    .first<StampRow>();
  if (!stamp) throw new Error("createStamp failed");
  return stamp;
}

export async function deleteStampByUrl(
  db: D1Database,
  imageUrl: string,
): Promise<void> {
  await db.prepare("DELETE FROM stamps WHERE image_url = ?").bind(imageUrl).run();
}

export async function updateStampTag(
  db: D1Database,
  id: number,
  tag: string,
): Promise<StampRow | null> {
  const now = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare("UPDATE stamps SET tag = ?, updated_at = ? WHERE id = ?")
    .bind(tag, now, id)
    .run();
  if (res.meta.changes === 0) return null;
  return getStampById(db, id);
}

/* ---------- プラグイン設定（元の PluginSetting） ---------- */

export async function getPluginSetting(
  db: D1Database,
  plugin: string,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM plugin_settings WHERE plugin = ? AND key = ?")
    .bind(plugin, key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setPluginSetting(
  db: D1Database,
  plugin: string,
  key: string,
  value: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO plugin_settings (plugin, key, value) VALUES (?, ?, ?) ON CONFLICT(plugin, key) DO UPDATE SET value = excluded.value",
    )
    .bind(plugin, key, value)
    .run();
}

/* ---------- notify/like プラグインの状態 ---------- */

/** { massr_id: [icon_url_http, icon_url_https] } の形（元の保存形式）。 */
export type NotifyLikeMap = Record<string, [string, string]>;

export async function getNotifyLikeMap(
  db: D1Database,
  instanceId: string,
): Promise<NotifyLikeMap> {
  const raw = await getPluginSetting(db, "notify/like", instanceId);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as NotifyLikeMap;
  } catch {
    return {};
  }
}

export async function setNotifyLikeMap(
  db: D1Database,
  instanceId: string,
  map: NotifyLikeMap,
): Promise<void> {
  await setPluginSetting(db, "notify/like", instanceId, JSON.stringify(map));
}
