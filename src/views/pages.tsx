import type { FC } from "hono/jsx";
import { iconDir, term, type MassrSettings } from "../settings";
import {
  STATUS,
  userToHash,
  type StatementHash,
  type UserRow,
} from "../models";
import { Layout, type LayoutUser, type SidebarData } from "./layout";
import { PostForm, StatementItem, StatementList } from "./statement";

interface PageProps {
  settings: MassrSettings;
  me: UserRow | null;
  resSize?: number;
  sidebar?: SidebarData | null;
}

function layoutUser(me: UserRow | null): LayoutUser | null {
  if (!me) return null;
  const hash = userToHash(me);
  return {
    massr_id: me.massr_id,
    name: me.name,
    iconUrl: hash.icon_url,
    isAdmin: me.status === STATUS.ADMIN,
  };
}

/** ミドルウェアが用意したサイドバー材料をビュー用に変換する。 */
export function toSidebarData(
  sidebar: { pins: { word: string; label: string }[]; members: UserRow[] } | null,
): SidebarData | null {
  if (!sidebar) return null;
  return {
    pins: sidebar.pins,
    members: sidebar.members.map((m) => ({
      massr_id: m.massr_id,
      name: m.name,
      icon_url: userToHash(m).icon_url,
    })),
  };
}

/* ---------- タイムライン ---------- */

export const TimelinePage: FC<
  PageProps & {
    statements: StatementHash[];
    nextCursor: string | null;
    notifyHtml?: string[];
  }
> = ({ settings, me, resSize, sidebar, statements, nextCursor, notifyHtml }) => (
  <Layout
    title={term(settings, "site_name")}
    settings={settings}
    me={layoutUser(me)}
    resSize={resSize} sidebar={sidebar}
  >
    {notifyHtml && notifyHtml.length > 0 && (
      <>
        {notifyHtml.map((html) => (
          <div className="alert alert-info" dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </>
    )}
    <PostForm settings={settings} />
    <StatementList statements={statements} settings={settings} meMassrId={me?.massr_id ?? ""} />
    {nextCursor && (
      <p className="pagination">
        <a href={`/?date=${nextCursor}`}>← older</a>
      </p>
    )}
  </Layout>
);

/* ---------- ユーザの発言一覧 / レス一覧 ---------- */

export const UserStatementsPage: FC<
  PageProps & {
    profile: UserRow;
    statements: StatementHash[];
    nextCursor: string | null;
    nextPath: string;
    highlightIds?: Set<string>;
    heading: string;
  }
> = ({ settings, me, resSize, sidebar, profile, statements, nextCursor, nextPath, highlightIds, heading }) => {
  const icon = userToHash(profile).twitter_icon_url_https;
  return (
    <Layout
      title={`${profile.name} - ${term(settings, "site_name")}`}
      settings={settings}
      me={layoutUser(me)}
      resSize={resSize} sidebar={sidebar}
    >
      <h1 className="profile-head">
        <img className="icon" src={icon} alt={profile.name} />
        {profile.name}
        <span className="massr-id">@{profile.massr_id}</span>
      </h1>
      <p className="profile-links">
        <a href={`/user/${profile.massr_id}`}>{heading}</a>
        {" / "}
        <a href={`/user/${profile.massr_id}/res`}>{term(settings, "res")}</a>
      </p>
      <StatementList
        statements={statements}
        settings={settings}
        meMassrId={me?.massr_id ?? ""}
        highlightIds={highlightIds}
      />
      {nextCursor && (
        <p className="pagination">
          <a href={`${nextPath}?date=${nextCursor}`}>← older</a>
        </p>
      )}
    </Layout>
  );
};

/* ---------- 発言単体 ---------- */

export const StatementPage: FC<PageProps & { statement: StatementHash }> = ({
  settings,
  me,
  resSize,
  sidebar,
  statement,
}) => (
  <Layout
    title={term(settings, "site_name")}
    settings={settings}
    me={layoutUser(me)}
    resSize={resSize} sidebar={sidebar}
  >
    <StatementItem s={statement} settings={settings} meMassrId={me?.massr_id ?? ""} />
  </Layout>
);

/* ---------- 登録 / プロフィール ---------- */

export const UserFormPage: FC<
  PageProps & { email: string; error?: string }
> = ({ settings, me, sidebar, email, error }) => {
  const isRegister = me === null;
  const icon = me ? userToHash(me).twitter_icon_url_https : null;
  return (
    <Layout
      title={term(settings, isRegister ? "registration" : "settings")}
      settings={settings}
      me={layoutUser(me)}
      sidebar={sidebar}
    >
      <h1>{term(settings, isRegister ? "registration" : "basic_setting")}</h1>
      {isRegister && <p>{term(settings, "user_info_update")}</p>}
      {error && <p className="error">{error}</p>}
      <form action="/user" method="post" enctype="multipart/form-data" className="user-form">
        {isRegister && (
          <p>
            <label>
              ID
              <input type="text" name="massr_id" required pattern="[A-Za-z0-9_]{1,30}" />
            </label>
          </p>
        )}
        <p>
          <label>
            {term(settings, "display_name")}
            <input type="text" name="name" value={me?.name ?? ""} required />
          </label>
        </p>
        <p>
          <label>
            {term(settings, "icon")}
            {icon && <img className="icon" src={icon} alt="" />}
            <span className="photo-button">{term(settings, "upload_icon")}</span>
            <input type="file" name="newicon" accept="image/*" className="file-hidden" />
          </label>
          <span className="note">{term(settings, "icon_size_info")}</span>
        </p>
        <p className="note">Email: {email}</p>
        <button type="submit">{term(settings, isRegister ? "registration" : "save")}</button>
      </form>
    </Layout>
  );
};

/* ---------- メンバー一覧 ---------- */

function statusLabel(settings: MassrSettings, status: number): string {
  if (status === STATUS.ADMIN) return "ADMIN";
  if (status === STATUS.AUTHORIZED) return term(settings, "authorize_user");
  return term(settings, "unauthorized");
}

export const UsersPage: FC<
  PageProps & { users: UserRow[]; unauthCount: number; headingKey?: string }
> = ({ settings, me, resSize, sidebar, users, unauthCount, headingKey }) => {
  const iAmAdmin = me?.status === STATUS.ADMIN;
  const heading = term(settings, headingKey ?? "member");
  return (
    <Layout
      title={`${heading} - ${term(settings, "site_name")}`}
      settings={settings}
      me={layoutUser(me)}
      resSize={resSize} sidebar={sidebar}
    >
      <h1>{heading}</h1>
      {iAmAdmin && unauthCount > 0 && (
        <p className="notice">{term(settings, "unauth_count", unauthCount)}</p>
      )}
      <ul className="users">
        {users.map((u) => {
          const icon = userToHash(u).twitter_icon_url_https;
          const isMe = me?.id === u.id;
          return (
            <li className="user-row">
              <a href={`/user/${u.massr_id}`}>
                <img className="icon" src={icon} alt={u.name} />
                {u.name}
              </a>
              <span className="massr-id">@{u.massr_id}</span>
              <span className="status">{statusLabel(settings, u.status)}</span>
              {iAmAdmin && !isMe && (
                <span className="admin-actions">
                  {u.status === STATUS.UNAUTHORIZED && (
                    <form method="post" action={`/user/${u.massr_id}`}>
                      <input type="hidden" name="_method" value="put" />
                      <input type="hidden" name="status" value={String(STATUS.AUTHORIZED)} />
                      <button type="submit">{term(settings, "authorize_user")}</button>
                    </form>
                  )}
                  {u.status === STATUS.AUTHORIZED && (
                    <>
                      <form method="post" action={`/user/${u.massr_id}`}>
                        <input type="hidden" name="_method" value="put" />
                        <input type="hidden" name="status" value={String(STATUS.UNAUTHORIZED)} />
                        <button type="submit">{term(settings, "unauthorize_user")}</button>
                      </form>
                      <form method="post" action={`/user/${u.massr_id}`}>
                        <input type="hidden" name="_method" value="put" />
                        <input type="hidden" name="status" value={String(STATUS.ADMIN)} />
                        <button type="submit">{term(settings, "privilege_user")}</button>
                      </form>
                    </>
                  )}
                  {u.status === STATUS.ADMIN && (
                    <form method="post" action={`/user/${u.massr_id}`}>
                      <input type="hidden" name="_method" value="put" />
                      <input type="hidden" name="status" value={String(STATUS.AUTHORIZED)} />
                      <button type="submit">{term(settings, "unprivilege_user")}</button>
                    </form>
                  )}
                  <form
                    method="post"
                    action={`/user/${u.massr_id}`}
                    onsubmit="return confirm('削除しますか?')"
                  >
                    <input type="hidden" name="_method" value="delete" />
                    <button type="submit">{term(settings, "delete_user")}</button>
                  </form>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Layout>
  );
};

/* ---------- ログイン / 未認可 ---------- */

export const LoginPage: FC<{ settings: MassrSettings }> = ({ settings }) => (
  <Layout title={term(settings, "site_name")} settings={settings} me={null}>
    <p>{term(settings, "need_login")}</p>
    <p className="note">
      このサイトは Cloudflare Access で保護されています。許可されたメールアドレスで
      Access にサインインしてください（開発時は x-dev-email ヘッダーまたは DEV_EMAIL で
      疑似ログインできます）。
    </p>
  </Layout>
);

export const UnauthorizedPage: FC<PageProps> = ({ settings, me }) => {
  // 元の unauthorized.haml: マサオ画像（masao.jpg / masao2.jpg / masao3.jpg からランダム）が目印。
  // watch_authorize.js がこの id="masao" の有無で認可状態を判定する。
  const masao = ["/img/masao.jpg", "/img/masao2.jpg", "/img/masao3.jpg"][
    Math.floor(Math.random() * 3)
  ];
  return (
    <Layout
      title={term(settings, "site_name")}
      settings={settings}
      me={layoutUser(me)}
    >
      <h1>{term(settings, "site_name")}</h1>
      <p>{term(settings, "unauthorized")}</p>
      <p>
        <img id="masao" src={masao} alt="" />
      </p>
      <script src="/js/watch_authorize.js" defer />
    </Layout>
  );
};

/* ---------- 検索 ---------- */

export const SearchPage: FC<
  PageProps & {
    q: string;
    statements: StatementHash[];
    pins: { word: string; label: string }[];
    nextCursor: string | null;
  }
> = ({ settings, me, resSize, sidebar, q, statements, pins, nextCursor }) => (
  <Layout
    title={`${term(settings, "search")}: ${q} - ${term(settings, "site_name")}`}
    settings={settings}
    me={layoutUser(me)}
    resSize={resSize} sidebar={sidebar}
  >
    <h1>
      {term(settings, "search")}: {q}
    </h1>
    <div className="search-pins">
      {pins.map((pin) => (
        <span className="pin">
          <a href={`/search?q=${encodeURIComponent(pin.word)}`}>{pin.label}</a>
          <button type="button" data-pin-delete={pin.word} title="ピンを外す">
            <i className="gicon gicon-remove"></i>
          </button>
        </span>
      ))}
      {!pins.some((p) => p.word === q) && (
        <button type="button" data-pin-add={q} title="この検索をピン留め">
          <i className="gicon gicon-share-alt"></i>
        </button>
      )}
    </div>
    <StatementList statements={statements} settings={settings} meMassrId={me?.massr_id ?? ""} />
    {nextCursor && (
      <p className="pagination">
        <a href={`/search?q=${encodeURIComponent(q)}&date=${nextCursor}`}>← older</a>
      </p>
    )}
  </Layout>
);

/* ---------- 写真一覧 ---------- */

export const PhotosPage: FC<
  PageProps & {
    title: string;
    statements: StatementHash[];
    nextCursor: string | null;
    nextPath: string;
  }
> = ({ settings, me, resSize, sidebar, title, statements, nextCursor, nextPath }) => (
  <Layout title={title} settings={settings} me={layoutUser(me)} resSize={resSize} sidebar={sidebar}>
    <h1>{term(settings, "photos")}</h1>
    <div className="photo-grid">
      {statements.flatMap((s) =>
        s.photos.map((url) => (
          <figure className="photo-cell">
            <a href={`/statement/${s.id}`}>
              <img src={url} alt={s.body ?? ""} />
            </a>
            <figcaption>
              <a href={`/user/${s.user.massr_id}`}>{s.user.name}</a>
              <span className="created-at">{s.created_at}</span>
            </figcaption>
          </figure>
        )),
      )}
    </div>
    {nextCursor && (
      <p className="pagination">
        <a href={`${nextPath}?date=${nextCursor}`}>← older</a>
      </p>
    )}
  </Layout>
);

/* ---------- スタンプ一覧 ---------- */

export const StampsPage: FC<
  PageProps & { stamps: import("../models").StampHash[] }
> = ({ settings, me, resSize, sidebar, stamps }) => (
  <Layout
    title={`${term(settings, "stamps")} - ${term(settings, "site_name")}`}
    settings={settings}
    me={layoutUser(me)}
    resSize={resSize} sidebar={sidebar}
  >
    <h1>{term(settings, "stamps")}</h1>
    <div className="stamp-grid">
      {stamps.map((stamp) => (
        <figure className="stamp-cell">
          <img src={stamp.image_url} alt={stamp.tag ?? "stamp"} />
          <figcaption>
            <span className="stamp-popular">★{stamp.popular}</span>
            {stamp.original && (
              <a href={`/statement/${stamp.original.id}`}>元の発言</a>
            )}
            <form className="stamp-tag-form" data-stamp-tag-form={stamp.id}>
              <input type="text" name="tag" value={stamp.tag ?? ""} placeholder="タグ" />
              <button type="submit">タグ保存</button>
            </form>
            <form method="post" action="/stamp">
              <input type="hidden" name="_method" value="delete" />
              <input type="hidden" name="image_url" value={stamp.image_url} />
              <button type="submit">{term(settings, "unuse_stamp")}</button>
            </form>
          </figcaption>
        </figure>
      ))}
    </div>
  </Layout>
);
