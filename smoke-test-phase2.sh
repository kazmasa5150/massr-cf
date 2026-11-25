#!/bin/bash
# massr-cf Phase 2 smoke test. Assumes smoke-test.sh (Phase 1) ran just before:
# alice (admin) and bob (authorized) exist; a photo statement by alice exists.
# Server must run with MASSR_SETTINGS_JSON enabling notify/information,
# notify/like party (delete: any) and icon/rotate.
B=${MASSR_BASE:-http://localhost:8799}
A=(-H 'x-dev-email: alice@example.com')
BOB=(-H 'x-dev-email: bob@example.com')
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 (expected [$2] got [$3])"; fail=$((fail+1)); fi; }
contains() { case "$3" in *"$2"*) echo "PASS: $1"; pass=$((pass+1));; *) echo "FAIL: $1 (missing [$2])"; fail=$((fail+1));; esac; }
json_get() { python3 -c "import sys, json; d = json.load(sys.stdin); print($1)"; }

# --- search ---
sj=$(curl -s "${A[@]}" "$B/search.json?q=photo")
contains "search.json finds photo post" 'with photo' "$sj"
sh=$(curl -s "${A[@]}" "$B/search?q=photo")
contains "search page shows result" 'with photo' "$sh"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "${A[@]}" "$B/search?q=")
check "empty search redirects" "$B/" "$loc"

# --- pins ---
pin=$(curl -s "${A[@]}" -X POST -d 'q=photo&label=写真メモ' $B/search/pin)
contains "pin created" '"q":"photo"' "$pin"
code=$(curl -s -o /dev/null -w '%{http_code}' "${A[@]}" -X POST -d 'q=photo' $B/search/pin)
check "duplicate pin is 409" "409" "$code"
pins=$(curl -s "${A[@]}" $B/search/pins.json)
contains "pins.json lists pin with label" '写真メモ' "$pins"
curl -s -o /dev/null "${A[@]}" -X PUT -d 'q=photo&label=写真ラベル' $B/search/pin
pins=$(curl -s "${A[@]}" $B/search/pins.json)
contains "pin label updated" '写真ラベル' "$pins"
curl -s -o /dev/null "${A[@]}" -X DELETE -d 'q=photo' $B/search/pin
pins=$(curl -s "${A[@]}" $B/search/pins.json)
check "pin deleted" "[]" "$pins"
code=$(curl -s -o /dev/null -w '%{http_code}' "${A[@]}" -X DELETE -d 'q=photo' $B/search/pin)
check "delete missing pin is 404" "404" "$code"

# --- stamps ---
photos=$(curl -s "${A[@]}" $B/statement/photos.json)
sid=$(printf '%s' "$photos" | json_get "d[0]['id']")
purl=$(printf '%s' "$photos" | json_get "d[0]['photos'][0]")
stamp=$(curl -s "${A[@]}" -X POST -d "image_url=$purl&statement_id=$sid" $B/stamp)
contains "stamp created" "\"image_url\":\"$purl\"" "$stamp"
stamp_id=$(printf '%s' "$stamp" | json_get "d['id']")
tagged=$(curl -s "${A[@]}" -X POST -d "stamp_id=$stamp_id&tag=テストタグ" $B/stamp/tag)
contains "stamp tag updated" 'テストタグ' "$tagged"
posted=$(curl -s "${A[@]}" -X POST -d "stamp=$purl&stamp_id=$stamp_id" $B/statement.json)
contains "stamp post returns stamp url" "\"stamp\":\"$purl\"" "$posted"
stamps=$(curl -s "${A[@]}" $B/stamps.json)
pop=$(printf '%s' "$stamps" | json_get "d[0]['popular']")
check "stamp popular incremented" "1" "$pop"
spage=$(curl -s "${A[@]}" $B/stamps)
contains "stamps page shows stamp" "$purl" "$spage"
curl -s -o /dev/null "${A[@]}" -X DELETE -d "image_url=$purl" $B/stamp
stamps=$(curl -s "${A[@]}" $B/stamps.json)
check "stamp deleted" "[]" "$stamps"

# --- photos pages ---
pp=$(curl -s "${A[@]}" $B/statement/photos)
contains "all photos page" '/media/' "$pp"
up=$(curl -s "${A[@]}" $B/user/alice/photos.json)
contains "user photos json" '"photos":["/media/' "$up"

# --- liked / likes ---
curl -s -o /dev/null "${BOB[@]}" -X POST "$B/statement/$sid/like"
bob_likes=$(curl -s "${BOB[@]}" $B/user/bob/likes.json)
contains "bob likes page has statement" "\"id\":\"$sid\"" "$bob_likes"
alice_liked=$(curl -s "${A[@]}" $B/user/alice/liked.json)
contains "alice liked page has statement" "\"id\":\"$sid\"" "$alice_liked"

# --- admin ---
adm=$(curl -s "${A[@]}" $B/admin)
contains "admin page lists bob" '@bob' "$adm"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "${BOB[@]}" $B/admin)
check "non-admin redirected from /admin" "$B/" "$loc"

# --- notify plugins ---
top=$(curl -s "${A[@]}" $B/)
contains "information message on timeline" 'テストお知らせ' "$top"
contains "notify/like widget on timeline" 'data-notify-like="party"' "$top"
nl=$(curl -s "${BOB[@]}" -X POST $B/plugin/notify/like/party)
contains "notify like add bob" '"bob"' "$nl"
nl=$(curl -s "${A[@]}" $B/plugin/notify/like/party.json)
contains "notify like json has bob" '"bob"' "$nl"
nl=$(curl -s "${A[@]}" -X DELETE $B/plugin/notify/like/party/bob)
case "$nl" in *'"bob"'*) echo "FAIL: notify like delete (any)"; fail=$((fail+1));; *) echo "PASS: notify like delete (any)"; pass=$((pass+1));; esac

# --- icon/rotate ---
# フッターの masao 画像は元の CSS と同じく /img/masao_footer.jpg（icon_dir の影響を受けない）。
# icon/rotate の効きは favicon 側で担保される（月ごとのセットに切り替わる）。
login=$(curl -s $B/login)
contains "footer masao path matches original" "/img/masao_footer.jpg" "$login"

# --- security hardening ---
printf '<script>alert(1)</script>' > /tmp/evil.html
evil=$(curl -s "${A[@]}" -F 'body=evil upload' -F 'photo=@/tmp/evil.html;type=text/html' $B/statement.json)
contains "html upload is not attached as photo" '"photos":[]' "$evil"
code=$(curl -s -o /dev/null -w '%{http_code}' "${A[@]}" -H 'Origin: https://evil.example' -X POST -d 'body=csrf' $B/statement.json)
check "cross-site Origin POST is 403" "403" "$code"
ok=$(curl -s "${A[@]}" -H "Origin: $B" -X POST -d 'body=origin ok' $B/statement.json)
contains "same-origin Origin POST works" 'origin ok' "$ok"
photos=$(curl -s "${A[@]}" $B/statement/photos.json)
purl=$(printf '%s' "$photos" | json_get "d[0]['photos'][0]")
hdr=$(curl -s -I "${A[@]}" "$B$purl" | grep -i 'x-content-type-options' || true)
contains "media served with nosniff" 'nosniff' "$hdr"

# --- photo lightbox ---
top=$(curl -s "${A[@]}" $B/)
contains "timeline photos use lightbox links" 'photo-link' "$top"
appjs=$(curl -s $B/js/app.js)
contains "app.js has lightbox code" 'lightbox' "$appjs"
contains "lightbox image click navigates to the image" 'lightboxImg.addEventListener' "$appjs"

# --- multiple photos (max 4, square grid) ---
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > /tmp/test.png
multi=$(curl -s "${A[@]}" -F 'body=multi photo post' -F 'photo=@/tmp/test.png' -F 'photo=@/tmp/test.png' -F 'photo=@/tmp/test.png' $B/statement.json)
mlen=$(printf '%s' "$multi" | json_get "len(d['photos'])")
check "3 photos attached at once" "3" "$mlen"
five=$(curl -s "${A[@]}" -F 'body=five photo post' -F 'photo=@/tmp/test.png' -F 'photo=@/tmp/test.png' -F 'photo=@/tmp/test.png' -F 'photo=@/tmp/test.png' -F 'photo=@/tmp/test.png' $B/statement.json)
flen=$(printf '%s' "$five" | json_get "len(d['photos'])")
check "5 uploads capped at 4 photos" "4" "$flen"
top=$(curl -s "${A[@]}" $B/)
contains "multi photos use square grid class" 'photos-count-3' "$top"

# --- photo-only post (no body) ---
imgonly=$(curl -s "${A[@]}" -F 'photo=@/tmp/test.png' $B/statement.json)
il=$(printf '%s' "$imgonly" | json_get "len(d['photos'])")
check "photo-only post is saved" "1" "$il"
ib=$(printf '%s' "$imgonly" | json_get "d['body']")
check "photo-only post has null body" "None" "$ib"
code=$(curl -s -o /dev/null -w '%{http_code}' "${A[@]}" -X POST -d 'body=' $B/statement.json)
check "empty post without photo is still 400" "400" "$code"

# --- last-admin guard (demote/delete allowed, but never to zero admins) ---
ustatus() { curl -s "${A[@]}" $B/index.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
u = [s['user'] for s in d if s['user']['massr_id'] == '$1']
print(u[0]['status'] if u else 'missing')"; }
curl -s -o /dev/null "${A[@]}" -X PUT -d 'status=1' $B/user/alice
check "sole admin cannot demote self (PUT)" "0" "$(ustatus alice)"
curl -s -o /dev/null "${A[@]}" -X POST -d '_method=put&status=1' $B/user/alice
check "sole admin cannot demote self (form)" "0" "$(ustatus alice)"
curl -s -o /dev/null "${A[@]}" -X DELETE $B/user/alice
check "sole admin cannot delete self" "0" "$(ustatus alice)"
curl -s -o /dev/null "${A[@]}" -X PUT -d 'status=0' $B/user/bob
check "promote bob to admin" "0" "$(ustatus bob)"
curl -s -o /dev/null "${A[@]}" -X PUT -d 'status=1' $B/user/alice
check "demote allowed when another admin exists" "1" "$(ustatus alice)"
curl -s -o /dev/null "${BOB[@]}" -X PUT -d 'status=0' $B/user/alice
check "bob restores alice to admin" "0" "$(ustatus alice)"

# --- inline res form under each statement ---
top=$(curl -s "${A[@]}" $B/)
contains "statement has inline res form" 'res-form' "$top"
contains "res form carries res_id" 'name="res_id"' "$top"
case "$top" in *'res-banner'*) echo 'FAIL: old res banner removed'; fail=$((fail+1));; *) echo 'PASS: old res banner removed'; pass=$((pass+1));; esac
appjs=$(curl -s $B/js/app.js)
contains "app.js toggles inline res form" 'res-form-' "$appjs"

# --- original img assets ---
code=$(curl -s -o /dev/null -w '%{http_code}' $B/favicon.ico)
check "favicon.ico served" "200" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' $B/img/apple-touch-icon-57x57.png)
check "apple-touch-icon served" "200" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' $B/img/masao_footer.jpg)
check "masao_footer.jpg served" "200" "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' $B/img/wakaruwa.png)
check "wakaruwa.png served" "200" "$code"
contains "like button uses wakaruwa image" '/img/wakaruwa.png' "$top"
contains "footer uses masao_footer.jpg" "/img/masao_footer.jpg" "$top"

# --- watch_authorize (unauthorized page) ---
CAROL=(-H 'x-dev-email: carol@example.com')
curl -s -o /dev/null "${CAROL[@]}" -X POST -d 'massr_id=carol&name=Carol' $B/user
unauth=$(curl -s "${CAROL[@]}" $B/unauthorized)
contains "unauthorized page has masao marker" 'id="masao"' "$unauth"
contains "unauthorized page loads watch_authorize.js" 'watch_authorize.js' "$unauth"
watchjs=$(curl -s $B/js/watch_authorize.js)
contains "watch_authorize polls every 60s" '60000' "$watchjs"
topu=$(curl -s -L "${CAROL[@]}" $B/)
contains "unauthorized top still shows masao" 'id="masao"' "$topu"
curl -s -o /dev/null "${A[@]}" -X PUT -d 'status=1' $B/user/carol
topa=$(curl -s "${CAROL[@]}" $B/)
case "$topa" in *'id="masao"'*) echo 'FAIL: authorized top has no masao'; fail=$((fail+1));; *) echo 'PASS: authorized top has no masao'; pass=$((pass+1));; esac

# --- stamp popup / stamp reply / action icons / like image pairing ---
top2=$(curl -s "${A[@]}" $B/)
contains "stamp button in post form" 'data-stamp-open=""' "$top2"
astmt=$(curl -s "${A[@]}" $B/statement/$sid)
contains "stamp button in statement actions" "data-stamp-open=\"$sid\"" "$astmt"
contains "trash icon in statement actions" 'gicon-trash' "$astmt"
contains "stamp icon in statement actions" 'gicon-th' "$astmt"
appjs2=$(curl -s $B/js/app.js)
contains "app.js builds stamp popup" 'stamp-popup' "$appjs2"
stamp2=$(curl -s "${A[@]}" -X POST -d "image_url=$purl&statement_id=$sid" $B/stamp)
stamp2_id=$(printf '%s' "$stamp2" | json_get "d['id']")
reply=$(curl -s "${BOB[@]}" -X POST -d "stamp=$purl&stamp_id=$stamp2_id&res_id=$sid" $B/statement.json)
contains "stamp reply carries stamp" "\"stamp\":\"$purl\"" "$reply"
contains "stamp reply points at original" "\"res\":{\"id\":\"$sid\"" "$reply"
stamps2=$(curl -s "${A[@]}" $B/stamps.json)
pop2=$(printf '%s' "$stamps2" | json_get "d[0]['popular']")
check "stamp reply increments popular" "1" "$pop2"
curl -s -o /dev/null "${BOB[@]}" -X DELETE $B/statement/$sid/like
spage1=$(curl -s "${BOB[@]}" $B/statement/$sid)
contains "like button before like uses wakaranaiwa" '/img/wakaranaiwa.png' "$spage1"
curl -s -o /dev/null "${BOB[@]}" -X POST $B/statement/$sid/like
spage2=$(curl -s "${BOB[@]}" $B/statement/$sid)
contains "like button after like uses wakaruwa" '/img/wakaruwa.png' "$spage2"
case "$spage2" in *'/img/wakaranaiwa.png'*) echo 'FAIL: liked page has no wakaranaiwa'; fail=$((fail+1));; *) echo 'PASS: liked page has no wakaranaiwa'; pass=$((pass+1));; esac

# --- icon-only buttons (original UI parity) ---
contains "search button is icon-only" 'gicon-search' "$top2"
contains "post form photo attach is icon-only" 'gicon-camera' "$top2"
contains "res button is icon-only" 'gicon-comment' "$astmt"
case "$astmt" in *'class="like-label"'*) echo 'FAIL: like button has no text label'; fail=$((fail+1));; *) echo 'PASS: like button has no text label'; pass=$((pass+1));; esac
contains "notify-like add button is image-only" '<img src="/img/wakaranaiwa.png" alt="わかるわ">' "$top2"
contains "photo stamp toggle uses ok-circle icon" 'gicon-ok-circle' "$astmt"
sh2=$(curl -s "${A[@]}" "$B/search?q=photo")
contains "pin add button uses share-alt icon" 'gicon-share-alt' "$sh2"
contains "app.js toggles stamp registration" 'data-registered' "$appjs2"
userpage=$(curl -s "${A[@]}" $B/user)
contains "settings icon input is hidden" 'file-hidden' "$userpage"
contains "settings icon has fixed size class" 'current-icon' "$userpage"
upage=$(curl -s "${A[@]}" $B/user/alice)
contains "user page lists statements" 'class="statement"' "$upage"
case "$upage" in *'profile-head'*) echo 'FAIL: user page has no profile head'; fail=$((fail+1));; *) echo 'PASS: user page has no profile head'; pass=$((pass+1));; esac
appcss=$(curl -s $B/css/app.css)
case "$appcss" in *'.dropdown:hover .dropdown-menu'*) echo 'FAIL: dropdown is click-only'; fail=$((fail+1));; *) echo 'PASS: dropdown is click-only'; pass=$((pass+1));; esac
case "$upage" in *'profile-links'*) echo 'FAIL: user page has no link row'; fail=$((fail+1));; *) echo 'PASS: user page has no link row'; pass=$((pass+1));; esac
contains "notify-like buttons wrapped for right alignment" 'notify-like-buttons' "$top2"

echo "== RESULT: pass=$pass fail=$fail"
