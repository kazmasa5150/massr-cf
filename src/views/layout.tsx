import type { FC, PropsWithChildren } from "hono/jsx";
import { iconDir, term, type MassrSettings } from "../settings";

export interface LayoutUser {
  massr_id: string;
  name: string;
  iconUrl?: string;
  isAdmin?: boolean;
}

export interface SidebarData {
  pins: { word: string; label: string }[];
  members: { massr_id: string; name: string; icon_url: string }[];
}

/**
 * 共通レイアウト（元の head / header / sidebar / footer に相当）。
 * 上部ナビバー＋中央寄せコンテナ（最大 700px）＋右サイドバー＋マサオフッターで、
 * 元の Bootstrap 版の見た目に寄せている（ドロップダウンは平坦なリンクで代替）。
 */
export const Layout: FC<
  PropsWithChildren<{
    title: string;
    settings: MassrSettings;
    me?: LayoutUser | null;
    resSize?: number;
    sidebar?: SidebarData | null;
  }>
> = ({ title, settings, me, resSize = 0, sidebar, children }) => {
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
        <header className="navbar">
          <div className="navbar-inner">
            <a className="brand" href="/">
              {siteName}
            </a>
            {me && (
              <nav className="nav">
                <a href={`/user/${me.massr_id}/res`}>
                  {term(settings, "res")}
                  <span
                    id="res-badge"
                    className="badge"
                    style={resSize > 0 ? "" : "display:none"}
                  >
                    {resSize}
                  </span>
                </a>
                <a href={`/user/${me.massr_id}/photos`}>
                  {term(settings, "user_photos", me.name)}
                </a>
                <a href="/statement/photos">{term(settings, "all_photos")}</a>
                <a href="/stamps">{term(settings, "stamps")}</a>
                <a href={`/user/${me.massr_id}/liked`}>{term(settings, "liked")}</a>
                <a href={`/user/${me.massr_id}/likes`}>{term(settings, "likes")}</a>
                <a href="/users.html">{term(settings, "member")}</a>
                <a href="/user">{term(settings, "settings")}</a>
                {me.isAdmin && <a href="/admin">{term(settings, "admin_menu")}</a>}
                <a href="/logout">{term(settings, "logout")}</a>
                <form className="navbar-search" action="/search" method="get">
                  <input
                    type="text"
                    name="q"
                    className="search-query"
                    placeholder={term(settings, "search")}
                  />
                  <button type="submit" className="btn">
                    {term(settings, "search")}
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <div className="container-fluid">
          <div className="row-fluid">
            <div className={me && sidebar ? "span9" : "span12"}>
              <div className="main">{children}</div>
            </div>
            {me && sidebar && (
              <div className="span3">
                <aside>
                  <div className="well sidebar-nav">
                    <h2>Pin</h2>
                    <ul className="sidebar-list" id="search-pin">
                      {sidebar.pins.map((pin) => (
                        <li className="search-pin">
                          <a
                            href={`/search?q=${encodeURIComponent(pin.word)}`}
                            title={pin.word}
                          >
                            {pin.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <h2>{term(settings, "member")}</h2>
                    <ul className="user-list sidebar-list">
                      {sidebar.members.map((member) => (
                        <li className="user-list">
                          <a href={`/user/${member.massr_id}`}>
                            <img
                              className="massr-icon-mini"
                              src={member.icon_url}
                              alt={member.name}
                              title={member.name}
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              </div>
            )}
          </div>
          <footer
            style={`background-image:url('/img/${iconDir(settings)}/masao_footer.jpg')`}
          >
            <div>Massr (C) The wasam@s production</div>
          </footer>
        </div>
      </body>
    </html>
  );
};
