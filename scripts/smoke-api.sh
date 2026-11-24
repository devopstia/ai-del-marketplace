#!/usr/bin/env bash
# End-to-end smoke test of the running API (docker compose stack, seeded AND imported:
#   npm run seed && npm run import:del). Never prints secrets.
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
fetch() { curl -s -o "${2:-/dev/null}" -w '%{http_code}' "$1"; }

# Catalogue (owner, 2026-11-24): ONE DEL course "AI for DevOps" (import) + the seeded demo instructor's courses (multi-instructor checks).
PAID_SLUG=ai-for-devops; NADIA_SLUG=n8n-automation-for-devops-teams

echo "== public catalogue (real DEL catalogue imported)"
req anon GET /health; check "health" "$code" 200
req anon GET /categories; check "categories" "$(j '.items|length')" 6
req anon GET '/courses?sort=newest&pageSize=48'; check "published courses: AI for DevOps + demo instructor" "$(j "[.items[].slug]|index(\"$PAID_SLUG\") != null and index(\"$NADIA_SLUG\") != null")" true
cp "$TMP/body" "$TMP/list.json"
req anon GET '/courses?q=RAG%20Terraform'; check "search: every word, across course and curriculum (RAG Terraform)" "$(j "[.items[].slug]|index(\"$PAID_SLUG\") != null")" true
req anon GET '/courses?q=zzzz-no-such-topic'; check "search with no match is empty" "$(j .total)" 0
FAKE=0; for S in $(jq -r '.items[].slug' "$TMP/list.json"); do
  req anon GET "/courses/$S/reviews?pageSize=50"; FAKE=$((FAKE + $(j '[.items[]|select(.author.name|test("Priya Natarajan|Marco Rossi|Lena Fischer"))]|length')))
done; check "no invented reviews on any course" "$FAKE" 0
req anon GET /platform/terms; check "terms: instructors keep 80%" "$(j .instructorSharePercent)" 80
check "terms: price range" "$(j '"\(.pricing.minCents)-\(.pricing.maxCents)"')" 499-99999
req anon GET "/courses/$PAID_SLUG"; check "course detail" "$code" 200
if grep -qE 'storageKey|videos/|resources/|X-Amz' "$TMP/body"; then bad "detail leaks storage keys/URLs"; else ok "detail has no asset URLs"; fi
check "imported course: lectures from the source videos" "$(j '.totals.lectures >= 40 and .totals.lectures == .totals.videoLectures')" true
TOTAL_LECTURES="$(j .totals.lectures)"
check "detail: resourceCount from lab ZIPs" "$(j '.resourceCount > 0 and (.labFiles|length) == .resourceCount')" true
check "detail: captions available" "$(j .hasCaptions)" true
check "detail: lastVerifiedAt set" "$(j '.lastVerifiedAt != null')" true
check "detail: viewer block (signed out)" "$(j '.viewer.signedIn')" false
check "detail: lecture summaries" "$(j '[.curriculum[].lectures[]|select(.summary!="")]|length > 0')" true
check "free previews from several sections" "$(j '[.curriculum[]|select(any(.lectures[]; .isPreview))]|length >= 2')" true
PAID_ID="$(j .id)"; DEL_ID="$(j .instructor.id)"; PREVIEW_LECTURE="$(j '[.curriculum[].lectures[]|select(.isPreview)][0].id')"; LOCKED_LECTURE="$(j '[.curriculum[].lectures[]|select(.isPreview|not)][0].id')"
check "real course thumbnail served" "$(fetch "$(j .thumbnailUrl)")" 200
check "POST without CSRF header is refused" "$(curl -s -o /dev/null -w '%{http_code}' -b "$TMP/anon.jar" -X POST "$API/lectures/$PREVIEW_LECTURE/preview-playback")" 403
check "POST with wrong CSRF header is refused" "$(curl -s -o /dev/null -w '%{http_code}' -b "$TMP/anon.jar" -H 'X-CSRF-Token: wrong-token-wrong-token-123' -X POST "$API/lectures/$PREVIEW_LECTURE/preview-playback")" 403
req anon GET /auth/csrf; req anon POST "/lectures/$PREVIEW_LECTURE/preview-playback"; check "preview playback (public)" "$code" 200
check "imported MP4 via signed URL" "$(fetch "$(j .url)")" 200
check "captions WebVTT via signed URL" "$(fetch "$(j .captionsUrl)" "$TMP/c.vtt")" 200
check "captions are WebVTT" "$(head -c 6 "$TMP/c.vtt")" WEBVTT
req anon POST "/lectures/$LOCKED_LECTURE/preview-playback"; check "non-preview lecture is not public" "$code" 404
req anon GET /me/learning; check "anon /me/learning → 401" "$code" 401
req anon GET /instructors/featured; check "featured instructors" "$code" 200
check "featured: DEL course count is real" "$(j ".items[]|select(.id==\"$DEL_ID\")|.courseCount")" "$(jq "[.items[]|select(.instructor.id==\"$DEL_ID\")]|length" "$TMP/list.json")"
F_STUDENTS="$(j ".items[]|select(.id==\"$DEL_ID\")|.studentCount")"
req anon GET "/instructors/$DEL_ID"; check "featured and profile agree on learners" "$(j .stats.students)" "$F_STUDENTS"
req anon GET "/courses/$NADIA_SLUG"; NADIA_ID="$(j .id)"; NADIA_LOCKED="$(j '[.curriculum[].lectures[]|select(.isPreview|not)][0].id')"

echo "== guest cart → register (merge) → checkout (dev test payment) → enrolled → playback"
req guest GET /auth/csrf
req guest GET /cart; check "signed-out /cart → 401 (guest cart lives in the browser)" "$code" 401
req guest POST /cart/preview "{\"courseIds\":[\"$PAID_ID\",\"$NADIA_ID\",\"00000000-0000-4000-8000-000000000000\"]}"; check "guest cart preview" "$(j .count)" 2
check "guest cart total" "$(j .totalCents)" "$(jq "[.items[]|select(.id==\"$PAID_ID\" or .id==\"$NADIA_ID\")|.priceCents]|add" "$TMP/list.json")"
check "guest cart flags unknown ids" "$(j '.unavailableIds|length')" 1
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
req stu GET /auth/me; check "me (signed out) returns csrf" "$(j '.user == null and (.csrf|length) > 20')" true
req stu POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"Correct-Horse-9\",\"name\":\"Smoke Tester\",\"cartCourseIds\":[\"$PAID_ID\"]}"; check "register" "$code" 201
check "register merges the guest cart" "$(j .cart.count)" 1
grep -q $'\tsid\t' "$TMP/stu.jar" && ok "sid cookie set" || bad "sid cookie missing"
grep -q '#HttpOnly_' "$TMP/stu.jar" && ok "sid is HttpOnly" || bad "sid not HttpOnly"
req stu GET /auth/me; check "me (signed in)" "$(j .user.email)" "$EMAIL"
req stu POST /auth/register "{\"email\":\"$EMAIL\",\"password\":\"Correct-Horse-9\",\"name\":\"Dup\"}"; check "duplicate email → 409" "$code" 409
req stu POST /cart '{"courseId":"not-a-uuid"}'; check "validation error shape" "$(j '.error.code + " " + .error.details[0].field')" "validation_failed courseId"
req stu POST /courses/$NADIA_SLUG/reviews '{"rating":1,"body":"not enrolled"}'; check "review without enrolment → 403" "$code" 403
req stu POST /cart/merge "{\"courseIds\":[\"$NADIA_ID\",\"$PAID_ID\"]}"; check "merge adds new courses" "$(j '.merge.added|length')" 1
check "merge skips what is already in the cart" "$(j '.merge.skipped[0].reason')" already_in_cart
check "cart has both" "$(j .count)" 2
req stu GET "/courses/$PAID_SLUG"; check "viewer block: in cart" "$(j '"\(.viewer.signedIn) \(.viewer.inCart) \(.viewer.enrolled)"')" "true true false"
req stu POST "/lectures/$LOCKED_LECTURE/playback"; check "playback before buying → 403" "$code" 403
req stu POST /checkout "{\"immediateAccessConsent\":true}"; check "checkout" "$(j .mode)" test
ORDER="$(j .orderId)"
req stu POST "/dev/test-payments/$ORDER/complete"; check "dev test payment fulfils" "$(j .alreadyFulfilled)" false
req stu POST "/dev/test-payments/$ORDER/complete"; check "second completion is a no-op (idempotent)" "$(j .alreadyFulfilled)" true
req stu GET "/orders/$ORDER"; check "order paid" "$(j .status)" paid
req stu GET /cart; check "cart cleared" "$(j .count)" 0
req stu GET /me/learning; check "enrolled (My Learning)" "$(j "[.items[].course.slug]|index(\"$PAID_SLUG\") != null")" true
req stu POST "/lectures/$LOCKED_LECTURE/playback"; check "playback URL (enrolled)" "$code" 200
check "imported MP4 plays for the student" "$(fetch "$(j .url)")" 200
check "video content-type" "$(curl -s -r 0-1023 -o /dev/null -w '%{content_type}' "$(j .url)")" video/mp4
req stu PUT "/lectures/$LOCKED_LECTURE/progress" '{"positionSec":7}'; check "save progress" "$(j .positionSec)" 7
req stu GET "/me/courses/$PAID_SLUG"; check "resume position" "$(j "[.sections[].lectures[]|select(.id==\"$LOCKED_LECTURE\")][0].progress.positionSec")" 7
check "imported lectures have quizzes" "$(j '[.sections[].lectures[]|select(.hasQuiz)]|length > 0')" true
RES_ID="$(j '[.sections[].lectures[].resources[]][0].id')"
req stu POST "/resources/$RES_ID/download"; check "lab ZIP download URL" "$code" 200
check "lab ZIP fetch" "$(fetch "$(j .url)" "$TMP/lab.zip")" 200
check "lab ZIP is a ZIP" "$(head -c 2 "$TMP/lab.zip")" PK
req stu POST "/courses/$PAID_SLUG/reviews" '{"rating":5,"body":"Smoke test review"}'; check "verified review" "$code" 201
req stu GET /admin/stats; check "student cannot open admin → 403" "$code" 403

echo "== buyer: real quiz + certificate on the purchased DEL course"
login del courses@del.example
req del GET "/instructor/courses/$PAID_ID"; cp "$TMP/body" "$TMP/paid-owner.json"
check "DEL instructor sees the imported course" "$(jq '[.sections[].lectures[]]|length' "$TMP/paid-owner.json")" "$TOTAL_LECTURES"
req stu GET "/me/courses/$PAID_SLUG"; check "buyer opens the course" "$code" 200
cp "$TMP/body" "$TMP/paid.json"
for L in $(jq -r '.sections[].lectures[].id' "$TMP/paid.json"); do req stu PUT "/lectures/$L/progress" '{"positionSec":1,"completed":true}'; done
QUIZ="$(jq -r '[.sections[].lectures[]|select(.hasQuiz)][0].id' "$TMP/paid.json")"
req stu GET "/lectures/$QUIZ/quiz"; if grep -q '"correct"' "$TMP/body"; then bad "quiz leaks answers"; else ok "quiz hides answers"; fi
check "real quiz has 3–5 questions" "$(j '(.questions|length) >= 3 and (.questions|length) <= 5')" true
ANSWERS="$(jq -c --arg q "$QUIZ" '[.sections[].lectures[]|select(.id==$q)][0].quiz.questions|map(.correct)' "$TMP/paid-owner.json")"
req stu POST "/lectures/$QUIZ/quiz" "{\"answers\":$ANSWERS}"; check "quiz scored" "$(j .score)" 100
req stu POST "/courses/$PAID_SLUG/certificate"; check "certificate at 100%" "$code" 200
CODE="$(j .code)"; req anon GET "/certificates/$CODE"; check "certificate verifies publicly" "$(j .valid)" true

echo "== instructor: ownership, pricing rules, Stripe calm state, upload, admin approval"
login nadia nadia@instructor.example
req nadia GET "/instructor/courses/$PAID_ID"; check "instructor cannot read another instructor's course" "$code" 404
req nadia PATCH "/instructor/courses/$PAID_ID" '{"title":"Hijacked"}'; check "instructor cannot edit another instructor's course" "$code" 404
req nadia GET /instructor/sales; check "instructor sales (own)" "$code" 200
req nadia GET /instructor/stripe/status; check "stripe status says not configured" "$(j .stripeConfigured)" false
req nadia POST /instructor/stripe/onboarding-link; check "onboarding without Stripe → 503 stripe_not_configured" "$code $(j .error.code)" "503 stripe_not_configured"
req nadia GET /categories; CAT="$(j '.items[0].id')"
req nadia POST /instructor/courses "{\"title\":\"Smoke Course $RANDOM\",\"categoryId\":\"$CAT\",\"description\":\"A course created by the smoke test.\",\"priceCents\":50}"; check "price below \$4.99 → 400" "$code" 400
check "price error names the field" "$(j '.error.details[0].field')" priceCents
check "price error is plain English" "$(j '.error.details[0].message')" 'Price must be 0 (free) or between $4.99 and $999.99'
req nadia POST /instructor/courses "{\"title\":\"Smoke Course $RANDOM\",\"categoryId\":\"$CAT\",\"description\":\"A course created by the smoke test.\",\"priceCents\":1999}"; check "create course" "$code" 201
NEW_ID="$(j .id)"; NEW_SLUG="$(j .slug)"
check "new course: promo video field" "$(j 'has("promoVideo")')" true
req nadia POST "/instructor/courses/$NEW_ID/sections" '{"title":"Intro"}'; SEC="$(j .id)"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i testsrc2=size=320x180:rate=15:duration=11 -f lavfi -i sine=frequency=500:duration=11 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$TMP/up.mp4"
upload_video() {
  req nadia POST /instructor/uploads/video '{"filename":"intro.mp4","contentType":"video/mp4"}'
  local asset; asset="$(j .assetId)"
  curl -s -o /dev/null -X PUT -H 'Content-Type: video/mp4' --data-binary @"$TMP/up.mp4" "$(j .uploadUrl)"
  req nadia POST "/instructor/uploads/video/$asset/complete"
  for _ in $(seq 1 30); do req nadia GET "/instructor/videos/$asset"; [ "$(j .status)" = ready ] && break; sleep 1; done
  echo "$asset"
}
ASSET="$(upload_video)"; req nadia GET "/instructor/videos/$ASSET"
check "worker ffprobe marks video ready" "$(j .status)" ready; check "duration from ffprobe" "$(j .durationSec)" 11
req nadia POST "/instructor/courses/$NEW_ID/sections/$SEC/lectures" "{\"title\":\"Welcome\",\"videoAssetId\":\"$ASSET\",\"isPreview\":true}"; check "add lecture with video" "$(j .durationSec)" 11
req nadia POST "/instructor/courses/$NEW_ID/submit"; check "submit for review" "$(j .status)" in_review
req anon GET "/courses/$NEW_SLUG"; check "unpublished course hidden from public" "$code" 404
login admin admin@del.example
req admin GET /admin/review-queue; check "course in review queue" "$(j "[.items[]|select(.id==\"$NEW_ID\")][0].kind")" course
req admin POST "/admin/courses/$NEW_ID/request-changes" '{}'; check "request-changes needs a note" "$code" 400
req admin POST "/admin/courses/$NEW_ID/approve" '{"note":"Looks good"}'; check "admin approves" "$(j .status)" published
req anon GET "/courses/$NEW_SLUG"; check "approved course is public" "$code" 200
LIVE_TITLE="$(j .title)"
req admin GET '/admin/audit?action=course.'; check "approval is audited" "$(j "[.items[]|select(.targetId==\"$NEW_ID\" and .action==\"course.approve\")]|length")" 1
req admin GET /admin/settings; check "commission default 2000 bps (instructors keep 80%)" "$(j .commission_bps)" 2000

echo "== revisions: edits to a published course wait for approval"
req nadia PATCH "/instructor/courses/$NEW_ID" '{"title":"Smoke Course (revised)","priceCents":2999}'; check "edit a published course" "$(j .version)" draft
check "draft shows the change list" "$(j '[.revision.changes[].message]|map(select(startswith("Price:")))|length')" 1
req nadia POST "/instructor/courses/$NEW_ID/sections" '{"title":"Bonus"}'; BONUS="$(j .id)"
V2="$(upload_video)"
req nadia POST "/instructor/courses/$NEW_ID/sections/$BONUS/lectures" "{\"title\":\"New lesson\",\"videoAssetId\":\"$V2\"}"; check "add a lecture to the draft" "$code" 201
req anon GET "/courses/$NEW_SLUG"; check "live course unchanged while editing" "$(j '"\(.title)|\(.priceCents)|\(.totals.lectures)"')" "$LIVE_TITLE|1999|1"
req nadia GET "/instructor/courses/$NEW_ID?version=live"; check "studio can show the live version" "$(j '"\(.version)|\(.title)"')" "live|$LIVE_TITLE"
req nadia POST "/instructor/courses/$NEW_ID/submit"; check "submit changes" "$(j .revision.status)" in_review
req nadia PATCH "/instructor/courses/$NEW_ID" '{"title":"Sneaky"}'; check "draft is locked in review → 409" "$code $(j .error.code)" "409 course_locked"
req admin GET /admin/review-queue; check "revision in the review queue" "$(j "[.items[]|select(.id==\"$NEW_ID\")][0].kind")" revision
check "queue lists what changed" "$(j "[.items[]|select(.id==\"$NEW_ID\")][0].changes|length > 2")" true
req admin POST "/admin/courses/$NEW_ID/request-changes" '{"note":"Please keep the old price"}'; check "admin requests changes" "$(j .revision.status)" changes_requested
req anon GET "/courses/$NEW_SLUG"; check "live course unchanged after request-changes" "$(j .priceCents)" 1999
req nadia PATCH "/instructor/courses/$NEW_ID" '{"priceCents":1999}'; check "editable again after request-changes" "$code" 200
req nadia POST "/instructor/courses/$NEW_ID/submit"; check "resubmit" "$(j .revision.status)" in_review
req admin POST "/admin/courses/$NEW_ID/approve" '{"note":"Approved"}'; check "admin approves the revision" "$(j .revision.status)" approved
req anon GET "/courses/$NEW_SLUG"; check "approved changes are live together" "$(j '"\(.title)|\(.priceCents)|\(.totals.lectures)"')" "Smoke Course (revised)|1999|2"
req nadia PATCH "/instructor/courses/$NEW_ID" '{"title":"Rejected title"}'; req nadia POST "/instructor/courses/$NEW_ID/submit"
req admin POST "/admin/courses/$NEW_ID/reject" '{"note":"No"}'; check "admin rejects a revision" "$(j .revision.status)" rejected
req anon GET "/courses/$NEW_SLUG"; check "rejected revision leaves the live course" "$(j .title)" "Smoke Course (revised)"
req admin GET "/admin/audit?action=course.revision_&targetId=$NEW_ID"; check "revision decisions audited" "$(j '.total >= 4')" true

echo "== admin lists: pagination, search, order detail, partial refund"
req admin GET '/admin/users?page=1&pageSize=2'; check "users paginated" "$(j '"\(.items|length) \(.page) \(.pageSize) \(.totalPages == ((.total + 1) / 2 | floor))"')" "2 1 2 true"
req admin GET '/admin/users?page=2&pageSize=2'; check "users page 2" "$(j '.page')" 2
req admin GET '/admin/courses?pageSize=2'; check "courses paginated" "$(j '"\(.items|length) \(.total > 2) \(.pageSize)"')" "2 true 2"
req admin GET '/admin/instructors?pageSize=1'; check "instructors paginated" "$(j '"\(.items|length) \(.total >= 2)"')" "1 true"
req admin GET "/admin/audit?q=$(printf %s "$EMAIL" | jq -sRr @uri)&pageSize=5"; check "audit search by actor email (server-side)" "$(j '.total >= 1')" true
req admin GET "/admin/orders?q=$(printf %s "$EMAIL" | jq -sRr @uri)"; check "orders search + course titles" "$(j '.items[0].courses|length')" 2
req admin GET "/admin/orders/$ORDER"; check "order detail" "$(j '.lines|length')" 2
DEL_LINE="$(j ".lines[]|select(.course.id==\"$PAID_ID\")|.id")"
check "DEL line: platform, no transfer" "$(j ".lines[]|select(.id==\"$DEL_LINE\")|\"\(.instructor.isPlatform) \(.transferStatus) \(.instructorShareCents)\"")" "true none 0"
check "independent line: 20% commission" "$(j ".lines[]|select(.course.id==\"$NADIA_ID\")|.commissionBps")" 2000
req admin POST "/admin/orders/$ORDER/refund" '{"lineIds":["00000000-0000-4000-8000-000000000000"]}'; check "refund of a foreign line → 400" "$(j .error.code)" invalid_line
req admin POST "/admin/orders/$ORDER/refund" "{\"lineIds\":[\"$DEL_LINE\"],\"reason\":\"smoke partial\"}"; check "partial refund" "$(j .status)" partially_refunded
check "only that line is refunded" "$(j '[.lines[]|select(.refundedAt != null)]|length')" 1
req stu2 GET /auth/csrf; req stu2 POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"Correct-Horse-9\"}"
req stu2 POST "/lectures/$LOCKED_LECTURE/playback"; check "refunded course locked again → 403" "$code" 403
req stu2 POST "/lectures/$NADIA_LOCKED/playback"; check "other course of the order still plays" "$code" 200
req admin POST "/admin/orders/$ORDER/refund" '{"reason":"smoke rest"}'; check "refund the rest" "$(j .status)" refunded

echo "== instructor application → admin approval"
APP_EMAIL="applicant-$(date +%s)-$RANDOM@example.com"
req appl GET /auth/csrf; req appl POST /auth/register "{\"email\":\"$APP_EMAIL\",\"password\":\"Correct-Horse-9\",\"name\":\"Applicant\"}"
req appl GET /instructor/courses; check "student cannot use the studio → 403" "$code" 403
req appl POST /instructor/apply '{"headline":"Kubernetes trainer","bio":"I have taught Kubernetes to platform teams for six years."}'; check "apply as instructor" "$(j .status)" pending
APP_ID="$(j .userId)"
req admin GET '/admin/instructors?status=pending&pageSize=100'; check "application in admin list" "$(j "[.items[].userId]|index(\"$APP_ID\") != null")" true
req admin POST "/admin/instructors/$APP_ID/approve" '{}'; check "admin approves instructor" "$(j .status)" approved
req appl GET /instructor/courses; check "approved instructor can use the studio" "$code" 200

echo "== cleanup"
req admin POST "/admin/courses/$NEW_ID/unpublish" '{"note":"smoke test cleanup"}'; check "smoke course unpublished again" "$(j .status)" unpublished
req stu2 POST /auth/logout; req stu2 GET /orders; check "logout ends session" "$code" 401

echo; echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
