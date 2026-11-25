# Massr Cloudflare 移植計画書

作成: 2026-11-25 / 対象: wasamas/massr（Ruby 製会員制 SNS）を Cloudflare ネイティブ構成へ作り直す

## 1. 目的と方針

- 元の Massr の**振る舞い・画面・URL 設計・データの意味**をできるだけ忠実に再現する「ベタ移植」とする。ただし Ruby / Sinatra / MongoDB は Workers 上で動作しないため、コードの逐語コピーではなく、元のソースを仕様として読み取り、TypeScript で新規実装する。
- 認証は Cloudflare Access に寄せ、画像などの機能も可能な限り Cloudflare の提供機能で置き換える。
- プラグインの枠組みは残す。ただし Workers では実行時にコードを動的に読み込めないため、プラグインはビルド時に組み込む「静的レジストリ」方式とし、有効化と設定は元の通り設定 JSON の `plugin` セクション（キー形式 `"ジャンル/名前 ラベル"`）で行う。

## 2. 元実装の調査結果（2026-11-25 時点の master）

| 項目 | 内容 |
|---|---|
| 言語 / FW | Ruby 2.6 / Sinatra、ビューは Haml（21 ファイル） |
| DB | MongoDB（Mongoid）。コレクション: users / statements / stamps / search_pins / messages / plugin_settings |
| セッション・キャッシュ | memcached（Rack::Session::Dalli、30 日）。タイムライン JSON・検索結果・スタンプ一覧も memcached にキャッシュ |
| 認証 | Twitter OAuth（OmniAuth）。ログイン後、未登録なら登録フォームへ |
| 画像 | 本体は画像を持たず、メディアプラグイン（Twitter / Picasa / Gyazo）経由で外部サービスへアップロードし URL を保持。リサイズは ImageMagick（RMagick） |
| 規模 | Ruby 約 2,475 行、Haml 約 582 行、自前 JS 約 1,363 行（合計 約 4,500 行） |
| ライセンス | GPL-3.0（著作権: the wasam@s production）。同梱の Bootstrap / jQuery 等は各々のライセンス |

### 元の主な機能

- タイムライン（新着順 20 件、日付カーソルで追加読み込み、30 秒ポーリングで差分更新）
- 投稿（本文・写真添付・スタンプ投稿）、投稿の削除（本人のみ）
- レス（返信）。レス先ユーザーへ新着通知（res_ids）とメール通知
- イイネ（用語カスタマイズで「わかるわ」等に変更可）。イイネした/された一覧ページ
- ユーザーページ（発言一覧、写真一覧、レス一覧、イイネ関連一覧）
- 写真一覧（全体 / ユーザー別）
- スタンプ（写真をスタンプ登録、人気順一覧、タグ付け、投稿時に使用回数カウント）
- 検索（本文の部分一致・大文字小文字無視）と検索ピン（検索語の共有ブックマーク）
- メンバー制の認可フロー: 初回登録者は管理者（status=0）、以降は未認可（status=9）で、管理者が認可（status=1）するまで利用不可ページを表示
- 管理画面: ユーザーの認可/認可取消/管理者任命・剥奪/削除（発言・イイネも一括削除）
- 設定ファイル `public/default.json`（resource / setting / local の 3 セクション。用語やサイト名、画像サイズ等）＋ `MASSR_SETTINGS` 環境変数による差分上書き
- アイコン画像のアップロード（90px 正方形）、サイトアイコンの差し替え（icon_dir）

## 3. 技術対応表

| 元の技術 | 移植先 | 備考 |
|---|---|---|
| Ruby / Sinatra | TypeScript / Hono（Workers） | ルート定義の書き味が近く、対応が取りやすい |
| Haml ビュー | Hono JSX（サーバー描画） | 自動エスケープあり |
| MongoDB（Mongoid） | D1（SQLite） | スキーマは §4 |
| memcached セッション | なし（Cloudflare Access に委譲） | リクエスト毎に Access のヘッダーから利用者を特定 |
| memcached キャッシュ | 初期はなし | この規模では D1 の直接読みで十分。必要になれば Cache API |
| Twitter OAuth | Cloudflare Access | Google / GitHub / メール OTP。許可リスト管理も Access 側 |
| メディアプラグイン（外部画像投稿） | Cloudflare 実装の media プラグイン（保存は R2、リサイズは Images 変換）をデフォルトとして最初から有効化 | アップロード時に長辺 2048px へ制限、表示は Images 変換で 800px。外部サービス連携はしない |
| ImageMagick（RMagick） | Cloudflare Images 変換 | R2 上の画像を配信時にリサイズ |
| 静的ファイル（assets / public） | Workers Static Assets | CSS / JS / 画像 / default.json |
| メール送信（Gmail / SendGrid SMTP） | Cloudflare Email Sending（任意・Phase 3） | 公開ベータ。任意宛先への送信には Workers Paid が必要 |
| Puma / Heroku 前提の運用 | Wrangler / Workers Builds | Git 連携で自動デプロイ |
| New Relic / dbStats 等の運用系 | Workers Logs | DB 統計表示は移植しない |
| プラグイン機構（Ruby の動的ロード） | 静的レジストリ方式 | プラグインはビルド時に組み込み、設定 JSON の `plugin` セクションで有効化・設定する。ジャンル（notify / media / icon / cache）とヘルパーの考え方は元の通り |

## 4. データモデル対応（D1 スキーマ案）

元の JSON 形式（to_hash のキー）は互換を維持し、クライアント JS の書き換えを最小化する。

| D1 テーブル | 主なカラム | 元コレクションとの対応 |
|---|---|---|
| users | id、massr_id（一意）、email（一意、Access の識別子）、name、icon_url、status（0=管理者 / 1=認可済 / 9=未認可）、created_at、updated_at | users。twitter_* 系フィールドは email に置換し廃止 |
| statements | id、user_id、body、stamp_url、res_id（返信先、NULL 可）、created_at、updated_at | statements |
| statement_photos | statement_id、url、sort | statements.photos 配列を分離（写真一覧の検索を SQL で行うため） |
| likes | statement_id、user_id、created_at（主キー: statement_id + user_id） | statements 埋め込み likes |
| stamps | id、image_url（一意）、popular、tag、original_statement_id、created_at、updated_at | stamps |
| search_pins | word（一意）、label | search_pins |
| res_notifications | user_id、statement_id、created_at | users.res_ids 配列を分離。レス一覧を開くと消去 |
| plugin_settings | plugin、key、value（主キー: plugin + key） | plugin_settings。プラグインの状態保存用（notify/like の参加者一覧など） |

- ID は整数の自動採番とし、JSON 出力では文字列化して元の形式に合わせる。
- 日時は元の JSON と同じ `YYYY-MM-DD HH:MM:SS`（JST）形式で出力する。
- ページングは元の方式（created_at が指定日
...[truncated 5269 chars]時より前を条件に 20 件取得する日付カーソル方式）を踏襲し、`.json` 系エンドポイントの `?date=` パラメータ互換を保つ。
- Read Replication は使わない（利用者が日本国内中心で、規模的にも不要なため）。

## 5. ルート対応表

URL パスは元のものをそのまま維持する。元の Massr は現在も稼働中（2026-11-25 に確認）であり、現利用者のブックマークや慣れを壊さないため、パス互換は必須とする。

| 元のルート | 移植先 | 備考 |
|---|---|---|
| GET `/` | そのまま | タイムライン |
| GET `/index.json` | そのまま | キャッシュなしで D1 から直接生成 |
| GET `/ressize.json` / DELETE `/newres` | そのまま | 新着レス件数の取得とクリア |
| POST `/statement`（`.json` 対応） | そのまま | 本文・写真・スタンプ投稿、レス |
| GET `/statement/photos`（`.json`） | そのまま | 全員の写真一覧 |
| GET `/statement/:id`（`.json`） | そのまま | 個別発言ページ |
| DELETE `/statement/:id` | そのまま | 本人のみ |
| POST / DELETE `/statement/:id/like` | そのまま | イイネの付け外し |
| GET `/users.html` | そのまま | メンバー一覧 |
| GET / POST `/user` | そのまま | 登録・プロフィール更新フォーム |
| GET `/user/:massr_id`（`.json`） | そのまま | ユーザーの発言一覧 |
| GET `/user/:massr_id/photos`（`.json`） | そのまま | ユーザーの写真一覧 |
| GET `/user/:massr_id/res`（`.json`） | そのまま | レス一覧。開くと新着通知を消去 |
| GET `/user/:massr_id/liked` / `/likes`（`.json`） | そのまま | イイネされた / した一覧 |
| PUT / DELETE `/user/:massr_id` | そのまま | 管理者によるステータス変更 / ユーザー削除 |
| GET `/admin` | そのまま | 管理画面 |
| GET `/search`（`.json`） | そのまま | 検索は D1 の LIKE で代用（部分一致） |
| GET `/search/pins.json`、POST / PUT / DELETE `/search/pin` | そのまま | 検索ピン |
| POST / DELETE `/stamp`、GET `/stamps`、POST `/stamp/tag` | そのまま | スタンプ登録・削除・一覧・タグ |
| GET `/favicon.ico`、`/img/apple-touch-icon-:size.png` | Static Assets で配信 | icon_dir の差し替えは設定で対応 |
| GET / POST / DELETE `/plugin/notify/like/:name` 系 | そのまま | notify/like プラグインの専用ルート（§7） |
| GET `/login`、`/logout` | Access のログイン / ログアウトへ誘導する案内ページに置換 | 認証自体は Access が担当 |
| GET `/auth/twitter/callback` | 廃止 | Twitter OAuth 自体をなくすため |
| GET `/unauthorized` | そのまま | 未認可ユーザー向けページ |

## 6. 画面対応表

Haml 21 ファイルを JSX コンポーネントへ 1 対 1 で対応させる。

| 元ビュー | 移植先コンポーネント |
|---|---|
| index / statements / statement | Timeline / StatementList / StatementItem |
| user_statements / user_statement | UserStatements / StatementPage |
| photos / photo / user_photos / popup_photo | PhotoGrid / PhotoPage / PopupPhoto |
| users / user | MemberList / ProfileForm |
| admin | AdminPage |
| login / unauthorized / not_found | 案内ページ / UnauthorizedPage / NotFoundPage |
| header / footer / head / sidebar / notify / responses | Layout 部品群 |

CSS は元の Bootstrap 2 系の見た目を目安に新規作成する（Bootstrap 本体は同梱せず、各社のライセンス混在を避ける）。

## 7. 機能別の移植方針

- **認証・認可**: Cloudflare Access が認証を担当し、アプリは `Cf-Access-Authenticated-User-Email` ヘッダーで利用者を特定する。Access の許可リストにあってもアプリ未登録なら登録フォームへ、未認可（status=9）なら `/unauthorized` へ、という元の二段構えをそのまま再現する。初回登録者は自動で管理者になる仕様も踏襲する。
- **投稿・レス・イイネ**: 元の JSON 形式（to_hash）を維持する。レスが付くと res_notifications に記録され、ヘッダーの新着表示と `/ressize.json` で件数を返す。
- **写真**: media プラグイン経由で扱う点は元の通りだが、アップロード先は Cloudflare 実装（R2 保存＋Images 変換）をデフォルトの media プラグインとして最初から有効化する。仕様は元の通り、長辺 2048px（upload_photo_size）制限、表示は Images 変換で 800px（display_photo_size）、アイコンは 90px 正方形に切り抜く。
- **スタンプ**: 写真をスタンプとして登録し、投稿に使うたび popular を加算する元の仕様を踏襲する。スタンプ一覧は人気順。
- **検索**: MongoDB の正規表現検索を D1 の LIKE（部分一致）に置き換える。日本語の部分一致は LIKE で問題なく、検索ピンもそのまま移植する。検索結果のキャッシュは持たない。
  - **正規表現検索の復活は将来の選択肢として保留（2026-11-25 決定: 当面は部分一致のまま）**。D1（SQLite）には REGEXP 関数がなく、自前関数の登録もできないため、SQL では正規表現検索ができない。復活させる場合は Worker 側で実装する: 投稿を作成日時の新しい順にバッチ取得（例: 200 件ずつ）し、JavaScript の正規表現（大文字小文字無視、元の仕様に合わせる）で本文を判定して 20 件そろうまで繰り返す。日付カーソルのページ送りは現行のまま使える。規模（利用者 数十人・1 日数百投稿）では追加の読み込みは問題にならない。注意点は、不正な正規表現はエラーにせず部分一致にフォールバックすること、極端なパターンで処理が固まらないようパターン長に上限を設けること。
- **設定ファイル**: `default.json` を Static Assets で配信し、元の 3 セクション構造と用語（「わかるわ」等）をそのまま使う。カスタム設定の上書きは環境変数または KV で行う。
- **クライアント JS**: 元の massr.js の振る舞い（30 秒ポーリングでの差分更新、日付カーソルでの追加読み込み、投稿フォーム、写真プレビュー、通知表示）をバニラ JS で書き直す。jQuery 等の外部ライブラリには依存しない。
- **CSRF**: Hono の CSRF ミドルウェアで元の Rack::Csrf 相当を確保する。
- **プラグイン**: 枠組みを静的レジストリとして残す。設定 JSON の `plugin` セクションに書かれたキー（`"notify/like party"` のような形式）からジャンル・名前・ラベルを解釈し、組み込み済みプラグインを有効化する。状態保存は plugin_settings テーブルを使う。対象プラグインは次の通り。
  - notify/information（必須）: お知らせ欄に固定文を表示する。
  - notify/like（必須）: お知らせ欄の全体イイネ。専用ルート `/plugin/notify/like/:name` 系とクライアント JS も含めて移植する。
  - icon/rotate（必須）: 月ごとに icon_dir を切り替える。アイコン一式は月別フォルダ（01〜12）を Static Assets に置く。
  - media 系: Cloudflare 実装（R2＋Images 変換）をデフォルトの media プラグインとして最初から有効化する。他の media プラグインを後から差し替えられるよう、インターフェースは元のプラグインと同じ形（リサイズ＋アップロードで URL を返す）にそろえる。
  - cache 系: 枠だけ用意し、当面はキャッシュなしの実装を返す。

## 8. 移植しないもの

| 対象 | 理由 |
|---|---|
| 外部メディア連携（Twitter / Picasa / Gyazo） | R2 に一本化する。Picasa はサービス自体が終了している |
| 本文 URL の自動写真化（async_request プラグイン） | 非同期取得の仕組みが別途必要で、利用頻度に対して割に合わない。Phase 3 で再検討 |
| Message モデル（DM 用） | ルートから参照されておらず未使用のため |
| 検索・タイムラインのキャッシュ | この規模では D1 の直接読みで十分なため |
| New Relic、DB 統計表示（dbStats） | 運用系の置き換え先が Workers Logs のため |

## 9. フェーズ計画

| Phase | 内容 | 成果物 |
|---|---|---|
| Phase 0: 基盤 | リポジトリ作成、Wrangler + Hono の雛形、D1 マイグレーション（§4 の 8 テーブル）、Access 連携（開発時はヘッダーで疑似認証）、default.json の配信、共通レイアウト、プラグイン基盤（静的レジストリ＋設定読み込み）と media プラグインのインターフェース | ローカルで画面が開く土台 |
| Phase 1: コア | 登録・認可フロー、タイムライン、投稿 / 削除、イイネ、レスと新着通知、ユーザーページ群、写真アップロードとアイコン変更（Cloudflare 実装の media プラグイン、デフォルト有効） | 日常利用ができる最小構成 |
| Phase 2: 周辺 | 検索と検索ピン、スタンプ一式、管理画面、写真一覧、liked / likes ページ、icon_dir 差し替え、プラグイン実装（notify/information、notify/like、icon/rotate） | 元の機能のほぼ完全な再現 |
| Phase 3: 任意 | レス通知メール（Email Sending）、本文 URL の自動写真化、デスクトップ通知の作り込み | 必要と判断したものだけ |

- 新規コードの規模は TypeScript / TSX / JS / CSS 合わせて約 4,000〜5,500 行の見込み。
- 各 Phase の終わりに、元のルート表（§5）と突き合わせた動作チェックリストで確認する。
- ローカル確認は Wrangler の開発サーバー（Miniflare 上の D1 / R2 再現）で行い、問題なければ本番へデプロイする。

## 10. リポジトリとライセンス

- 新規リポジトリとして作成する（フォークにしない）。理由は前回の説明の通り、履歴の引き継ぎに意味がないため。
- 派生物として GPL-3.0 を引き継ぎ、LICENSE と原著作者（the wasam@s production）のクレジット、原典へのリンクを README に明記する。
- GPL はネットワーク経由のサービス提供だけではソース公開義務が発生しないため、メンバー向け運用の間はプライベートリポジトリで問題ない。

## 11. 決めてほしいこと（2026-11-25 決定済み）

1. **リポジトリ名**: kazmasa5150/massr-cf でよいか。→ **決定: その名前で進める**
2. **初期アイコン**: Access のログイン情報からはアイコン画像を取得できないため、登録時はデフォルト画像で開始し、後から設定画面でアップロードして変更する形でよいか。→ **決定: その形で進める**
3. **レス通知メール**: Cloudflare Email Sending は公開ベータで、利用には Workers Paid（月 5 ドル）が必要。最初から組み込むか、Phase 3 に回すか。→ **決定: 最初は入れない（Phase 3 の任意扱いのまま）**
4. **旧 URL 互換**: 元の Massr は現在も稼働中であることが判明した。現利用者に影響しないよう、合わせられるパスはすべて合わせる。→ **決定: パス互換は必須として進める**

## 12. 追加の決定（2026-11-25）

- **プラグインの枠組みは残す**。Workers の制約により動的ロードではなく静的レジストリ方式とし、設定 JSON の `plugin` セクションの書き方は元のまま互換とする（§1、§3、§7）。
- **notify/information、notify/like、icon/rotate は必須**として移植する（§5、§7、Phase 2）。notify/like の状態保存のため plugin_settings テーブルを復活させた（§4、8 テーブル構成）。
- **media（画像アップロード先）は最初は無効でよい**。ただし後から必要になる可能性に備え、インターフェースと設定の受け口の下準備は Phase 0 で行う（§7）。R2 実装の差し込みは Phase 3。
- **（上記を変更）media は Cloudflare 実装をデフォルトとして最初から有効化する**。保存先は R2、リサイズは Images 変換とし、写真添付とアイコン変更は Phase 1 から使える状態にする（§3、§7、§9）。

## 13. 現行 Massr からの移行（インポート）

現行インスタンスのデータと画像を取り込むための一回限りの移行ツールを別途作る。本体アプリとは切り離し、切り替え時に実行する。

### MongoDB → D1

1. 現行 MongoDB から各コレクションを `mongoexport` で JSON 形式で書き出す（users / statements / stamps / search_pins / plugin_settings）。
2. 変換スクリプト（Node.js）が D1 向け SQL を生成する。
   - Mongo の ObjectId は整数 ID へ振り直し、旧 ID → 新 ID の対応表を保持して、発言の res 連結・イイネ・スタンプの原発言参照を正しく張り替える。
   - statements 埋め込みの likes は likes テーブルの行へ展開し、photos 配列は statement_photos へ分離する。
   - 日時は Mongo の UTC から JST の `YYYY-MM-DD HH:MM:SS` 形式へ変換する。
   - users.res_ids は res_notifications へ移す。
3. 生成した SQL を `wrangler d1 execute` で流し込み、件数を元データと突き合わせて検証する。

**最大の注意点はユーザーの同一性**。新システムは Cloudflare Access のメールアドレスで利用者を特定するため、Mongo 側 users.email と、メンバーが Access ログインに使うアドレスが一致していないと同一人物として結び付かない。一致しないユーザーは、管理者が massr_id を見て手動で紐付ける救済手順を用意する。

### Gyazo の画像 → R2

- 現行の保存 URL は `https://i.gyazo.com/thumb/800/…` 形式（800px のサムネイル URL）。プラグインの実装上、`/thumb/800` を除いたものが原寸 URL になるため、原寸を取得して R2 へ保存し、D1 側の URL を新しい配信 URL へ書き換える。
- 対象は発言の写真、スタンプ画像、および Gyazo にあるユーザーアイコン。アイコンは Twitter CDN のものも混ざるため、取得できないものはデフォルトアイコンで再出発とする選択肢も残す。
- 取得はレート制限に配慮して間隔を空け、再開可能なスクリプトにする。Gyazo 側で既に消えている画像は失敗として記録し、移行後に一覧で報告する（その発言自体は本文ごと移行する）。

### 切り替え手順

- 現行 Massr は稼働中のため、移行は「一括取り込み → 差分取り込み」の二段階か、短時間の投稿停止を伴う一発切り替えのどちらかで行う。1 日数百件規模なら、告知して短時間止める一発切り替えが単純で確実。
- 移行ツールは Phase 2 完了後に作り、切り替えリハーサル（件数と画像の突き合わせ）を経て本番切り替えとする。
