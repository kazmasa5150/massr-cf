import type { FC, PropsWithChildren } from "hono/jsx";
import { term, type MassrSettings } from "../settings";

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
 * 上部ナビバー（写真・わかるわ・設定は元の通りドロップダウン）＋中央寄せコンテナ
 * （最大 700px）＋右サイドバー＋マサオフッターで、元の Bootstrap 版の見た目に寄せている。
 */
export const Layout: FC<
  PropsWithChildren<{
    title: string;
    settings: MassrSettings;
    me?: LayoutUser | null;
    resSize?: number;
    sidebar?: SidebarData | null;
    wide?: boolean;
  }>
> = ({ title, settings, me, resSize = 0, sidebar, wide, children }) => {
  const siteName = term(settings, "site_name");
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/img/apple-touch-icon-57x57.png" sizes="57x57" />
        <link rel="apple-touch-icon" href="/img/apple-touch-icon-72x72.png" sizes="72x72" />
        <link rel="apple-touch-icon" href="/img/apple-touch-icon-114x114.png" sizes="114x114" />
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
                <div className="dropdown">
                  <button type="button" className="dropdown-toggle">
                    {term(settings, "photos")}
                    <b className="caret"></b>
                  </button>
                  <ul className="dropdown-menu">
                    <li>
                      <a href={`/user/${me.massr_id}/photos`}>
                        {term(settings, "user_photos", me.name)}
                      </a>
                    </li>
                    <li>
                      <a href="/statement/photos">{term(settings, "all_photos")}</a>
                    </li>
                    <li>
                      <a href="/stamps">{term(settings, "stamps")}</a>
                    </li>
                  </ul>
                </div>
                <div className="dropdown">
                  <button type="button" className="dropdown-toggle">
                    {term(settings, "like")}
                    <b className="caret"></b>
                  </button>
                  <ul className="dropdown-menu">
                    <li>
                      <a href={`/user/${me.massr_id}/liked`}>
                        {term(settings, "liked")}
                      </a>
                    </li>
                    <li>
                      <a href={`/user/${me.massr_id}/likes`}>
                        {term(settings, "likes")}
                      </a>
                    </li>
                  </ul>
                </div>
                <a href="/users.html">{term(settings, "member")}</a>
                <form className="navbar-search" action="/search" method="get">
                  <input
                    type="text"
                    name="q"
                    className="search-query"
                    placeholder={term(settings, "search")}
                  />
                  <button type="submit" className="btn" title={term(settings, "search")}>
                    <i className="gicon gicon-search"></i>
                  </button>
                </form>
                <div className="dropdown dropdown-right">
                  <button type="button" className="dropdown-toggle">
                    {term(settings, "settings")}
                    <b className="caret"></b>
                  </button>
                  <ul className="dropdown-menu">
                    <li>
                      <a href={`/user/${me.massr_id}`}>
                        {me.iconUrl && (
                          <img className="massr-icon" src={me.iconUrl} alt="" />
                        )}
                        {me.name}
                      </a>
                    </li>
                    <li>
                      <a href="/user">{term(settings, "settings")}</a>
                    </li>
                    {me.isAdmin && (
                      <li>
                        <a href="/admin">{term(settings, "admin_menu")}</a>
                      </li>
                    )}
                    <li className="divider"></li>
                    <li>
                      <a href="/logout">{term(settings, "logout")}</a>
                    </li>
                  </ul>
                </div>
              </nav>
            )}
          </div>
        </header>
        <div className={wide ? "container-fluid wide" : "container-fluid"}>
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
          {me && sidebar ? (
            <footer>
              <div className="row-fluid">
                <div className="span9 footer-credit">
                  <div>Massr (C) The wasam@s production</div>
                </div>
                <div className="span3 footer-masao">
                  <img src="/img/masao_footer.jpg" alt="" />
                </div>
              </div>
            </footer>
          ) : (
            <footer
              className="footer-full"
              style="background-image:url('/img/masao_footer.jpg')"
            >
              <div>Massr (C) The wasam@s production</div>
            </footer>
          )}
        </div>
      </body>
    </html>
  );
};
