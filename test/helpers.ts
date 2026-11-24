import { env } from "cloudflare:test";

export const db = () =>
  (env as unknown as { DB: D1Database }).DB;

// 元の spec_helper の prototype_user / prototype_statement に対応する
// テストデータ。twitter_* は元の名残で、移植版では icon_url に読み替える。
export const prototypeUser = (no: 0 | 1) =>
  [
    {
      massr_id: "wasamas",
      twitter_user_id: "00000000",
      twitter_id: "1234567",
      twitter_icon_url: "http://example.com/foo1.png",
      twitter_icon_url_https: "https://example.com/foo1.png",
      name: "わさます",
      email: "wasamas@example.com",
    },
    {
      massr_id: "wasamas2",
      twitter_user_id: "11111111",
      twitter_id: "7654321",
      twitter_icon_url: "http://example.com/foo2.png",
      twitter_icon_url_https: "https://example.com/foo2.png",
      name: "わさます2",
      email: "wasamas2@example.com",
    },
  ][no];

export const createInput = (no: 0 | 1) => {
  const p = prototypeUser(no);
  return {
    massr_id: p.massr_id,
    email: p.email,
    name: p.name,
    icon_url: p.twitter_icon_url,
  };
};

export const prototypeStatement = (no: 0 | 1) =>
  [
    { body: "ほんぶんだよ！", photos: ["http://example.com/foo.jpg"] },
    { body: "ほんぶんだよ２！", photos: ["http://example.com/baa.jpg"] },
  ][no];
