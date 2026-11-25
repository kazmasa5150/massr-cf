/*
 * watch_authorize.js : watching authorization status and redirect to top
 *
 * Copyright (C) 2012 by The wasam@s production
 *
 * Distributed under GPL
 *
 * massr-cf: jQuery 版からのバニラ JS 移植。認可待ちページでのみ読み込まれる。
 * 60 秒ごとにトップページを取得し、認可待ちの目印（id="masao" の画像）が
 * まだあれば画像だけ差し替え、消えていれば（＝認可された）トップへ遷移する。
 */
(function () {
  setInterval(function () {
    fetch("/", { cache: "no-store" })
      .then(function (res) {
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var masao = doc.querySelector("#masao");
        if (masao) {
          // まだ認可待ち: マサオ画像を新しいものに差し替える。
          var img = document.querySelector("#masao");
          if (img) img.src = masao.getAttribute("src");
        } else {
          // 認可された: トップページへ。
          location.href = "/";
        }
      })
      .catch(function () {
        location.reload();
      });
  }, 60000);
})();
