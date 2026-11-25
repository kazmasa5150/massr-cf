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
                  data-use-label={term(settings, "use_stamp")}
                  data-unuse-label={term(settings, "unuse_stamp")}
                  title={term(settings, "use_stamp")}
                >
                  <i className="gicon gicon-ok-circle"></i>
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
              <i className="gicon gicon-trash"></i>
            </a>
          )}
          <a href="#" data-stamp-open={s.id} title={term(settings, "attach_stamp")}>
            <i className="gicon gicon-th"></i>
          </a>
          <a href="#" data-res-btn={s.id} title={term(settings, "res")}>
            <i className="gicon gicon-comment"></i>
            {s.ref_ids.length > 0 ? `(${s.ref_ids.length})` : ""}
          </a>
          <a
            href="#"
            className={liked ? "like-button unlike" : "like-button like"}
            data-like-btn={s.id}
            data-liked={liked ? "1" : "0"}
            data-like-label={term(settings, "like")}
            data-unlike-label={term(settings, "unlike")}
            title={liked ? term(settings, "unlike") : term(settings, "like")}
          >
            <img
              className="like-icon"
              src={liked ? "/img/wakaruwa.png" : "/img/wakaranaiwa.png"}
              alt={liked ? term(settings, "unlike") : term(settings, "like")}
            />
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

        {/* レスフォーム（元の .response / form.res-form）。レスボタンで開閉する。 */}
        <div className="response" id={`res-form-${s.id}`} hidden>
          <form
            method="post"
            action="/statement"
            enctype="multipart/form-data"
            className="res-form"
          >
            <div>
              <textarea name="body"></textarea>
            </div>
            <input type="hidden" name="res_id" value={s.id} />
            <div className="res-form-buttons">
              <button type="submit" className="btn btn-small">
                {term(settings, "post_res")}
              </button>
              <label className="photo-button" title={term(settings, "attach_photo")}>
                <i className="gicon gicon-camera"></i>
                <input type="file" name="photo" accept="image/*" multiple />
              </label>
            </div>
          </form>
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

/**
 * 投稿フォーム（元の index の .new-post に相当）。
 * スタンプは元の仕様どおり、ボタンでポップアップを開いて選ぶと即投稿される
 * （フォームに添付する方式ではない）。ポップアップ本体は app.js が構築する。
 */
export const PostForm: FC<{ settings: MassrSettings }> = ({ settings }) => (
  <div className="new-post">
    <form
      id="form-new"
      className="post-form"
      action="/statement"
      method="post"
      enctype="multipart/form-data"
    >
      <div>
        <textarea id="text-new" name="body"></textarea>
      </div>
      <div className="button">
        <button className="btn btn-small submit" type="submit">
          {term(settings, "post")}
        </button>
        <span className="photo-items">
          <label className="photo-button" title={term(settings, "attach_photo")}>
            <i className="gicon gicon-camera"></i>
            <input type="file" name="photo" accept="image/*" multiple />
          </label>
        </span>
        <span className="stamp-items">
          <button
            type="button"
            className="stamp-button"
            data-stamp-open=""
            title={term(settings, "attach_stamp")}
          >
            <i className="gicon gicon-th"></i>
          </button>
        </span>
      </div>
    </form>
  </div>
);
