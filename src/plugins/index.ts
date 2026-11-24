import { registerPlugin, type CachePlugin, type MediaPlugin } from "./registry";

/**
 * 組み込みプラグインの登録。
 * ここに登録されたものだけが設定 JSON から有効化できる。
 *
 * - cache/none: キャッシュなし（元の「キャッシュプラグインが無ければ
 *   memcached を使う」既定動作に対する、Cloudflare 版の無効実装）
 * - media/cloudflare: R2 に保存して Worker 経由で配信する画像アップロード。
 *   リサイズは配信時の Cloudflare Images 変換を想定するが、wrangler dev や
 *   workers.dev では /cdn-cgi/image が使えないため、Phase 1 では原寸保存・
 *   原寸配信とし、表示サイズは CSS で制限する（カスタムドメイン運用時に
 *   変換 URL へ切り替える）。
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

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

registerPlugin("media/cloudflare", (info, _opts, ctx): MediaPlugin => ({
  ...info,
  genre: "media",
  async upload(data, contentType) {
    const ext = EXT_BY_TYPE[contentType] ?? "bin";
    const key = `media/${Date.now().toString(36)}-${crypto.randomUUID()}.${ext}`;
    await ctx.env.MEDIA.put(key, data, {
      httpMetadata: { contentType },
    });
    return `/${key}`;
  },
}));

// Phase 2 で追加予定:
// - notify/information（お知らせ欄の固定文）
// - notify/like（全体イイネ）
// - icon/rotate（月替わりアイコン）
