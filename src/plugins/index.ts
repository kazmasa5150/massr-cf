import { registerPlugin, type CachePlugin, type MediaPlugin } from "./registry";

/**
 * 組み込みプラグインの登録。
 * ここに登録されたものだけが設定 JSON から有効化できる。
 *
 * Phase 0 で用意するもの:
 * - cache/none: キャッシュなし（元の「キャッシュプラグインが無ければ
 *   memcached を使う」既定動作に対する、Cloudflare 版の無効実装）
 * - media/cloudflare: R2 + Images 変換による画像アップロード。
 *   インターフェースのみで、実装は Phase 1 で行う。
 */

registerPlugin("cache/none", (info): CachePlugin => ({
  ...info,
  genre: "cache",
  async get() {
    return null;
  },
  async set() {},
  async delete() {},
}));

registerPlugin("media/cloudflare", (info): MediaPlugin => ({
  ...info,
  genre: "media",
  async upload() {
    throw new Error("media/cloudflare: upload is implemented in Phase 1");
  },
}));

// Phase 2 で追加予定:
// - notify/information（お知らせ欄の固定文）
// - notify/like（全体イイネ）
// - icon/rotate（月替わりアイコン）
