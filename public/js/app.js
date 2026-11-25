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
          btn.title = nowLiked
            ? btn.getAttribute("data-unlike-label") || ""
            : btn.getAttribute("data-like-label") || "";
          var icon = btn.querySelector(".like-icon");
          if (icon) {
            icon.src = nowLiked ? "/img/wakaruwa.png" : "/img/wakaranaiwa.png";
            icon.alt = btn.title;
          }
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

  // レスフォーム: レスボタンで、その発言の下の入力欄を開閉する（元の slideToggle 相当）。
  document.querySelectorAll("[data-res-btn]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var box = document.getElementById("res-form-" + btn.getAttribute("data-res-btn"));
      if (!box) return;
      box.hidden = !box.hidden;
      if (!box.hidden) {
        var ta = box.querySelector("textarea");
        if (ta) ta.focus();
      }
    });
  });

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

  // 写真をスタンプに登録／解除する（元の usestamp / unusestamp のトグル）。
  function setStampAddState(btn, registered) {
    btn.setAttribute("data-registered", registered ? "1" : "0");
    btn.title = registered
      ? btn.getAttribute("data-unuse-label") || ""
      : btn.getAttribute("data-use-label") || "";
    var icon = btn.querySelector("i");
    if (icon) {
      icon.className = registered ? "gicon gicon-remove-circle" : "gicon gicon-ok-circle";
    }
  }
  var stampAddBtns = document.querySelectorAll("[data-stamp-add]");
  if (stampAddBtns.length > 0) {
    fetch("/stamps.json")
      .then(function (res) {
        return res.json();
      })
      .then(function (stamps) {
        var urls = {};
        stamps.forEach(function (s) {
          urls[s.image_url] = true;
        });
        stampAddBtns.forEach(function (btn) {
          if (urls[btn.getAttribute("data-image-url") || ""]) {
            setStampAddState(btn, true);
          }
        });
      })
      .catch(function () {});
  }
  stampAddBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var registered = btn.getAttribute("data-registered") === "1";
      var form = new FormData();
      form.append("image_url", btn.getAttribute("data-image-url") || "");
      if (registered) {
        fetch("/stamp", { method: "DELETE", body: form })
          .then(function (res) {
            if (res.ok) setStampAddState(btn, false);
          })
          .catch(function () {});
      } else {
        form.append("statement_id", btn.getAttribute("data-stamp-add") || "");
        fetch("/stamp", { method: "POST", body: form })
          .then(function (res) {
            if (res.ok) setStampAddState(btn, true);
          })
          .catch(function () {});
      }
    });
  });

  // スタンプ選択ポップアップ（元の magnific-popup + #stamps 相当）。
  // 投稿フォームのボタンから開くと新規スタンプ投稿、発言のボタンから開くと
  // その発言へのスタンプレスになる。選ぶと即 POST /statement.json する。
  var stampPopup = null;
  var stampPopupItems = null;
  var stampSearchField = null;
  var stampPopupLoaded = false;
  var stampTargetId = "";

  function ensureStampPopup() {
    if (stampPopup) return;
    stampPopup = document.createElement("div");
    stampPopup.className = "stamp-popup";
    stampPopup.hidden = true;
    var box = document.createElement("div");
    box.className = "stamp-popup-box";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "stamp-popup-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "close");
    stampSearchField = document.createElement("input");
    stampSearchField.type = "text";
    stampSearchField.className = "stamp-search";
    stampSearchField.placeholder = "タグで検索";
    stampPopupItems = document.createElement("div");
    stampPopupItems.className = "stamp-popup-items";
    box.appendChild(close);
    box.appendChild(stampSearchField);
    box.appendChild(stampPopupItems);
    stampPopup.appendChild(box);
    document.body.appendChild(stampPopup);
    close.addEventListener("click", closeStampPopup);
    stampPopup.addEventListener("click", function (e) {
      if (e.target === stampPopup) closeStampPopup();
    });
    document.addEventListener("keydown", function (e) {
      if (stampPopup && !stampPopup.hidden && e.key === "Escape") {
        closeStampPopup();
      }
    });
    stampSearchField.addEventListener("keyup", function () {
      var q = stampSearchField.value.toLowerCase();
      stampPopupItems.querySelectorAll(".submit-stamp").forEach(function (el) {
        var tag = (el.getAttribute("data-stamp-tag") || "").toLowerCase();
        el.style.display = tag.indexOf(q) > -1 ? "" : "none";
      });
    });
  }

  function loadStampItems() {
    if (stampPopupLoaded) return;
    stampPopupLoaded = true;
    fetch("/stamps.json")
      .then(function (res) {
        return res.json();
      })
      .then(function (stamps) {
        stamps.forEach(function (stamp) {
          var wrap = document.createElement("div");
          wrap.className = "submit-stamp";
          wrap.setAttribute("data-stamp-tag", stamp.tag || "");
          var style = document.createElement("div");
          style.className = "stamp-style";
          var inner = document.createElement("div");
          inner.className = "stamp";
          var img = document.createElement("img");
          img.className = "item-stamp";
          img.src = stamp.image_url;
          img.alt = stamp.tag || "stamp";
          img.title = (stamp.tag || "") + " " + stamp.popular;
          img.addEventListener("click", function () {
            postStamp(stamp);
          });
          inner.appendChild(img);
          style.appendChild(inner);
          wrap.appendChild(style);
          stampPopupItems.appendChild(wrap);
        });
      })
      .catch(function () {});
  }

  function postStamp(stamp) {
    var form = new FormData();
    form.append("stamp", stamp.image_url);
    form.append("stamp_id", stamp.id);
    if (stampTargetId) form.append("res_id", stampTargetId);
    fetch("/statement.json", { method: "POST", body: form })
      .then(function (res) {
        if (res.ok) {
          closeStampPopup();
          window.location.reload();
        } else {
          window.alert("スタンプの投稿に失敗しました");
        }
      })
      .catch(function () {
        window.alert("スタンプの投稿に失敗しました");
      });
  }

  function openStampPopup(targetId) {
    ensureStampPopup();
    stampTargetId = targetId || "";
    loadStampItems();
    stampPopup.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(function () {
      stampSearchField.focus();
    }, 50);
  }

  function closeStampPopup() {
    if (!stampPopup) return;
    stampPopup.hidden = true;
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-stamp-open]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openStampPopup(btn.getAttribute("data-stamp-open") || "");
    });
  });

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

  // ナビのドロップダウン（元の Bootstrap と同じくクリックで開閉する）。
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
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      document.querySelectorAll(".dropdown.open").forEach(function (d) {
        d.classList.remove("open");
      });
    }
  });

  // 管理者用：メンバーのメールアドレス変更（ログインの付け替え）。
  document.querySelectorAll("[data-email-change]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var massrId = btn.getAttribute("data-email-change") || "";
      var current = btn.getAttribute("data-current-email") || "";
      var email = window.prompt(
        "新しいメールアドレス（この人のログインに使うアドレスになります）",
        current
      );
      if (email === null || email.trim() === "" || email.trim() === current) return;
      fetch("/user/" + encodeURIComponent(massrId) + "/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
        .then(function (res) {
          if (res.status === 204) {
            location.reload();
          } else if (res.status === 409) {
            alert("そのメールアドレスは他のメンバーが使っています。");
          } else if (res.status === 400) {
            alert("メールアドレスの形式が正しくありません。");
          } else {
            alert("変更できませんでした。");
          }
        })
        .catch(function () {
          alert("変更できませんでした。");
        });
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
  // 元のプラグイン同様、自分の状態に応じて片方のボタンだけを見せる。
  function notifyLikeUpdateButtons(name, map) {
    var me = document.body.getAttribute("data-me") || "";
    var mine = Object.prototype.hasOwnProperty.call(map, me);
    var add = document.querySelector('[data-notify-like-add="' + name + '"]');
    var remove = document.querySelector(
      '[data-notify-like-remove="' + name + '"]'
    );
    if (add) add.style.display = mine ? "none" : "";
    if (remove) remove.style.display = mine ? "" : "none";
  }
  function notifyLikeRefresh(name, map) {
    notifyLikeRenderIcons(name, map);
    notifyLikeUpdateButtons(name, map);
  }
  document.querySelectorAll("[data-notify-like]").forEach(function (box) {
    var name = box.getAttribute("data-notify-like") || "";
    fetch("/plugin/notify/like/" + encodeURIComponent(name) + ".json")
      .then(function (res) {
        return res.json();
      })
      .then(function (map) {
        notifyLikeRefresh(name, map);
      })
      .catch(function () {});
  });
  document.querySelectorAll("[data-notify-like-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-notify-like-add") || "";
      fetch("/plugin/notify/like/" + encodeURIComponent(name), { method: "POST" })
        .then(function (res) {
          return res.json();
        })
        .then(function (map) {
          notifyLikeRefresh(name, map);
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
          notifyLikeRefresh(name, map);
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
          notifyLikeRefresh(name, map);
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
    // ポップアップ中の画像をクリックしたら画像自体へ遷移する。
    lightboxImg.addEventListener("click", function () {
      if (lightboxUrls[lightboxIndex]) {
        window.location.href = lightboxUrls[lightboxIndex];
      }
    });
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
