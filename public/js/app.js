// massr-cf client behaviors: like toggle, res targeting, delete, res badge polling.
(function () {
  "use strict";

  function updateLikers(container, likes) {
    if (!container) return;
    container.textContent = "";
    likes.forEach(function (like) {
      var img = document.createElement("img");
      img.className = "liker-icon";
      img.src = like.user.twitter_icon_url_https;
      img.alt = like.user.name;
      img.title = like.user.name;
      container.appendChild(img);
    });
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
})();
