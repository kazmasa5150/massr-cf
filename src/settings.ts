import defaultSettingsJson from "../public/default.json";

/**
 * 設定ファイル（元の public/default.json と同じ構造）。
 * plugin / resource / setting / local の 4 セクションからなる。
 */
export interface MassrSettings {
  plugin: Record<string, Record<string, unknown>>;
  resource: { icon_dir?: string; [key: string]: unknown };
  setting: {
    upload_photo_size: number;
    display_photo_size: number;
    stamp_size: number;
    stamp_thumbnail_size: number;
    [key: string]: unknown;
  };
  local: Record<string, string>;
}

const baseSettings = defaultSettingsJson as MassrSettings;

/**
 * 既定の設定に、環境変数 MASSR_SETTINGS_JSON の差分をセクション単位で
 * 浅くマージしたものを返す（元の MASSR_SETTINGS の仕組みに相当）。
 */
export function loadSettings(env: {
  MASSR_SETTINGS_JSON?: string;
}): MassrSettings {
  // 常にコピーを返す（icon プラグインが resource.icon_dir を差し替えるため、
  // 共有オブジェクトを直接返すとリクエストを跨いで汚染される）。
  const merged: MassrSettings = {
    plugin: { ...baseSettings.plugin },
    resource: { ...baseSettings.resource },
    setting: { ...baseSettings.setting },
    local: { ...baseSettings.local },
  };
  if (!env.MASSR_SETTINGS_JSON) return merged;
  try {
    const custom = JSON.parse(env.MASSR_SETTINGS_JSON) as Partial<MassrSettings>;
    for (const key of ["plugin", "resource", "setting", "local"] as const) {
      if (custom[key]) Object.assign(merged[key], custom[key]);
    }
    return merged;
  } catch {
    console.warn("MASSR_SETTINGS_JSON is not valid JSON; using defaults.");
    return merged;
  }
}

/**
 * ローカル用語を引く（元の _site_name 等のヘルパーに相当）。
 * "%1" "%2" ... は引数で置換される。
 */
export function term(
  settings: MassrSettings,
  key: string,
  ...args: (string | number)[]
): string {
  const value = settings.local[key] ?? key;
  return value.replace(/%(\d+)/g, (_m, n: string) =>
    String(args[Number(n) - 1] ?? ""),
  );
}

/** サイトアイコンのディレクトリ名（icon プラグインが上書きしうる）。 */
export function iconDir(settings: MassrSettings): string {
  return settings.resource.icon_dir || "default";
}
