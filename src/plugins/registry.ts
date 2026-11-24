import type { Env } from "../env";
import type { MassrSettings } from "../settings";

/**
 * プラグイン基盤（静的レジストリ方式）。
 *
 * 元の Massr は設定 JSON の plugin セクションのキー（例: "notify/like party"）
 * から genre / クラス名 / ラベルを解釈して動的に読み込んでいた。
 * Workers では実行時のコード読み込みができないため、プラグインは
 * ビルド時に registerPlugin で登録しておき、設定キーの解釈方法だけを
 * 元の仕様に合わせる。
 */

export type PluginGenre = "notify" | "media" | "icon" | "cache";

export interface PluginInfo {
  genre: PluginGenre;
  name: string;
  /** 設定キーで名前の後に空白区切りで与えられるラベル（例: "party"）。 */
  label: string;
  /** "genre/name" 形式の識別子。 */
  id: string;
}

export interface NotifyPlugin extends PluginInfo {
  genre: "notify";
  /** お知らせ欄に差し込む HTML を返す。 */
  render(): Promise<string> | string;
}

export interface MediaPlugin extends PluginInfo {
  genre: "media";
  /**
   * 画像を保存し、配信 URL を返す。
   * maxSize は長辺の上限ピクセル、square は正方形に切り抜く指定。
   */
  upload(
    data: ArrayBuffer,
    contentType: string,
    opts: { maxSize: number; square?: boolean },
  ): Promise<string>;
}

export interface IconPlugin extends PluginInfo {
  genre: "icon";
  /** 現在日時における icon_dir を返す。 */
  iconDir(now: Date): string;
}

export interface CachePlugin extends PluginInfo {
  genre: "cache";
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export type AnyPlugin = NotifyPlugin | MediaPlugin | IconPlugin | CachePlugin;

export interface PluginContext {
  env: Env;
  settings: MassrSettings;
  db: D1Database;
}

export type PluginFactory = (
  info: PluginInfo,
  opts: Record<string, unknown>,
  ctx: PluginContext,
) => AnyPlugin;

const factories = new Map<string, PluginFactory>();

export function registerPlugin(key: string, factory: PluginFactory): void {
  factories.set(key, factory);
}

export interface LoadedPlugins {
  all: AnyPlugin[];
  notify: NotifyPlugin[];
  media: MediaPlugin[];
  icon: IconPlugin[];
  cache: CachePlugin[];
}

/** 設定キーを "genre/name label" として解釈する（元の split 仕様に相当）。 */
export function parsePluginKey(key: string): PluginInfo | null {
  const m = /^(\w+)\/(\w+)(?:\s+(.*))?$/.exec(key.trim());
  if (!m) return null;
  const genre = m[1] as PluginGenre;
  const name = m[2];
  return { genre, name, label: m[3] ?? "", id: `${genre}/${name}` };
}

export function loadPlugins(
  settings: MassrSettings,
  ctx: PluginContext,
): LoadedPlugins {
  const loaded: LoadedPlugins = {
    all: [],
    notify: [],
    media: [],
    icon: [],
    cache: [],
  };
  for (const [key, opts] of Object.entries(settings.plugin)) {
    const info = parsePluginKey(key);
    if (!info) {
      console.warn(`invalid plugin key: ${key}`);
      continue;
    }
    const factory = factories.get(info.id);
    if (!factory) {
      // 元の実装と同様、読み込めないプラグインは警告して読み飛ばす。
      console.warn(`cannot load plugin: ${key}`);
      continue;
    }
    const plugin = factory(info, opts ?? {}, ctx);
    loaded.all.push(plugin);
    switch (plugin.genre) {
      case "notify":
        loaded.notify.push(plugin);
        break;
      case "media":
        loaded.media.push(plugin);
        break;
      case "icon":
        loaded.icon.push(plugin);
        break;
      case "cache":
        loaded.cache.push(plugin);
        break;
    }
  }
  return loaded;
}
