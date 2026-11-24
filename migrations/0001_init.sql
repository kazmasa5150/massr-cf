-- massr-cf initial schema (Phase 0)
-- 元の MongoDB コレクションを D1 テーブルに対応させたもの。
-- 日時は Unix 秒（UTC）で保持し、表示時に JST へ変換する。

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  massr_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE, -- Cloudflare Access の識別子
  name TEXT NOT NULL DEFAULT '',
  icon_url TEXT,
  status INTEGER NOT NULL DEFAULT 9, -- 0=管理者 / 1=認可済 / 9=未認可
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT,
  stamp_url TEXT,
  res_id INTEGER REFERENCES statements(id), -- レス先の発言
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_statements_created ON statements (created_at DESC);
CREATE INDEX idx_statements_user ON statements (user_id, created_at DESC);
CREATE INDEX idx_statements_res ON statements (res_id);

CREATE TABLE statement_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id INTEGER NOT NULL REFERENCES statements(id),
  url TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_photos_statement ON statement_photos (statement_id);

CREATE TABLE likes (
  statement_id INTEGER NOT NULL REFERENCES statements(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (statement_id, user_id)
);
CREATE INDEX idx_likes_user ON likes (user_id);

CREATE TABLE stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL UNIQUE,
  popular INTEGER NOT NULL DEFAULT 0,
  tag TEXT,
  original_statement_id INTEGER REFERENCES statements(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE search_pins (
  word TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE res_notifications (
  user_id INTEGER NOT NULL REFERENCES users(id),
  statement_id INTEGER NOT NULL REFERENCES statements(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, statement_id)
);

CREATE TABLE plugin_settings (
  plugin TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (plugin, key)
);
