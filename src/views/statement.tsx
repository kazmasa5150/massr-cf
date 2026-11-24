import type { FC } from "hono/jsx";
import { term, type MassrSettings } from "../settings";
import type { StatementHash } from "../models";

/** 本文の改行を <br> にし、URL はそのまま表示する（元の表示に寄せた最小実装）。 */
const Body: FC<{ text: string }> = ({ text }) => (
  <>
    {text.split("\n").map((line, i) => (
      <>
        {i > 0 && <br />}
        {line}
      </>
    ))}
  </>
);

/**
 * 発言 1 件の表示（元の statement パーシャルに相当）。
 * イイネ・レス・削除ボタンを持ち、操作は app.js が fetch で行う。
 */
export const StatementItem: FC<{
  s: StatementHash;
  settings: MassrSettings;
  meMassrId: string;
  highlight?: boolean;
}> = ({ s, settings, meMassrId, highlight }) => {
  const liked = s.likes.some((l) => l.user.massr_id === meMassrId);
  const likeLabel = term(settings, "like");
  const resLabel = s.body ? s.body.slice(0, 40) : "";
  return (
    <article
      className={highlight ? "statement highlight" : "statement"}
      data-statement-id={s.id}
    >
      <div className="statement-head">
        <a href={`/user/${s.user.massr_id}`}>
          <img className="icon" src={s.user.twitter_icon_url_https} alt={s.user.name} />
        </a>
        <span className="author">
          <a href={`/user/${s.user.massr_id}`}>{s.user.name}</a>
          <span className="massr-id">@{s.user.massr_id}</span>
        </span>
        <a className="created-at" href={`/statement/${s.id}`}>
          {s.created_at}
        </a>
      </div>

      {s.res && (
        <div className="res-quote">
          <span className="res-quote-head">
            {term(settings, "res")} to {s.res.user.name}:
          </span>
          <span className="res-quote-body">{s.res.body ?? ""}</span>
        </div>
      )}

      {s.body && (
        <p className="statement-body">
          <Body text={s.body} />
        </p>
      )}

      {s.stamp && (
        <p className="statement-stamp">
          <img src={s.stamp} alt="stamp" />
        </p>
      )}

      {s.photos.length > 0 && (
        <div className="statement-photos">
          {s.photos.map((url) => (
            <p>
              <a href={url}>
                <img src={url} alt="photo" />
              </a>
              <button
                type="button"
                className="stamp-add-btn"
                data-stamp-add={s.id}
                data-image-url={url}
              >
                {term(settings, "use_stamp")}
              </button>
            </p>
          ))}
        </div>
      )}

      <div className="statement-actions">
        <button
          type="button"
          className={liked ? "like-btn liked" : "like-btn"}
          data-like-btn={s.id}
          data-liked={liked ? "1" : "0"}
        >
          {likeLabel}
          <span className="like-count">{s.likes.length > 0 ? s.likes.length : ""}</span>
        </button>
        <button
          type="button"
          className="res-btn"
          data-res-btn={s.id}
          data-res-label={resLabel}
        >
          {term(settings, "post_res")}
        </button>
        {s.user.massr_id === meMassrId && (
          <button type="button" className="delete-btn" data-delete-btn={s.id}>
            {term(settings, "delete")}
          </button>
        )}
        <span className="likers" data-likers={s.id}>
          {s.likes.map((l) => (
            <img
              className="liker-icon"
              src={l.user.twitter_icon_url_https}
              alt={l.user.name}
              title={l.user.name}
            />
          ))}
        </span>
      </div>
    </article>
  );
};

export const StatementList: FC<{
  statements: StatementHash[];
  settings: MassrSettings;
  meMassrId: string;
  highlightIds?: Set<string>;
}> = ({ statements, settings, meMassrId, highlightIds }) => (
  <div className="statements">
    {statements.map((s) => (
      <StatementItem
        s={s}
        settings={settings}
        meMassrId={meMassrId}
        highlight={highlightIds?.has(s.id) ?? false}
      />
    ))}
  </div>
);

/** 投稿フォーム（元の index の投稿欄に相当）。写真添付とレス指定を持つ。 */
export const PostForm: FC<{ settings: MassrSettings }> = ({ settings }) => (
  <form className="post-form" action="/statement" method="post" enctype="multipart/form-data">
    <div id="res-banner" className="res-banner" style="display:none">
      <span id="res-banner-text"></span>
      <button type="button" id="res-cancel">
        ×
      </button>
    </div>
    <input type="hidden" name="res_id" id="res-id-input" value="" />
    <input type="hidden" name="stamp" id="stamp-url-input" value="" />
    <input type="hidden" name="stamp_id" id="stamp-id-input" value="" />
    <textarea name="body" rows={3} placeholder=""></textarea>
    <div id="stamp-preview" className="stamp-preview" style="display:none">
      <img id="stamp-preview-img" src="" alt="stamp" />
      <button type="button" id="stamp-clear">
        ×
      </button>
    </div>
    <div id="stamp-tray" className="stamp-tray" style="display:none"></div>
    <div className="post-form-row">
      <label>
        {term(settings, "attach_photo")}
        <input type="file" name="photo" accept="image/*" />
      </label>
      <button type="button" id="stamp-toggle">
        {term(settings, "attach_stamp")}
      </button>
      <button type="submit">{term(settings, "post")}</button>
    </div>
  </form>
);
