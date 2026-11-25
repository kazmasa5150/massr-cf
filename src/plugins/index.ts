import {
  detectImageType,
  registerPlugin,
  type CachePlugin,
  type IconPlugin,
  type MediaPlugin,
  type NotifyPlugin,
} from "./registry";
import { getNotifyLikeMap } from "../models";

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
};

registerPlugin("media/cloudflare", (info, _opts, ctx): MediaPlugin => ({
  ...info,
  genre: "media",
  async upload(data, _contentType) {
    // 申告された Content-Type は使わず、実バイトで判定した形式だけを保存する。
    const type = detectImageType(data);
    if (!type) throw new Error("unsupported media type");
    const key = `media/${Date.now().toString(36)}-${crypto.randomUUID()}.${EXT_BY_TYPE[type]}`;
    await ctx.env.MEDIA.put(key, data, {
      httpMetadata: { contentType: type },
    });
    return `/${key}`;
  },
}));

/**
 * お知らせ欄の固定文（元の notify/information）。
 * 設定例: "notify/information news": { "message": "お知らせ文" }
 * ラベルがインスタンス ID になる。
 */
registerPlugin("notify/information", (info, opts): NotifyPlugin => ({
  ...info,
  genre: "notify",
  render() {
    const message = opts["message"];
    return typeof message === "string" ? message : "";
  },
}));

/**
 * 全体イイネ（元の notify/like）。出欠確認のような使い方をする。
 * 設定例: "notify/like party": { "label": "参加しますか？", "delete": "owner" }
 * delete は "owner"（自分の分だけ取消可）か "any"（誰の分でも取消可）。
 * 状態は plugin_settings に元の JSON 形式で保存する。
 */
registerPlugin("notify/like", (info, opts, ctx): NotifyPlugin => {
  const instanceId = info.label || "like";
  const labelText = typeof opts["label"] === "string" ? opts["label"] : "";
  const deleteMode = opts["delete"] === "any" ? "any" : "owner";
  return {
    ...info,
    genre: "notify",
    async render() {
      const likes = await getNotifyLikeMap(ctx.db, instanceId);
      const icons = Object.entries(likes)
        .map(([user, [, https]]) =>
          deleteMode === "any"
            ? `<a href="#" data-notify-like-delete="${instanceId}" data-user="${user}"><img class="massr-icon-mini" src="${https}" alt="${user}" title="delete ${user}"></a>`
            : `<img class="massr-icon-mini" src="${https}" alt="${user}">`,
        )
        .join("");
      return (
        `<div class="notify-like" data-notify-like="${instanceId}">` +
        `<span class="notify-like-label">${labelText}</span> ` +
        `<span class="notify-like-icons">${icons}</span> ` +
        `<button type="button" data-notify-like-add="${instanceId}"><img src="/img/wakaruwa.png" alt="">わかるわ</button> ` +
        `<button type="button" data-notify-like-remove="${instanceId}"><img src="/img/wakaranaiwa.png" alt="">わからないわ</button>` +
        `</div>`
      );
    },
  };
});

/**
 * 月替わりアイコン（元の icon/rotate）。
 * icon_dir を現在月（"01"〜"12"）に差し替える。画像は public/img/<月>/ に置く。
 */
registerPlugin("icon/rotate", (info): IconPlugin => ({
  ...info,
  genre: "icon",
  iconDir(now: Date) {
    return String(now.getMonth() + 1).padStart(2, "0");
  },
}));
