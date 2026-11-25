# massr-cf

[Massr](https://github.com/wasamas/massr)（the wasam@s production 作、Ruby/Sinatra 製の会員制ミニ SNS）を Cloudflare ネイティブ構成へ移植したものです。元の Massr の振る舞い・画面・URL 設計をできるだけ忠実に再現することを目指します。

- 実行基盤: Cloudflare Workers
- フレームワーク: Hono（TypeScript、JSX サーバー描画）
- DB: D1（SQLite）
- 画像: R2 保存（media プラグイン）
- 認証: Cloudflare Access（アプリ側に元の認可フローを再現）

## ライセンスとクレジット

本プロジェクトは Massr の派生物であり、GPL-3.0 のもとで公開します（`LICENSE` 参照）。
原典: [wasamas/massr](https://github.com/wasamas/massr) / Copyright (C) 2012 by The wasam@s production

## 元の Massr を知っている人へ

前提として、元の Massr は今も運用中です。このリポジトリは並行して開発している移植版で、URL のパスは元と互換を保っています。本番をこちらへ切り替えるかどうかは、まだ決まっていません。

画面の見た目と操作感（投稿、わかるわ、レス、スタンプ、検索ピン、出欠確認など）は、できるだけ元に寄せてあります。そのうえで、基盤が変わったために意図的に変えたところがあります。

変わったところ:

- ログイン: Twitter OAuth から Cloudflare Access に変更。メールアドレスが本人確認のキーになっていて、本人の設定画面では変更できません（管理者がメンバ一覧から変更できます）。
- アイコン: Twitter のアイコンは使わず、登録時は既定アイコン、登録後に自分でアップロードします。
- 画像の置き場: Gyazo などの外部サービスではなく、R2 に保存します（`media/cloudflare` プラグイン）。
- 検索: 正規表現ではなく部分一致です（正規表現に戻す案は保留中）。
- プラグイン: 実行時に読み込むのではなく、組み込みの静的な登録制です。有効化の書式（設定 JSON の `plugin` セクション）は元のままです。実装済みは `notify/information`、`notify/like`、`icon/rotate`、`media/cloudflare` です。
- データ: MongoDB から D1 に変更。ID は数値ですが、JSON の形（元の `to_hash`）と日時の表示形式（JST の `YYYY-MM-DD HH:MM:SS`）は維持しています。
- 検索ピンの JSON: 元の実装にあった不具合（`q` と `label` が null になる）を直してあります。
- 管理者の安全策として、管理者が 0 人になる降格・削除はできないようにしています（元には無いガードです）。

まだ無いもの・保留中のもの:

- レスが付いたときのメール通知（保留中）
- 本文中の URL を自動で写真にする機能（未実装・保留中）
- 本番データの移行ツール（MongoDB から D1 への変換、Gyazo の画像の R2 への移行）は未実装・保留中です。切り替えの方法も未定です。
- Cloudflare Images による画像のリサイズ変換は未接続です。カスタムドメインで運用するときに接続する予定で、今は元のサイズのまま配信しています（表示サイズは CSS で調整）。

## 開発の始め方

```sh
npm install
npm run db:migrate:local   # ローカル D1 にマイグレーション適用
npm run dev                # wrangler dev（http://localhost:8787）
```

開発時は Cloudflare Access の代わりに、次のいずれかで疑似ログインできます（`ENVIRONMENT` が `development` の場合のみ有効。それ以外では無効になる安全側の仕様です）。

- リクエストヘッダー `x-dev-email: you@example.com`
- 環境変数 `DEV_EMAIL`（`.dev.vars` に記述）

## テスト

```sh
npm test   # Vitest（Workers ランタイム + ローカル D1 でモデル層を検証）
```

`test/` のテストは、原作の RSpec（`spec/models/`）のケースを移植したものです。原作との意図的な差分（Twitter 連携フィールドの廃止、プロフィール更新で email を変えない、検索の正規表現→部分一致、プラグイン設定のキー形式）がある箇所は、テスト側で読み替えてあります。

## 本番デプロイの概要

1. D1 データベースと R2 バケットを作成し、`wrangler.jsonc` の `database_id` を差し替える
2. `npm run db:migrate:remote` でマイグレーションを適用する
3. Cloudflare Access でこのホスト名に対するアプリケーションを作成し、許可するメンバーを設定する
4. `npm run deploy`

## 移植の進捗

- Phase 0: 基盤（雛形、D1 スキーマ、設定読み込み、プラグイン基盤、Access 連携、共通レイアウト）— 完了
- Phase 1: コア（登録・認可フロー、タイムライン、投稿、イイネ、レス、ユーザーページ群、写真）— 完了
- Phase 2: 周辺（検索とピン留め、スタンプ、写真・liked・likes ページ、管理画面、notify/information・notify/like・icon/rotate プラグイン）— 完了
- Phase 3: 任意（メール通知ほか）— 保留中

動作確認用のスモークテストが `smoke-test.sh`（Phase 1）と `smoke-test-phase2.sh`（Phase 2）にあります（`npm run dev` で起動した状態で実行）。

## プラグインの有効化

プラグインは設定 JSON の `plugin` セクションで有効化します（元の Massr と同じ書式）。`public/default.json` の既定では `media/cloudflare` と `icon/rotate` が有効です。開発時は `.dev.vars` に `MASSR_SETTINGS_JSON` を書くと差分マージされます。

```
MASSR_SETTINGS_JSON={"plugin":{"notify/information news":{"message":"お知らせ文"},"notify/like party":{"label":"参加しますか？","delete":"any"}}}
```

- `notify/information <ラベル>`: お知らせ欄に `message` を表示する
- `notify/like <ラベル>`: 全体イイネ（出欠確認など）。`delete` は `owner`（自分の分だけ取消可）か `any`（誰の分でも取消可）
- `icon/rotate`: サイトアイコン（favicon / apple-touch-icon）のディレクトリを現在月に切り替える（画像は `public/img/icons/<MM>/` に配置。既定で有効）

移植計画の詳細は [Massr 移植計画書](docs/Massr移植計画書.md) を参照してください。

## 注意

- `wrangler.jsonc` の `ENVIRONMENT` は開発の便宜上 `development` になっています。本番へ出すときは必ず `production` にし、Cloudflare Access を前段に置いて、workers.dev 経由の直接アクセスを止めてください。`development` のままだと疑似ログインが効いてしまい、誰でも管理者になりすませます。
