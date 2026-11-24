import type { Env } from "./env";
import type { MassrSettings } from "./settings";
import type { LoadedPlugins } from "./plugins/registry";
import type { UserRow } from "./models";

/** Hono アプリ全体で共有するコンテキスト変数。 */
export interface Variables {
  accessEmail: string | null;
  settings: MassrSettings;
  plugins: LoadedPlugins;
  currentUser: UserRow | null;
  sidebar: {
    pins: { word: string; label: string }[];
    members: UserRow[];
  } | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: Variables;
}
