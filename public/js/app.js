// massr-cf client behaviors: like toggle, res targeting, delete, res badge polling.
(function () {
  "use strict";

  function updateLikers(container, likes) {
    if (!container) return;
    container.textContent = "";
    likes.forEach(function (like) {
      var a = document.createElement("a");
      a.href = "/user/" + like.user.massr_id;
      var img = document.createElement("img");
      img.className = "massr-icon-mini";
      img.src = like.user.twitter_icon_url_https;
      img.alt = like.user.name;
      img.title = like.user.name;
      a.appendChild(img);
      container.appendChild(a);
    });
    var row = container.closest(".statement-like");
    if (row) row.style.display = likes.length > 0 ? "" : "none";
  }

  document.querySelectorAll("[data-like-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-like-btn");
      var liked = btn.getAttribute("data-liked") === "1";
      fetch("/statement/" + id + "/like", { method: liked ? "DELETE" : "POST" })
        .then(function (res) {
          return res.json();
        })
        .then(function (hash) {
          var nowLiked = hash.likes.some(function (l) {
            return document.body.getAttribute("data-me") === l.user.massr_id;
          });
          btn.setAttribute("data-liked", nowLiked ? "1" : "0");
          btn.classList.toggle("liked", nowLiked);
          btn.classList.toggle("unlike", nowLiked);
          btn.classList.toggle("like", !nowLiked);
          var label = btn.querySelector(".like-label");
          if (label) {
            label.textContent = nowLiked
              ? btn.getAttribute("data-unlike-label") || ""
              : btn.getAttribute("data-like-label") || "";
          }
          var count = btn.querySelector(".like-count");
          if (count) count.textContent = hash.likes.length > 0 ? String(hash.likes.length) : "";
          updateLikers(
            document.querySelector('[data-likers="' + id + '"]'),
            hash.likes
          );
        })
        .catch(function () {});
    });
  });

  document.querySelectorAll("[data-delete-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!window.confirm("本当に削除してよろしいですか?")) return;
      var id = btn.getAttribute("data-delete-btn");
      fetch("/statement/" + id, { method: "DELETE" }).then(function () {
        if (window.location.pathname === "/") {
          window.location.reload();
        } else {
          window.location.href = "/";
        }
      });
    });
  });

  // レス先の指定: 投稿フォームの hidden input とバナーを切り替える。
  var resInput = document.getElementById("res-id-input");
  var resBanner = document.getElementById("res-banner");
  var resBannerText = document.getElementById("res-banner-text");
  var resCancel = document.getElementById("res-cancel");
  if (resInput && resBanner && resCancel) {
    document.querySelectorAll("[data-res-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        resInput.value = btn.getAttribute("data-res-btn") || "";
        if (resBannerText) {
          resBannerText.textContent =
            "レス先: " + (btn.getAttribute("data-res-label") || "");
        }
        resBanner.style.display = "";
        var textarea = document.querySelector(".post-form textarea");
        if (textarea) textarea.focus();
        window.scrollTo(0, 0);
      });
    });
    resCancel.addEventListener("click", function () {
      resInput.value = "";
      resBanner.style.display = "none";
    });
  }

  // レス新着バッジのポーリング（元の 30 秒間隔に合わせる）。
  var badge = document.getElementById("res-badge");
  if (badge) {
    window.setInterval(function () {
      fetch("/ressize.json")
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          badge.textContent = String(data.size);
          badge.style.display = data.size > 0 ? "" : "none";
        })
        .catch(function () {});
    }, 30000);
  }

  // 写真をスタンプに登録する。
  document.querySelectorAll("[data-stamp-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var form = new FormData();
      form.append("image_url", btn.getAttribute("data-image-url") || "");
      form.append("statement_id", btn.getAttribute("data-stamp-add") || "");
      fetch("/stamp", { method: "POST", body: form })
        .then(function (res) {
          if (res.ok) {
            btn.textContent = "登録済み";
            btn.disabled = true;
          }
        })
        .catch(function () {});
    });
  });

  // スタンプトレイ（投稿フォーム）。
  var stampToggle = document.getElementById("stamp-toggle");
  var stampTray = document.getElementById("stamp-tray");
  var stampUrlInput = document.getElementById("stamp-url-input");
  var stampIdInput = document.getElementById("stamp-id-input");
  var stampPreview = document.getElementById("stamp-preview");
  var stampPreviewImg = document.getElementById("stamp-preview-img");
  var stampClear = document.getElementById("stamp-clear");
  if (stampToggle && stampTray) {
    var trayLoaded = false;
    stampToggle.addEventListener("click", function () {
      var show = stampTray.style.display === "none";
      stampTray.style.display = show ? "" : "none";
      if (show && !trayLoaded) {
        trayLoaded = true;
        fetch("/stamps.json")
          .then(function (res) {
            return res.json();
          })
          .then(function (stamps) {
            stamps.forEach(function (stamp) {
              var img = document.createElement("img");
              img.src = stamp.image_url;
              img.alt = stamp.tag || "stamp";
              img.className = "stamp-thumb";
              img.addEventListener("click", function () {
                if (stampUrlInput) stampUrlInput.value = stamp.image_url;
                if (stampIdInput) stampIdInput.value = stamp.id;
                if (stampPreviewImg) stampPreviewImg.src = stamp.image_url;
                if (stampPreview) stampPreview.style.display = "";
                stampTray.style.display = "none";
              });
              stampTray.appendChild(img);
            });
          })
          .catch(function () {});
      }
    });
  }
  if (stampClear) {
    stampClear.addEventListener("click", function () {
      if (stampUrlInput) stampUrlInput.value = "";
      if (stampIdInput) stampIdInput.value = "";
      if (stampPreview) stampPreview.style.display = "none";
    });
  }

  // スタンプのタグ保存。
  document.querySelectorAll("[data-stamp-tag-form]").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var data = new FormData(form);
      data.append("stamp_id", form.getAttribute("data-stamp-tag-form") || "");
      fetch("/stamp/tag", { method: "POST", body: data })
        .then(function (res) {
          if (res.ok) window.alert("スタンプのタグを更新しました");
        })
        .catch(function () {});
    });
  });

  // 検索ピンの追加・削除。
  document.querySelectorAll("[data-pin-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var form = new FormData();
      form.append("q", btn.getAttribute("data-pin-add") || "");
      fetch("/search/pin", { method: "POST", body: form }).then(function () {
        window.location.reload();
      });
    });
  });
  document.querySelectorAll("[data-pin-delete]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var form = new FormData();
      form.append("q", btn.getAttribute("data-pin-delete") || "");
      fetch("/search/pin", { method: "DELETE", body: form }).then(function () {
        window.location.reload();
      });
    });
  });

  // ナビのドロップダウン（タッチ操作用にクリックでも開閉する。ホバーでも開く）。
  document.querySelectorAll(".dropdown-toggle").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var dd = btn.closest(".dropdown");
      if (!dd) return;
      var wasOpen = dd.classList.contains("open");
      document.querySelectorAll(".dropdown.open").forEach(function (d) {
        d.classList.remove("open");
      });
      if (!wasOpen) dd.classList.add("open");
    });
  });
  document.addEventListener("click", function () {
    document.querySelectorAll(".dropdown.open").forEach(function (d) {
      d.classList.remove("open");
    });
  });

  // 画像が無いマサオ等は隠す（icon プラグインの月替わり先に画像が無い場合）。
  document.querySelectorAll("img.masao-img").forEach(function (img) {
    img.addEventListener("error", function () {
      img.remove();
    });
  });

  // notify/like プラグイン（全体イイネ）。
  function notifyLikeRenderIcons(name, map) {
    var box = document.querySelector(
      '[data-notify-like="' + name + '"] .notify-like-icons'
    );
    if (!box) return;
    box.textContent = "";
    Object.keys(map).forEach(function (user) {
      var img = document.createElement("img");
      img.className = "massr-icon-mini";
      img.src = map[user][1];
      img.alt = user;
      box.appendChild(img);
    });
  }
  document.querySelectorAll("[data-notify-like-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-notify-like-add") || "";
      fetch("/plugin/notify/like/" + encodeURIComponent(name), { method: "POST" })
        .then(function (res) {
          return res.json();
        })
        .then(function (map) {
          notifyLikeRenderIcons(name, map);
        })
        .catch(function () {});
    });
  });
  document.querySelectorAll("[data-notify-like-remove]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-notify-like-remove") || "";
      var me = document.body.getAttribute("data-me") || "";
      fetch(
        "/plugin/notify/like/" +
          encodeURIComponent(name) +
          "/" +
          encodeURIComponent(me),
        { method: "DELETE" }
      )
        .then(function (res) {
          return res.json();
        })
        .then(function (map) {
          notifyLikeRenderIcons(name, map);
        })
        .catch(function () {});
    });
  });
  document.querySelectorAll("[data-notify-like-delete]").forEach(function (link) {
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      var name = link.getAttribute("data-notify-like-delete") || "";
      var user = link.getAttribute("data-user") || "";
      fetch(
        "/plugin/notify/like/" +
          encodeURIComponent(name) +
          "/" +
          encodeURIComponent(user),
        { method: "DELETE" }
      )
        .then(function (res) {
          return res.json();
        })
        .then(function (map) {
          notifyLikeRenderIcons(name, map);
        })
        .catch(function () {});
    });
  });

  // 写真のポップアップ表示（元の magnific-popup 相当）。
  var lightbox = null;
  var lightboxImg = null;
  var lightboxPrev = null;
  var lightboxNext = null;
  var lightboxUrls = [];
  var lightboxIndex = 0;

  function ensureLightbox() {
    if (lightbox) return;
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.hidden = true;
    var close = document.createElement("button");
    close.type = "button";
    close.className = "lightbox-close";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "close");
    lightboxPrev = document.createElement("button");
    lightboxPrev.type = "button";
    lightboxPrev.className = "lightbox-prev";
    lightboxPrev.textContent = "\u2039";
    lightboxPrev.setAttribute("aria-label", "prev");
    lightboxNext = document.createElement("button");
    lightboxNext.type = "button";
    lightboxNext.className = "lightbox-next";
    lightboxNext.textContent = "\u203a";
    lightboxNext.setAttribute("aria-label", "next");
    lightboxImg = document.createElement("img");
    lightboxImg.className = "lightbox-img";
    lightboxImg.alt = "photo";
    lightbox.appendChild(lightboxPrev);
    lightbox.appendChild(lightboxImg);
    lightbox.appendChild(lightboxNext);
    lightbox.appendChild(close);
    document.body.appendChild(lightbox);
    close.addEventListener("click", closeLightbox);
    lightboxPrev.addEventListener("click", function () { showLightbox(lightboxIndex - 1); });
    lightboxNext.addEventListener("click", function () { showLightbox(lightboxIndex + 1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox || lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showLightbox(lightboxIndex - 1);
      if (e.key === "ArrowRight") showLightbox(lightboxIndex + 1);
    });
  }

  function showLightbox(index) {
    if (index < 0 || index >= lightboxUrls.length) return;
    lightboxIndex = index;
    lightboxImg.src = lightboxUrls[index];
    lightboxPrev.style.visibility = index > 0 ? "" : "hidden";
    lightboxNext.style.visibility = index < lightboxUrls.length - 1 ? "" : "hidden";
  }

  function openLightbox(urls, index) {
    ensureLightbox();
    lightboxUrls = urls;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    showLightbox(index);
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  document.querySelectorAll("a.photo-link").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var group = link.getAttribute("data-lightbox-group");
      var links = Array.prototype.slice.call(
        document.querySelectorAll('a.photo-link[data-lightbox-group="' + group + '"]')
      );
      var urls = links.map(function (l) { return l.getAttribute("href"); });
      openLightbox(urls, links.indexOf(link));
    });
  });
})();
