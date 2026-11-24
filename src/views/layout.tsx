import type { FC, PropsWithChildren } from "hono/jsx";

/**
 * 共通レイアウト（元の head / header / footer の枠に相当）。
 * 見た目の作り込みは Phase 1 以降で行う。
 */
export const Layout: FC<
  PropsWithChildren<{ title: string; siteName: string }>
> = ({ title, siteName, children }) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link rel="stylesheet" href="/css/app.css" />
    </head>
    <body>
      <header className="site-header">
        <a href="/">{siteName}</a>
      </header>
      <div className="container">
        <main>{children}</main>
      </div>
      <footer className="site-footer">{siteName}</footer>
    </body>
  </html>
);
