import type { FC } from "hono/jsx";
import { term, type MassrSettings } from "../settings";
import {
  STATUS,
  userToHash,
  type StatementHash,
  type UserRow,
} from "../models";
import { Layout, type LayoutUser } from "./layout";
import { PostForm, StatementItem, StatementList } from "./statement";

interface PageProps {
  settings: MassrSettings;
  me: UserRow | null;
  resSize?: number;
}

function layoutUser(me: UserRow | null): LayoutUser | null {
  return me ? { massr_id: me.massr_id, name: me.name } : null;
}

/* ---------- タイムライン ---------- */

export const TimelinePage: FC<
  PageProps & { statements: StatementHash[]; nextCursor: string | null }
> = ({ settings, me, resSize, statements, nextCursor }) => (
  <Layout
    title={term(settings, "site_name")}
    settings={settings}
    me={layoutUser(me)}
    resSize={resSize}
  >
    {/* お知らせ欄（notify プラグイン）は Phase 2 でここに差し込む */}
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
> = ({ settings, me, resSize, profile, statements, nextCursor, nextPath, highlightIds, heading }) => {
  const icon = userToHash(profile).twitter_icon_url_https;
  return (
    <Layout
      title={`${profile.name} - ${term(settings, "site_name")}`}
      settings={settings}
      me={layoutUser(me)}
      resSize={resSize}
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
  statement,
}) => (
  <Layout
    title={term(settings, "site_name")}
    settings={settings}
    me={layoutUser(me)}
    resSize={resSize}
  >
    <StatementItem s={statement} settings={settings} meMassrId={me?.massr_id ?? ""} />
  </Layout>
);

/* ---------- 登録 / プロフィール ---------- */

export const UserFormPage: FC<
  PageProps & { email: string; error?: string }
> = ({ settings, me, email, error }) => {
  const isRegister = me === null;
  const icon = me ? userToHash(me).twitter_icon_url_https : null;
  return (
    <Layout
      title={term(settings, isRegister ? "registration" : "settings")}
      settings={settings}
      me={layoutUser(me)}
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
            <input type="file" name="newicon" accept="image/*" />
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
  PageProps & { users: UserRow[]; unauthCount: number }
> = ({ settings, me, resSize, users, unauthCount }) => {
  const iAmAdmin = me?.status === STATUS.ADMIN;
  return (
    <Layout
      title={`${term(settings, "member")} - ${term(settings, "site_name")}`}
      settings={settings}
      me={layoutUser(me)}
      resSize={resSize}
    >
      <h1>{term(settings, "member")}</h1>
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
    <h1>{term(settings, "site_name")}</h1>
    <p>{term(settings, "need_login")}</p>
    <p className="note">
      このサイトは Cloudflare Access で保護されています。許可されたメールアドレスで
      Access にサインインしてください（開発時は x-dev-email ヘッダーまたは DEV_EMAIL で
      疑似ログインできます）。
    </p>
  </Layout>
);

export const UnauthorizedPage: FC<PageProps> = ({ settings, me }) => (
  <Layout
    title={term(settings, "site_name")}
    settings={settings}
    me={layoutUser(me)}
  >
    <h1>{term(settings, "site_name")}</h1>
    <p>{term(settings, "unauthorized")}</p>
  </Layout>
);
