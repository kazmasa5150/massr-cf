import type { FC } from "hono/jsx";
import { term, type MassrSettings } from "../settings";
import type { StatementHash } from "../models";

/**
 * 発言 1 件の表示（元の statement パーシャルの構造に合わせた）。
 * アイコン左寄せ＋本文エリア、情報バー、アクション、わかるわ一覧という元の並び。
 * イイネ・レス・削除の操作は app.js が data-* フック経由で行う。
 */
export const StatementItem: FC<{
  s: StatementHash;
  settings: MassrSettings;
  meMassrId: string;
  highlight?: boolean;
}> = ({ s, settings, meMassrId, highlight }) => {
  const liked = s.likes.some((l) => l.user.massr_id === meMassrId);
  const own = s.user.massr_id === meMassrId;
  const resLabel = s.body ? s.body.slice(0, 40) : "";
  return (
    <div
      className={highlight ? "statement statement-new" : "statement"}
      data-statement-id={s.id}
    >
      <div className="statement-icon">
        <a href={`/user/${s.user.massr_id}`}>
          <img
            className="massr-icon"
            src={s.user.twitter_icon_url_https}
            alt={s.user.name}
          />
        </a>
      </div>
      <div className={own ? "statement-body statement-body-me" : "statement-body"}>
        {s.res && (
          <>
            <div className="statement-res-icon">
              <a href={`/user/${s.res.user.massr_id}`}>
                <img
                  className="massr-icon-mini"
                  src={s.res.user.twitter_icon_url_https}
                  alt={s.res.user.name}
                  title={s.res.user.name}
                />
              </a>
            </div>
            <div className="statement-res">
              <a href={`/statement/${s.res.id}`}>
                &lt; {s.res.body ?? ""}
                {s.res.stamp && <img src={s.res.stamp} alt="stamp" />}
              </a>
            </div>
          </>
        )}

        {s.body && <div className="statement-message">{s.body}</div>}

        {s.stamp && (
          <div className="statement-stamp">
            <div className="stamp-style">
              <div className="stamp">
                <img src={s.stamp} alt="stamp" />
              </div>
            </div>
          </div>
        )}

        {s.photos.length > 0 && (
          <div className={`statement-photos photos-count-${Math.min(s.photos.length, 4)}`}>
            {s.photos.map((url) => (
              <span className="statement-photo-item">
                <a href={url} className="photo-link" data-lightbox-group={`stmt-${s.id}`}>
                  <img className="statement-photo" src={url} alt="photo" />
                </a>
                <button
                  type="button"
                  className="stamp-add-btn"
                  data-stamp-add={s.id}
                  data-image-url={url}
                >
                  {term(settings, "use_stamp")}
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="statement-info">
          by <a href={`/user/${s.user.massr_id}`}>{s.user.name}</a> at{" "}
          <a href={`/statement/${s.id}`}>{s.created_at}</a>
        </div>

        <div className="statement-action">
          {own && (
            <a href="#" data-delete-btn={s.id} title={term(settings, "delete")}>
              {term(settings, "delete")}
            </a>
          )}
          <a
            href="#"
            data-res-btn={s.id}
            data-res-label={resLabel}
            title={term(settings, "res")}
          >
            {term(settings, "res")}
            {s.ref_ids.length > 0 ? `(${s.ref_ids.length})` : ""}
          </a>
          <a
            href="#"
            className={liked ? "like-button unlike" : "like-button like"}
            data-like-btn={s.id}
            data-liked={liked ? "1" : "0"}
            data-like-label={term(settings, "like")}
            data-unlike-label={term(settings, "unlike")}
          >
            <span className="like-label">
              {liked ? term(settings, "unlike") : term(settings, "like")}
            </span>
            <span className="like-count">
              {s.likes.length > 0 ? s.likes.length : ""}
            </span>
          </a>
        </div>

        <div
          className="statement-like"
          style={s.likes.length > 0 ? "" : "display:none"}
        >
          {term(settings, "like")}:
          <span data-likers={s.id}>
            {s.likes.map((l) => (
              <a href={`/user/${l.user.massr_id}`}>
                <img
                  className="massr-icon-mini"
                  src={l.user.twitter_icon_url_https}
                  alt={l.user.name}
                  title={l.user.name}
                />
              </a>
            ))}
          </span>
        </div>
      </div>
    </div>
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

/** 投稿フォーム（元の index の .new-post に相当）。写真添付・スタンプ・レス指定を持つ。 */
export const PostForm: FC<{ settings: MassrSettings }> = ({ settings }) => (
  <div className="new-post">
    <form
      id="form-new"
      className="post-form"
      action="/statement"
      method="post"
      enctype="multipart/form-data"
    >
      <div id="res-banner" className="alert alert-info" style="display:none">
        <span id="res-banner-text"></span>
        <button type="button" id="res-cancel" className="close">
          ×
        </button>
      </div>
      <input type="hidden" name="res_id" id="res-id-input" value="" />
      <input type="hidden" name="stamp" id="stamp-url-input" value="" />
      <input type="hidden" name="stamp_id" id="stamp-id-input" value="" />
      <div>
        <textarea id="text-new" name="body"></textarea>
      </div>
      <div id="stamp-preview" className="stamp-preview" style="display:none">
        <img id="stamp-preview-img" src="" alt="stamp" />
        <button type="button" id="stamp-clear">
          ×
        </button>
      </div>
      <div id="stamp-tray" className="stamp-tray" style="display:none"></div>
      <div className="button">
        <button className="btn btn-small submit" type="submit">
          {term(settings, "post")}
        </button>
        <span className="photo-items">
          <label className="photo-button">
            {term(settings, "attach_photo")}
            <input type="file" name="photo" accept="image/*" multiple />
          </label>
        </span>
        <span className="stamp-items">
          <button type="button" id="stamp-toggle" className="stamp-button">
            {term(settings, "attach_stamp")}
          </button>
        </span>
      </div>
    </form>
  </div>
);
