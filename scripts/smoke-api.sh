#!/usr/bin/env bash
# End-to-end smoke test of the running API (docker compose stack, seeded). Never prints secrets.
#   ./scripts/smoke-api.sh            (API at http://127.0.0.1:4000)
# Needs: curl, jq, ffmpeg (for the upload test). Reads SEED_PASSWORD from .env.
set -euo pipefail
cd "$(dirname "$0")/.."
API="${API:-http://127.0.0.1:4000}/api"
SEED_PASSWORD="$(grep -E '^SEED_PASSWORD=' .env | cut -d= -f2-)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected $3, got $2)"; fi; }

# req <jar> <method> <path> [json-body]  → body in $TMP/body, status in $code
req() {
  local jar="$TMP/$1.jar" method="$2" path="$3" body="${4:-}"
  local csrf; csrf="$(awk '$6=="csrf"{print $7}' "$jar" 2>/dev/null | tail -1 || true)"
  local args=(-s -o "$TMP/body" -w '%{http_code}' -b "$jar" -c "$jar" -X "$method" -H 'Content-Type: application/json')
  [ -n "$csrf" ] && args+=(-H "X-CSRF-Token: $csrf")
  [ -n "$body" ] && args+=(--data "$body")
  code="$(curl "${args[@]}" "$API$path")"
}
j() { jq -r "$1" "$TMP/body"; }
login() { req "$1" GET /auth/csrf; req "$1" POST /auth/login "{\"email\":\"$2\",\"password\":\"$SEED_PASSWORD\"}"; check "login $2" "$code" 200; }

echo "== public catalogue"
req anon GET /health; check "health" "$code" 200
req anon GET /categories; check "categories" "$(j '.items|length')" 6
req anon GET '/courses?sort=newest'; check "list published courses (>= 6 seeded)" "$(j '.total >= 6')" true
FREE_SLUG=ai-foundations-for-devops-engineers; PAID_SLUG=ai-powered-cicd-with-github-actions; NADIA_SLUG=n8n-automation-for-devops-teams
req anon GET "/courses/$PAID_SLUG"; check "course detail" "$code" 200
if grep -qE 'storageKey|videos/|resources/|X-Amz' "$TMP/body"; then bad "detail leaks storage keys/URLs"; else ok "detail has no asset URLs"; fi
PAID_ID="$(j .id)"; PREVIEW_LECTURE="$(j '[.curriculum[].lectures[]|select(.isPreview)][0].id')"; LOCKED_LECTURE="$(j '[.curriculum[].lectures[]|select(.isPreview|not)][0].id')"
THUMB="$(j .thumbnailUrl)"
if [ -n "$THUMB" ] && [ "$THUMB" != "null" ]; then check "thumbnail served" "$(curl -s -o /dev/null -w '%{http_code}' "$THUMB")" 200
else check "no thumbnail set (web draws the cover)" "none" none; fi
check "POST without CSRF header is refused" "$(curl -s -o /dev/null -w '%{http_code}' -b "$TMP/anon.jar" -X POST "$API/lectures/$PREVIEW_LECTURE/preview-playback")" 403
check "POST with wrong CSRF header is refused" "$(curl -s -o /dev/null -w '%{http_code}' -b "$TMP/anon.jar" -H 'X-CSRF-Token: wrong-token-wrong-token-123' -X POST "$API/lectures/$PREVIEW_LECTURE/preview-playback")" 403
req anon GET /auth/csrf; req anon POST "/lectures/$PREVIEW_LECTURE/preview-playback"; check "preview playback (public)" "$code" 200
check "preview video fetch from MinIO" "$(curl -s -o /dev/null -w '%{http_code}' "$(j .url)")" 200
req anon POST "/lectures/$LOCKED_LECTURE/preview-playback"; check "non-preview lecture is not public" "$code" 404
req anon GET /me/learning; check "anon /me/learning → 401" "$code" 401

echo "== register → cart → checkout (dev test payment) → enrolled → playback → progress"
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
req stu GET /auth/me; check "me (signed out) returns csrf" "$(j '.user == null and (.csrf|length) > 20')" true
req stu POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"Correct-Horse-9\",\"name\":\"Smoke Tester\"}"; check "register" "$code" 201
grep -q $'\tsid\t' "$TMP/stu.jar" && ok "sid cookie set" || bad "sid cookie missing"
grep -q '#HttpOnly_' "$TMP/stu.jar" && ok "sid is HttpOnly" || bad "sid not HttpOnly"
req stu GET /auth/me; check "me (signed in)" "$(j .user.email)" "$EMAIL"
req stu POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"Correct-Horse-9\",\"name\":\"Dup\"}"; check "duplicate email → 409" "$code" 409
req stu POST /cart '{"courseId":"not-a-uuid"}'; check "validation error shape" "$(j .error.code)" validation_failed
req stu POST /cart "{\"courseId\":\"$PAID_ID\"}"; check "add to cart" "$(j .count)" 1
req stu POST "/lectures/$LOCKED_LECTURE/playback"; check "playback before buying → 403" "$code" 403
req stu POST /checkout; check "checkout" "$(j .mode)" test
ORDER="$(j .orderId)"
req stu POST "/dev/test-payments/$ORDER/complete"; check "dev test payment fulfils" "$(j .alreadyFulfilled)" false
req stu POST "/dev/test-payments/$ORDER/complete"; check "second completion is a no-op (idempotent)" "$(j .alreadyFulfilled)" true
req stu GET "/orders/$ORDER"; check "order paid" "$(j .status)" paid
req stu GET /cart; check "cart cleared" "$(j .count)" 0
req stu GET /me/learning; check "enrolled (My Learning)" "$(j "[.items[].course.slug]|index(\"$PAID_SLUG\") != null")" true
req stu POST "/lectures/$LOCKED_LECTURE/playback"; check "playback URL" "$code" 200
check "playback video fetch from MinIO" "$(curl -s -o "$TMP/v.mp4" -w '%{http_code}' "$(j .url)")" 200
check "video content-type" "$(curl -s -o /dev/null -w '%{content_type}' "$(j .url)")" video/mp4
req stu PUT "/lectures/$LOCKED_LECTURE/progress" '{"positionSec":7}'; check "save progress" "$(j .positionSec)" 7
req stu GET "/me/courses/$PAID_SLUG"; check "resume position" "$(j "[.sections[].lectures[]|select(.id==\"$LOCKED_LECTURE\")][0].progress.positionSec")" 7
RES_ID="$(j '[.sections[].lectures[].resources[]][0].id')"
req stu POST "/resources/$RES_ID/download"; check "resource download URL" "$code" 200
check "resource ZIP fetch" "$(curl -s -o "$TMP/lab.zip" -w '%{http_code}' "$(j .url)")" 200
req stu POST "/courses/$PAID_SLUG/reviews" '{"rating":5,"body":"Smoke test review"}'; check "verified review" "$code" 201
req stu POST "/courses/$NADIA_SLUG/reviews" '{"rating":1,"body":"not enrolled"}'; check "review without enrolment → 403" "$code" 403
req stu GET /admin/stats; check "student cannot open admin → 403" "$code" 403
req stu POST /auth/logout; req stu GET /orders; check "logout ends session" "$code" 401

echo "== demo student: quiz + certificate on the free course"
login demo student@del.example
req demo GET "/me/courses/$FREE_SLUG"; check "demo student owns free course" "$code" 200
cp "$TMP/body" "$TMP/free.json"
for L in $(jq -r '.sections[].lectures[]|select(.type!="quiz")|.id' "$TMP/free.json"); do req demo PUT "/lectures/$L/progress" '{"positionSec":1,"completed":true}'; done
QUIZ="$(jq -r '[.sections[].lectures[]|select(.type=="quiz")][0].id' "$TMP/free.json")"
req demo GET "/lectures/$QUIZ/quiz"; if grep -q '"correct"' "$TMP/body"; then bad "quiz leaks answers"; else ok "quiz hides answers"; fi
req demo POST "/lectures/$QUIZ/quiz" '{"answers":[1,1,2]}'; check "quiz scored" "$(j .score)" 100
req demo POST "/courses/$FREE_SLUG/certificate"; check "certificate at 100%" "$code" 200
CODE="$(j .code)"; req anon GET "/certificates/$CODE"; check "certificate verifies publicly" "$(j .valid)" true

echo "== instructor ownership + upload + admin approval"
login nadia nadia@instructor.example
req nadia GET "/instructor/courses/$PAID_ID"; check "instructor cannot read another instructor's course" "$code" 404
req nadia PATCH "/instructor/courses/$PAID_ID" '{"title":"Hijacked"}'; check "instructor cannot edit another instructor's course" "$code" 404
req nadia GET /instructor/sales; check "instructor sales (own)" "$code" 200
req nadia GET /categories; CAT="$(j '.items[0].id')"
req nadia POST /instructor/courses "{\"title\":\"Smoke Course $RANDOM\",\"categoryId\":\"$CAT\",\"description\":\"A course created by the smoke test.\",\"priceCents\":1999}"; check "create course" "$code" 201
NEW_ID="$(j .id)"; NEW_SLUG="$(j .slug)"
req nadia POST "/instructor/courses/$NEW_ID/sections" '{"title":"Intro"}'; SEC="$(j .id)"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=320x180:rate=15:duration=11 -f lavfi -i sine=frequency=500:duration=11 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$TMP/up.mp4"
req nadia POST /instructor/uploads/video '{"filename":"intro.mp4","contentType":"video/mp4"}'; check "upload target" "$code" 201
ASSET="$(j .assetId)"; check "presigned PUT to MinIO" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: video/mp4' --data-binary @"$TMP/up.mp4" "$(j .uploadUrl)")" 200
req nadia POST "/instructor/uploads/video/$ASSET/complete"; check "upload complete → processing" "$(j .status)" processing
for _ in $(seq 1 30); do req nadia GET "/instructor/videos/$ASSET"; [ "$(j .status)" = ready ] && break; sleep 1; done
check "worker ffprobe marks video ready" "$(j .status)" ready; check "duration from ffprobe" "$(j .durationSec)" 11
req nadia POST "/instructor/courses/$NEW_ID/sections/$SEC/lectures" "{\"title\":\"Welcome\",\"videoAssetId\":\"$ASSET\",\"isPreview\":true}"; check "add lecture with video" "$(j .durationSec)" 11
req nadia POST "/instructor/courses/$NEW_ID/submit"; check "submit for review" "$(j .status)" in_review
req anon GET "/courses/$NEW_SLUG"; check "unpublished course hidden from public" "$code" 404
login admin admin@del.example
req admin GET /admin/review-queue; check "course in review queue" "$(j "[.items[].id]|index(\"$NEW_ID\") != null")" true
req admin POST "/admin/courses/$NEW_ID/request-changes" '{}'; check "request-changes needs a note" "$code" 400
req admin POST "/admin/courses/$NEW_ID/approve" '{"note":"Looks good"}'; check "admin approves" "$(j .status)" published
req anon GET "/courses/$NEW_SLUG"; check "approved course is public" "$code" 200
req admin GET '/admin/audit?action=course.'; check "approval is audited" "$(j "[.items[]|select(.targetId==\"$NEW_ID\" and .action==\"course.approve\")]|length")" 1
req admin GET /admin/settings; check "commission default 0" "$(j .commission_bps)" 0

echo "== refund revokes enrolment"
req admin POST "/admin/orders/$ORDER/refund" '{"reason":"smoke test"}'; check "admin refund" "$(j .status)" refunded
req stu2 GET /auth/csrf; req stu2 POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"Correct-Horse-9\"}"
req stu2 POST "/lectures/$LOCKED_LECTURE/playback"; check "playback after refund → 403" "$code" 403

echo "== instructor application → admin approval"
APP_EMAIL="applicant-$(date +%s)-$RANDOM@example.com"
req appl GET /auth/csrf; req appl POST /auth/register "{\"email\":\"$APP_EMAIL\",\"password\":\"Correct-Horse-9\",\"name\":\"Applicant\"}"
req appl GET /instructor/courses; check "student cannot use the studio → 403" "$code" 403
req appl POST /instructor/apply '{"headline":"Kubernetes trainer","bio":"I have taught Kubernetes to platform teams for six years."}'; check "apply as instructor" "$(j .status)" pending
APP_ID="$(j .userId)"
req admin GET '/admin/instructors?status=pending'; check "application in admin list" "$(j "[.items[].userId]|index(\"$APP_ID\") != null")" true
req admin POST "/admin/instructors/$APP_ID/approve" '{}'; check "admin approves instructor" "$(j .status)" approved
req appl GET /instructor/courses; check "approved instructor can use the studio" "$code" 200

echo "== cleanup"
req admin POST "/admin/courses/$NEW_ID/unpublish" '{"note":"smoke test cleanup"}'; check "smoke course unpublished again" "$(j .status)" unpublished

echo; echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
