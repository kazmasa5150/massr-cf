#!/bin/bash
# massr-cf Phase 1 smoke test against wrangler dev on :8799
B=${MASSR_BASE:-http://localhost:8799}
A=(-H 'x-dev-email: alice@example.com')
BOB=(-H 'x-dev-email: bob@example.com')
pass=0; fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 (expected [$2] got [$3])"; fail=$((fail+1)); fi
}
contains() { # name needle haystack
  case "$3" in *"$2"*) echo "PASS: $1"; pass=$((pass+1));; *) echo "FAIL: $1 (missing [$2])"; fail=$((fail+1));; esac
}

# 1. no identity -> redirect to /login
loc=$(curl -s -o /dev/null -w '%{redirect_url}' $B/)
check "no-identity redirects to login" "$B/login" "$loc"

# 2. register alice (first user -> admin)
code=$(curl -s -o /dev/null -w '%{http_code}' "${A[@]}" -X POST -d 'massr_id=alice&name=Alice' $B/user)
check "register alice" "302" "$code"
tl=$(curl -s "${A[@]}" $B/)
contains "alice sees timeline" "post-form" "$tl"

# 3. register bob (unauthorized)
curl -s -o /dev/null "${BOB[@]}" -X POST -d 'massr_id=bob&name=Bob' $B/user
loc=$(curl -s -o /dev/null -w '%{redirect_url}' "${BOB[@]}" $B/)
check "bob redirected to unauthorized" "$B/unauthorized" "$loc"

# 4. alice authorizes bob
curl -s -o /dev/null "${A[@]}" -X POST -d '_method=put&status=1' $B/user/bob
code=$(curl -s -o /dev/null -w '%{http_code}' "${BOB[@]}" $B/)
check "bob authorized sees timeline" "200" "$code"

# 5. alice posts
curl -s -o /dev/null "${A[@]}" -X POST -d 'body=hello massr' $B/statement
json=$(curl -s "${BOB[@]}" $B/index.json)
contains "index.json has post" '"body":"hello massr"' "$json"
contains "hash user massr_id" '"massr_id":"alice"' "$json"
contains "hash created_at format" '"created_at":"202' "$json"

# 6. bob likes, unlikes, likes
like=$(curl -s "${BOB[@]}" -X POST $B/statement/1/like)
contains "like count 1" '"likes":[{"id":"1_0"' "$like"
unlike=$(curl -s "${BOB[@]}" -X DELETE $B/statement/1/like)
contains "unlike count 0" '"likes":[]' "$unlike"
curl -s -o /dev/null "${BOB[@]}" -X POST $B/statement/1/like

# 7. bob replies -> alice ressize 1 -> res page clears
curl -s -o /dev/null "${BOB[@]}" -X POST -d 'body=reply to alice&res_id=1' $B/statement
rs=$(curl -s "${A[@]}" $B/ressize.json)
check "ressize is 1" '{"user":"alice","size":1}' "$rs"
resp=$(curl -s "${A[@]}" $B/user/alice/res)
contains "res page shows reply" 'reply to alice' "$resp"
rs=$(curl -s "${A[@]}" $B/ressize.json)
check "ressize cleared" '{"user":"alice","size":0}' "$rs"

# 8. photo post (1x1 png)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB\x60\x82' > /tmp/one.png
curl -s -o /dev/null "${A[@]}" -X POST -F 'body=with photo' -F 'photo=@/tmp/one.png;type=image/png' $B/statement
json=$(curl -s "${A[@]}" $B/index.json)
contains "photo url in hash" '"photos":["/media/' "$json"
media=$(printf '%s' "$json" | grep -o '/media/[^"]*' | head -1)
mcode=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "${A[@]}" "$B$media")
check "media served" "200 image/png" "$mcode"

# 9. bob cannot delete alice's statement (id 1); alice can
curl -s -o /dev/null "${BOB[@]}" -X DELETE $B/statement/1
json=$(curl -s "${A[@]}" $B/index.json)
contains "statement survives bob delete" 'hello massr' "$json"
curl -s -o /dev/null "${A[@]}" -X DELETE $B/statement/1
json=$(curl -s "${A[@]}" $B/index.json)
case "$json" in *'hello massr'*) echo "FAIL: alice delete"; fail=$((fail+1));; *) echo "PASS: alice delete"; pass=$((pass+1));; esac

# 10. user json + users page
uj=$(curl -s "${A[@]}" $B/user/alice.json)
contains "user json is array of statements" '"massr_id":"alice"' "$uj"
users=$(curl -s "${A[@]}" $B/users.html)
contains "users page lists bob" '@bob' "$users"

echo "== RESULT: pass=$pass fail=$fail"
