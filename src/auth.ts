import type { Context } from "hono";
import type { Env } from "./env";

/**
 * Cloudflare Access が付けた認証ヘッダーからメールアドレスを取り出す。
 *
 * 本番では Access が必ずこのヘッダーを付ける前提。
 * 開発時（ENVIRONMENT が "production" でない場合）は、ヘッダー
 * `x-dev-email` または環境変数 DEV_EMAIL で疑似ログインできる。
 */
export function resolveAccessEmail<E extends { Bindings: Env }>(
  c: Context<E>,
): string | null {
  const fromAccess = c.req.header("cf-access-authenticated-user-email");
  if (fromAccess) return fromAccess;
  if (c.env.ENVIRONMENT !== "production") {
    return c.req.header("x-dev-email") ?? c.env.DEV_EMAIL ?? null;
  }
  return null;
}
