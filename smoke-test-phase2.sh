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
login=$(curl -s $B/login)
month=$(date +%m)
contains "login masao uses monthly icon dir" "/img/$month/masao_footer.jpg" "$login"

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

echo "== RESULT: pass=$pass fail=$fail"
