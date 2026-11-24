import type { FC, PropsWithChildren } from "hono/jsx";
import { term, type MassrSettings } from "../settings";

export interface LayoutUser {
  massr_id: string;
  name: string;
}

/**
 * 共通レイアウト（元の head / header / footer に相当）。
 * ヘッダーにはメンバー一覧・設定へのリンクと、レス新着バッジを置く。
 */
export const Layout: FC<
  PropsWithChildren<{
    title: string;
    settings: MassrSettings;
    me?: LayoutUser | null;
    resSize?: number;
  }>
> = ({ title, settings, me, resSize = 0, children }) => {
  const siteName = term(settings, "site_name");
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/css/app.css" />
        <script src="/js/app.js" defer />
      </head>
      <body data-me={me?.massr_id ?? ""}>
        <header className="site-header">
          <a className="site-name" href="/">
            {siteName}
          </a>
          {me && (
            <nav className="site-nav">
              <a href="/users.html">{term(settings, "member")}</a>
              <a href="/user">{term(settings, "settings")}</a>
              <a href={`/user/${me.massr_id}/res`}>
                {term(settings, "res")}
                <span
                  id="res-badge"
                  className="res-badge"
                  style={resSize > 0 ? "" : "display:none"}
                >
                  {resSize}
                </span>
              </a>
              <a href="/logout">{term(settings, "logout")}</a>
            </nav>
          )}
        </header>
        <div className="container">
          <main>{children}</main>
        </div>
        <footer className="site-footer">{siteName}</footer>
      </body>
    </html>
  );
};
