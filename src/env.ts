/** Worker のバインディングと環境変数の型。 */
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  /** "production" 以外では開発用の疑似認証が有効になる。 */
  ENVIRONMENT?: string;
  /** 開発用: このメールアドレスでログインしたことにする。 */
  DEV_EMAIL?: string;
  /** 開発/本番共通: default.json への差分上書き（JSON 文字列）。 */
  MASSR_SETTINGS_JSON?: string;
}
