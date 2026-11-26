# API reference (v1)

NestJS API in `apps/api`. Contract: [BUILD_SPEC.md](BUILD_SPEC.md). This page is for the web app team.

- **Base URL:** `http://127.0.0.1:4000/api` (env `API_URL` + `/api`). All bodies are JSON.
- **CORS:** only `WEB_URL` (default `http://127.0.0.1:3000`), with credentials. Send `credentials: 'include'` on every `fetch`.
- **Smoke test of every flow below:** `./scripts/smoke-api.sh` (needs the stack running and seeded).

## Sessions, cookies and CSRF

| Cookie | Set by | Flags | Purpose |
|---|---|---|---|
| `sid` | register / login | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, 30 days | Opaque session id (the DB stores only its SHA-256). Never readable by JS. |
| `csrf` | any request that arrives without one | **not** HttpOnly, `SameSite=Lax`, `Path=/`, 30 days | Double-submit CSRF token. |

**Every `POST`, `PUT`, `PATCH`, `DELETE` must send header `X-CSRF-Token: <csrf>`**, including login and register (webhooks are the
only exception). Get the token from:

- `GET /auth/me` → `{ user, csrf }` (works signed out: `{ user: null, csrf }`), or `GET /auth/csrf` → `{ csrf }`, or
- the `csrf` cookie (`document.cookie`), when the web app and the API share a host (cookies ignore ports, so `127.0.0.1:3000`
  can read a cookie set by `127.0.0.1:4000`).

The very first response that *mints* the cookie cannot be used for a write in the same request, so bootstrap with
`GET /auth/me` once on load. For server-side calls (Next.js route handlers/RSC), forward the browser's `Cookie` header and
the `X-CSRF-Token` header, and pass `X-Forwarded-For` (the API trusts loopback/private proxies; the login rate limit is per IP).

Login/register/password are rate limited to `AUTH_RATE_LIMIT` (default 20) requests per minute per IP → `429 rate_limited`.

## Errors

Every error has one shape:

```json
{ "error": { "code": "validation_failed", "message": "Price must be 0 (free) or between $4.99 and $999.99.",
             "details": [{ "field": "priceCents", "path": "priceCents", "message": "Price must be 0 (free) or between $4.99 and $999.99" }] } }
```

`details` is always `[{ field, message }]` (plain English, ready to show next to the field; `path` = `field`, kept for older
code) for `validation_failed`, `not_ready` (fields `description`, `categoryId`, `curriculum`, `promoVideoAssetId`),
`invalid_quiz` (`questions.N.correct`), `invalid_category`, `invalid_thumbnail` and `invalid_line`. Several problems →
`message` = "Please fix N fields: …".

| Status | Typical `code`s |
|---|---|
| 400 | `validation_failed` (has `details`), `invalid_json`, `cart_empty`, `note_required`, `not_ready`, `video_not_ready`, `upload_missing`, `invalid_signature`, `invalid_line`, `platform_account` |
| 401 | `unauthorized` (no/expired session), `invalid_credentials` |
| 403 | `forbidden` (role), `csrf_invalid`, `not_enrolled`, `account_suspended`, `super_admin_required`, `self_change` |
| 404 | `not_found` (also returned for other people's resources: ownership failures look like "does not exist") |
| 409 | `conflict`, `email_taken`, `already_enrolled`, `course_locked` (course or its changes in review), `invalid_status`, `no_changes`, `video_not_ready`, `not_complete`, `already_applied` |
| 429 | `rate_limited` |
| 503 | `payments_unavailable`, `stripe_not_configured`, `mux_not_configured` |

Money is always integer cents (`priceCents`, `totalCents`), currency `usd`. Dates are ISO strings. IDs are UUIDs.
Lists return `{ items: [...] }`, paginated lists add `{ page, pageSize, total, totalPages? }`.

## Auth legend

`public` = no session needed · `user` = any signed-in user · `instructor` = role instructor (approved) · `admin` = admin or
super_admin · `super` = super_admin. "Own" means the service only ever returns/changes the caller's own rows.

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status: "ok", time }` |
| GET | `/categories` | `{ items: [{ id, slug, name, icon, courseCount }] }` |
| GET | `/courses?q&category&level&price&sort&page&pageSize` | Published only. `category` = slug; several with `category=a&category=b` or `category=a,b` (max 10, any of them), `level` = beginner\|intermediate\|advanced, `price` = free\|paid, `sort` = popular (default)\|newest\|rating\|price_asc\|price_desc, `pageSize` ≤ 48 (default 12). `q`: every word (max 6, case-insensitive, simple plural stemming) must appear in the title, subtitle, description, instructor name, or a section/lecture title of the live course. Returns `{ items: CourseCard[], facets, page, pageSize, total, totalPages }`. `facets = { category: {slug: n}, level: {level: n}, price: {free, paid} }`: how many courses each option would show with the other filters kept (a facet ignores its own filter). CourseCard adds `hasPreview` (any free-preview lecture) and `outcome` (first objective or null). Sales: `onSale=1` lists only discounted courses (`facets.onSale` counts them); `sort=discount` orders by percent off; price sorts use the current price. CourseCard `priceCents` is what a learner pays **now**, `listPriceCents` the regular price, `sale` = `{ kind: course_sale\|promotion, id, name, endsAt, percentOff }` or null |
| GET | `/deals` | What is on sale now: `{ onSaleCount, maxPercentOff, promotions: [{ id, name, percentOff, endsAt, scope }] }` (site banner, Deals link, /deals) |
| GET | `/courses/:slug` | CourseDetail (below). Owner/admin can also see unpublished. **No asset URLs.** |
| GET | `/courses/:slug/reviews?page&pageSize` | `{ items: [{ id, rating, body, instructorReply, createdAt, author: { name, avatarUrl }, verifiedPurchase, watchedPercent, completed }], ratingAvg, ratingCount, distribution: { "1".."5": n }, page, pageSize, total }` |
| GET | `/instructors/featured?limit` | `{ items: FeaturedInstructor[] }`, approved instructors with ≥ 1 published course, most learners first (`limit` 1–24, default 6). Use this for home-page stats. |
| GET | `/instructors/:id` | `{ id, name, avatarUrl, headline, bio, website, stats: { courses, students, reviews }, courses: CourseCard[] }` (same counting as featured) |
| GET | `/platform/terms` | `{ currency: 'usd', pricing: { freeAllowed: true, minCents: 499, maxCents: 99999 }, commissionBps: 2000, instructorSharePercent: 80, singleCoursePurchases: true }`: show on /teach and in the pricing step; never hard-code |
| POST | `/cart/preview` | Guest cart (no session; CSRF header still needed, 60/min per IP): `{ courseIds: uuid[] (≤ 50) }` → `{ items: (CourseCard & { available: true })[], count, totalCents, currency, unavailableIds: string[] }` (order kept; drop `unavailableIds` from the browser cart). No writes. |
| POST | `/lectures/:id/preview-playback` | Only if the lecture `isPreview` and the course is published → Playback |
| POST | `/courses/:slug/promo-playback` | Course promo video (if `hasPromo`) → Playback |
| GET | `/certificates/:code` | Verify (public by link): `{ code, issuedAt, studentName, course: { title, slug, published, instructorName, totalDurationSec, lessons }, skills: string[], quizzes: { total, passed, averageBest } \| null, completed, valid: true, url, linkedInUrl }`. Review lists (`/courses/:slug/reviews`, `/me/reviews`, `/instructor/reviews`, `/admin/reviews`) add `watchedPercent` (unique seconds watched, % of course video, null without video) and `completed`. docs/TRUST.md |
| GET | `/media/images/:owner/:file` | Thumbnails/avatars (stable, cacheable). You get these as `thumbnailUrl`; don't build them. |

```ts
type CourseCard = {
  id: string; slug: string; title: string; subtitle: string; thumbnailUrl: string | null;
  instructor: { id: string; name: string }; category: { slug: string; name: string } | null;
  priceCents: number; currency: 'usd'; ratingAvg: number; ratingCount: number; studentCount: number;
  totalDurationSec: number; lectureCount: number; level: 'beginner' | 'intermediate' | 'advanced'; language: string; publishedAt: string | null;
};
type CourseDetail = CourseCard & {
  description: string /* markdown */; objectives: string[]; requirements: string[]; status: string; updatedAt: string; hasPromo: boolean;
  instructor: { id: string; name: string; avatarUrl: string | null; headline: string; bio: string };
  curriculum: { id: string; title: string; lectures: { id: string; title: string; summary: string; position: number; type: 'video' | 'article' | 'quiz'; durationSec: number; isPreview: boolean; resourceCount: number; hasQuiz: boolean; hasCaptions: boolean }[] }[];
  lastVerifiedAt: string | null;   // content checked against current tools (imported DEL courses: the video file date)
  resourceCount: number;           // show "Downloadable lab files" only when > 0
  hasCaptions: boolean;
  totals: { sections: number; lectures: number; videoLectures: number; previewLectures: number; quizzes: number; resources: number; captionedLectures: number; durationSec: number };
  labFiles: { title: string; sizeBytes: number; mime: string; lectureId: string; lectureTitle: string }[]; // titles only, no URLs
  viewer: { signedIn: boolean; enrolled: boolean; inCart: boolean; isOwner: boolean }; // ONE call: no /me/courses probe needed
};
type FeaturedInstructor = { id: string; name: string; avatarUrl: string | null; headline: string; bio: string; isPlatform: boolean;
  courseCount: number /* published */; studentCount: number /* DISTINCT learners with an active enrolment */; reviewCount: number; ratingAvg: number | null /* null = no reviews yet */ };
type Playback = { url: string; expiresAt: string; format: 'mp4' | 'hls'; captionsUrl?: string /* WebVTT */; protected?: boolean;
  // data saver (protected HLS with several qualities): single-quality playlists of the same session, and bytes per setting
  dataSaver?: { low?: string /* 360p */; audio?: string /* audio only */; sizes?: { auto: number; low: number | null; audio: number | null } } };
```

**Captions are available but OFF by default** (owner, 2026-11-24): load `captionsUrl` as `<track kind="captions">` without
`default`, so nothing shows until the learner turns captions on.

Playback URLs are presigned and expire after **5 minutes**: request a new one when the player starts or the URL expires
(`format: 'mp4'` = progressive file from MinIO; `'hls'` = Mux `.m3u8`, use hls.js). `captionsUrl` goes in a `<track kind="captions">` (not `default`).

## Auth

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/auth/register` | public | `{ email, password (10–200 chars), name, cartCourseIds?: uuid[] }` → `201 { user: Me, csrf, cart? }` + sets `sid` |
| POST | `/auth/login` | public | `{ email, password, cartCourseIds?: uuid[] }` → `200 { user: Me, csrf, cart? }` + sets `sid` (any previous session on this browser is revoked) |

`cartCourseIds` merges the guest cart in the same round trip (rules of `POST /cart/merge`); then `cart` =
`{ count, added: string[], skipped: { courseId, reason }[] }`.
| POST | `/auth/logout` | public | → `{ ok: true }`, clears `sid` |
| GET | `/auth/me` | public | `{ user: Me \| null, csrf }` |
| GET | `/auth/csrf` | public | `{ csrf }` |
| GET | `/auth/sessions` | user | `{ items: [{ id, createdAt, expiresAt, ip, userAgent, current }] }` |
| DELETE | `/auth/sessions/:id` | user (own) | `{ ok: true }` |
| POST | `/auth/password` | user | `{ currentPassword, newPassword }` → `{ ok: true }` (signs out other devices) |
| PATCH | `/me/profile` | user | `{ name?, avatarUrl? }` → `{ user }` |

```ts
type Me = { id; email; name; avatarUrl: string | null; roles: ('student'|'instructor'|'admin'|'super_admin')[]; status: 'active'|'suspended'; createdAt;
            instructor: { status: 'pending'|'approved'|'rejected'; payoutsEnabled: boolean; isPlatform: boolean } | null };
```

## Cart, checkout, orders

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/cart` | user | `{ items: (CourseCard & { available, addedAt })[], count, totalCents, currency }` |
| POST | `/cart` | user | `{ courseId }` → cart. `409 already_enrolled`, `400 own_course`, `404` if not published |
| POST | `/cart/merge` | user | `{ courseIds: uuid[] (≤ 50) }` → cart + `merge: { added: string[], skipped: { courseId, reason: 'unavailable'\|'own_course'\|'already_enrolled'\|'already_in_cart' }[] }`. Call after sign-in, then clear the browser cart. |
| DELETE | `/cart/:courseId` | user | → cart |
| DELETE | `/cart` | user | clear → cart |
| POST | `/checkout` | user | → `{ orderId, mode, url }`. **Redirect the browser to `url`.** |
| POST | `/dev/test-payments/:orderId/complete` | user (own order) | DEV ONLY (404 unless `DEV_TEST_PAYMENTS=true` and not production). Runs the real fulfilment. → `{ orderId, alreadyFulfilled, enrolledCourseIds, order: Order }`. Safe to call twice. |
| GET | `/orders` | user (own) | `{ items: Order[] }` |
| GET | `/orders/:id` | user (own) | `Order` (receipt) |

`mode` and `url`:
- `stripe` → Stripe Checkout URL. Stripe returns to `WEB_URL/checkout/success?order=<id>&session_id=...` or `WEB_URL/cart?canceled=1`.
  Enrolment happens via the webhook, so the success page should poll `GET /orders/:id` until `status === 'paid'`.
- `test` (no Stripe keys, dev only) → `WEB_URL/checkout/test-payment?order=<id>`. **The web app must provide this page**: show the
  order (`GET /orders/:id`) and a "Pay (test)" button that calls `POST /dev/test-payments/:id/complete`, then go to the success page.
- `free` (cart total 0) → already enrolled; `url` = `WEB_URL/checkout/success?order=<id>`.

**Guest cart (Udemy-style).** Anyone can fill a cart: keep it in the browser (localStorage or a cookie: course ids only),
render it with `POST /cart/preview`, ask for sign-in only at checkout, and merge it with `cartCourseIds` on login/register
(or `POST /cart/merge` afterwards). `GET /cart` stays `401` when signed out.

```ts
type Order = { id; status: 'pending'|'paid'|'failed'|'refunded'|'partially_refunded'; totalCents; currency; provider: 'stripe'|'test'|'free';
               paidAt: string | null; createdAt; lines: { id; courseId; slug; title; priceCents; refundedAt: string | null }[] };
```

## Learning (enrolled students; the course owner and admins also have access)

| Method | Path | Notes |
|---|---|---|
| GET | `/me/learning` | `{ items: [{ course: { id, slug, title, thumbnailUrl, instructor: { name } }, enrolledAt, progress: { total, completed, percent }, lastLecture: { id, title, positionSec, at } \| null, certificateCode }] }` |
| GET | `/me/courses/:slug` | Player data: `{ id, slug, title, subtitle, instructor, thumbnailUrl, access: 'enrolled'\|'owner'\|'admin', progress, lastLectureId, certificate, myReview, sections: [{ id, title, lectures: [{ id, title, summary, type, durationSec, isPreview, articleMd?, videoStatus, hasCaptions, sizes: { auto, low, audio } (bytes per data-saver setting) \| null, hasQuiz, resources: [{ id, title, sizeBytes, mime }], progress: { positionSec, completed } }] }] }`. `403 not_enrolled` otherwise. |
| GET | `/me/certificates` | `{ items: [{ code, issuedAt, course: { slug, title } }] }` |
| POST | `/lectures/:id/playback` | → Playback. Previews are allowed for anyone signed in. |
| PUT | `/lectures/:id/progress` | `{ positionSec, completed? }` → `{ lectureId, positionSec, completed, courseProgress: { total, completed, percent } }`. Completion is sticky. Send every ~10 s and on pause/end. |
| GET | `/lectures/:id/resources` | `{ items: [{ id, title, sizeBytes, mime }] }` |
| POST | `/resources/:id/download` | `{ url, expiresAt, filename }` (5 min, `Content-Disposition: attachment`) |
| GET | `/lectures/:id/quiz` | `{ id, lectureId, questions: [{ index, q, options[] }], lastAttempt: { score, at } \| null }` (answers hidden) |
| POST | `/lectures/:id/quiz` | `{ answers: number[] }` (one option index per question) → `{ score (0–100), passed (≥70), results: [{ index, chosen, correct, isCorrect, why }] }` |
| POST | `/courses/:slug/reviews` | enrolled only: `{ rating 1–5, body }` → review (creates or updates yours) |
| POST | `/courses/:slug/certificate` | enrolled + 100% complete → `{ id, code, issuedAt, ... }` (idempotent); `409 not_complete` otherwise |

## Instructor studio

`POST /instructor/apply`, `GET/PUT /instructor/profile` need only a signed-in user; everything else needs role `instructor`
(granted when an admin approves the application). All data is the caller's own: another instructor's ids return 404.

| Method | Path | Body / notes |
|---|---|---|
| POST | `/instructor/apply` | `{ headline (3–120), bio (20–5000), website? }` → profile (`status: 'pending'`) |
| GET / PUT | `/instructor/profile` | `{ headline?, bio?, website? }` → `{ userId, headline, bio, website, status, reviewNote, isPlatform, payoutsEnabled, stripeConnected }` |
| GET | `/instructor/courses` | `{ items: [{ id, slug, title, status, reviewNote, priceCents, category, thumbnailUrl, students, ratingAvg, ratingCount, updatedAt, publishedAt, revision: { id, status, reviewNote, submittedAt, updatedAt } \| null }] }` (`revision` = open draft changes of a published course) |
| POST | `/instructor/courses` | `{ title, subtitle?, description?, language?, level?, objectives?, requirements?, priceCents? (0, or 499–99999), categoryId?, thumbnailKey?, promoVideoAssetId? }` → InstructorCourse (`status: 'draft'`) |
| GET | `/instructor/courses/:id?version=live\|draft` | InstructorCourse (below). Default: the draft when a published course has draft changes, else live |
| PATCH | `/instructor/courses/:id` | same fields as create, all optional. `409 course_locked` while the course (or its changes) is in review |
| DELETE | `/instructor/courses/:id` | only drafts without students/sales |
| POST | `/instructor/courses/:id/submit` | New course → `status: 'in_review'`; **published course → submits its draft changes** (`revision.status: 'in_review'`; `409 no_changes` if nothing changed). `400 not_ready` with `details: [{ field, message }]` (description, category, ≥ 1 lecture, every video processed, promo processed) |
| DELETE | `/instructor/courses/:id/revision` | Discard the draft changes of a published course (live untouched) → InstructorCourse. `409 course_locked` while in review |
| POST | `/instructor/courses/:id/sections` | `{ title }` |
| PATCH / DELETE | `/instructor/courses/:id/sections/:sectionId` | `{ title }` |
| PUT | `/instructor/courses/:id/sections/order` | `{ ids: [sectionId, ...] }` (all of them) |
| POST | `/instructor/courses/:id/sections/:sectionId/lectures` | `{ title, type? ('video'), isPreview?, articleMd?, summary? (≤ 300), videoAssetId? }` |
| PUT | `/instructor/courses/:id/sections/:sectionId/lectures/order` | `{ ids: [lectureId, ...] }` |
| PATCH / DELETE | `/instructor/courses/:id/lectures/:lectureId` | `{ title?, type?, isPreview?, articleMd?, summary?, videoAssetId? (null detaches), sectionId? (move) }` |
| PUT / DELETE | `/instructor/courses/:id/lectures/:lectureId/quiz` | `{ questions: [{ q, options: string[3..5], correct: index, why }] }` |
| GET | `/instructor/courses/:id/lectures/:lectureId/preview` | Preview one lesson of the version the studio edits (the draft revision of a published course): `{ version, section, lecture: { id, title, type, durationSec, articleMd, summary }, video: { status, durationSec, playback: { url, expiresAt, format, captionsUrl? } \| null } \| null, quiz: [{ q, options, correct, why }] \| null, resources: [{ id, title, sizeBytes, mime }] }`. Course owner, or an admin with `courses.review` (audited `course.draft_preview`); everyone else `404`. Signed URL lives 5 minutes |
| POST | `/instructor/courses/:id/lectures/:lectureId/resources` | `{ title, storageKey }` (step 2 of a resource upload) |
| DELETE | `/instructor/courses/:id/resources/:resourceId` | |
| GET | `/instructor/sales?from&to` | `{ totals: { grossCents, commissionCents, earningsCents, refundedCents, paidOutCents, pendingPayoutCents, sales }, byCourse: [...], items: [{ orderLineId, orderId, paidAt, course, priceCents, commissionBps, instructorShareCents, transferStatus, refundedAt }] }` |
| GET | `/instructor/courses/:id/insights` | Studio › Insights: `{ course, minSample: 5, totals: { learners, viewers, averageWatchedPct \| null, aiQuestions, aiQuestionsWithoutLesson }, attention: [{ id, title, at, drop }], lectures: [{ id, title, section, type, durationSec, viewers, enoughData, averageWatchedPct \| null, retention: number[10] \| null (share of viewers who watched at least half of each tenth), biggestDrop: { at, drop } \| null, aiQuestions, quiz: { learners, enoughData, hardest: [{ index, q, wrongPct, answered }] } \| null }] }`. Course owner; a super admin any course (audited `course.insights_viewed`); everyone else `404`. Nothing per lesson or quiz below 5 learners; no learner ids; the instructor's own viewing excluded; AI questions are counts only (their text isn't stored) |
| GET | `/instructor/students?courseId` | `{ items: [{ student: { id, name }, course: { id, title }, enrolledAt, source, progressPercent }] }` |
| GET | `/instructor/reviews` | `{ items: [{ id, rating, body, status, instructorReply, createdAt, author: { name }, course }] }` |
| POST | `/instructor/reviews/:id/reply` | `{ reply }` |
| POST | `/instructor/stripe/onboarding-link` | → `{ url, expiresAt }` Stripe-hosted onboarding (returns to `WEB_URL/instructor/payouts?return=1`, expired → `?refresh=1`: call again). `503` without Stripe keys. |
| GET | `/instructor/stripe/status` | `{ connected, payoutsEnabled, isPlatform, stripeConfigured, pendingPayoutCents? }`. When `stripeConfigured` is false show a calm "payouts open soon" state: onboarding returns `503 stripe_not_configured` |

### Editing a published course (revisions)

A **published** course is never changed in place. Every studio edit (details, media, price, sections, lectures,
resources, quiz) goes to the course's **draft revision**, created from the live course on the first edit; learners keep
seeing the live course. `POST /instructor/courses/:id/submit` sends the draft for review; while it is in review the
draft is locked (`409 course_locked`). The admin approves (all changes go live in one transaction: new videos,
files and quizzes together; existing lectures keep their ids, so progress survives), requests changes (the draft is
editable again) or rejects (closed; the next edit starts a fresh draft from live). Draft, changes-requested, rejected
and unpublished courses are still edited directly. Mutation responses keep their shapes (section, lecture, quiz,
resource), with ids that stay valid after approval.

```ts
type InstructorCourse = {
  id; slug; instructorId; status; reviewNote; publishedAt; lastVerifiedAt; ratingAvg; ratingCount; studentCount; currency; createdAt; updatedAt;
  title; subtitle; description; language; level; objectives: string[]; requirements: string[]; priceCents; categoryId; thumbnailKey; promoVideoAssetId;
  category: { id; name; slug } | null; thumbnailUrl: string | null;
  promoVideo: { id; status: 'uploading'|'processing'|'ready'|'failed'; durationSec; hasCaptions; provider } | null;   // poll until ready
  version: 'live' | 'draft';                       // which content this is
  revision: null | { id; status: 'draft'|'in_review'|'changes_requested'; reviewNote: string | null; submittedAt; createdAt; updatedAt;
                     changes: { area: 'details'|'pricing'|'media'|'curriculum'; kind: 'added'|'removed'|'changed'|'reordered'; message: string }[] };
  sections: { id; courseId; title; position; lectures: { id; sectionId; title; summary; position; type; videoAssetId; articleMd; durationSec; isPreview;
    resources: { id; title; sizeBytes; mime }[]; video: { id; status; durationSec; hasCaptions; provider } | null; quiz: { questions } | null }[] }[];
};
```

### Uploads (browser → storage directly)

**Video** (`VIDEO_PROVIDER=local` → MinIO, `mux` → Mux direct upload; the response shape is the same):
1. `POST /instructor/uploads/video { filename, contentType: 'video/mp4'|'video/webm'|'video/quicktime' }`
   → `{ assetId, provider, uploadUrl, method: 'PUT', headers, expiresAt }`
2. `PUT uploadUrl` with the file as the body and exactly `headers` (use `XMLHttpRequest` for a progress bar; no cookies).
3. `POST /instructor/uploads/video/:assetId/complete` → `{ id, provider, status: 'processing', durationSec, hasCaptions, error }`
4. Poll `GET /instructor/videos/:assetId` until `status === 'ready'` (worker reads the duration with ffprobe, ~1–3 s locally), or
   attach it right away with `videoAssetId` on a lecture (its duration updates when ready). `GET /instructor/videos` lists yours.
5. Optional captions (local only): `POST /instructor/uploads/video/:assetId/captions` → `{ uploadUrl, method, headers }`, then PUT a `.vtt`.

**Resource** (ZIP, PDF, script; ≤ 200 MB): `POST /instructor/uploads/resource { filename, contentType, sizeBytes }` →
`{ storageKey, uploadUrl, method, headers }` → PUT the file → `POST /instructor/courses/:id/lectures/:lectureId/resources { title, storageKey }`.

**Image** (thumbnail, avatar; any signed-in user): `POST /instructor/uploads/image { contentType: 'image/jpeg'|'image/png'|'image/webp' }`
→ `{ key, uploadUrl, method, headers, publicUrl }` → PUT → `PATCH /instructor/courses/:id { thumbnailKey: key }` (or
`PATCH /me/profile { avatarUrl: publicUrl }`).

## Admin (`admin` or `super_admin`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | `{ users, instructors, pendingInstructors, publishedCourses, coursesInReview, paidOrders, enrollments, grossRevenueCents, instructorEarningsCents, platformRevenueCents, refundedCents }` |
| GET | `/admin/review-queue` | `{ items: [{ kind: 'course'\|'revision', id (course id), slug, title, priceCents, instructor: { id, name, email }, category, submittedAt, sections, revisionId, changes: Change[] }] }` (oldest first; `changes` lists what a revision changes) |
| GET | `/admin/courses?status&q&page&pageSize` | paginated; items have `revision: { id, status, submittedAt } \| null` |
| GET | `/admin/courses/:id` | full live course incl. curriculum + `history` (audit entries) + `revision: { id, status, reviewNote, submittedAt, changes, draft: CourseTree } \| null`. Admins can play any live lecture via `POST /lectures/:id/playback`. |
| POST | `/admin/videos/:assetId/playback` | → `{ url, expiresAt, format, captionsUrl? }` for any video asset (reviewers watch new videos in a revision before they are live). Audited `video.admin_playback`. `404` unknown asset, `400 video_not_ready` |
| POST | `/admin/courses/:id/approve` | `{ note? }` new course in_review → published; **published course with changes in review → applies them atomically** (`revision.status: 'approved'`; `409 video_not_ready` if a new video is not processed: nothing changes) |
| POST | `/admin/courses/:id/request-changes` | `{ note }` (required) in_review → changes_requested (for a revision: live untouched, draft editable again) |
| POST | `/admin/courses/:id/reject` | `{ note }` (required) in_review → rejected (for a revision: live untouched) |
| POST | `/admin/courses/:id/unpublish` | `{ note }` (required) published → unpublished (students keep access; open draft changes are closed) |

Decision responses: `{ id, status, reviewNote, publishedAt, revision?: { id, status } }`.

All paginated admin lists return `{ items, page, pageSize, total, totalPages }` (`pageSize` ≤ 100, default 25).

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users?q&role&status&page&pageSize` | paginated |
| PATCH | `/admin/users/:id` | `{ status?: 'active'\|'suspended', roles?: Role[] }`. Roles need `super`; changing another admin needs `super`; never yourself. Suspending/role change revokes their sessions. |
| GET | `/admin/instructors?status&q&page&pageSize` | paginated: `items: [{ userId, name, email, headline, bio, website, status, reviewNote, isPlatform, stripeConnected, payoutsEnabled, courses, appliedAt }]`; `q` searches name, email, headline |
| POST | `/admin/instructors/:id/approve` | `{ note? }` → grants role `instructor` |
| POST | `/admin/instructors/:id/reject` | `{ note }` |
| GET / POST | `/admin/categories` | `{ name, slug?, icon?, sort? }` |
| PATCH / DELETE | `/admin/categories/:id` | delete only when empty |
| GET / PUT | `/admin/settings` | `{ commission_bps: 0..10000 }` (default **2000** = the platform keeps 20%, independent instructors keep 80%). DEL's own (isPlatform) courses: line `commissionBps: 10000`, `instructorShareCents: 0`, `transferStatus: 'none'`: never transferred |
| GET | `/admin/orders?status&q&page&pageSize` | paginated; `q` = order id, buyer email/name or course title; items `{ id, status, totalCents, currency, provider, user, lines (count), courses: [{ id, title, slug, refunded }], paidAt, createdAt }` |
| GET | `/admin/orders/:id` | AdminOrder (below) |
| POST | `/admin/orders/:id/refund` | `{ lineIds?: string[], reason? }` (omit `lineIds` for a full refund; partial refunds can be repeated until everything is refunded) → AdminOrder. `400 invalid_line` if a line is not in this order. Refunds the Stripe charge, cancels/reverses instructor transfers, revokes those enrolments. |
| PATCH | `/admin/reviews/:id` | `{ status: 'visible'\|'hidden' }` |
| GET | `/admin/reviews` | `q, courseId, instructorId, rating, status, reported, page, pageSize` (zod-validated, server-side). `GET /admin/reviews/filters` → `{ courses: [{ id, title, instructorId }], instructors: [{ id, name }] }` (only courses that have reviews) |
| GET | `/enrollments/manual?status&q&instructorId&courseId&from&to&page&pageSize` | Manual enrollment requests (instructors: their own; `instructorId` only for DEL). Instructor and course must match the same request line; `from`/`to` are calendar days `YYYY-MM-DD`, both included. `GET /enrollments/manual/filters` → `{ courses: [{ id, title, instructorId }], instructors: [{ id, name }] }` from the requests this person can see (instructors get no instructor list) |
| GET | `/admin/audit?action&actorId&targetType&targetId&q&from&to&page&pageSize` | server-side: `action` prefix (e.g. `course.`, `order.`), `q` searches action, target and actor name/email, `from`/`to` ISO dates |

```ts
type AdminOrder = { id; status; provider; currency; totalCents; refundedCents; paidAt; createdAt; stripePaymentIntentId: string | null;
  user: { id; name; email };
  lines: { id; course: { id; title; slug }; instructor: { id; name; isPlatform }; priceCents; commissionBps; commissionCents; instructorShareCents;
           transferStatus: 'none'|'pending'|'paid'|'reversed'; transferId: string | null; refundedAt: string | null; refundable: boolean }[];
  history: { id; action; at; meta; actor: { id; name } | null }[] };
```

### Super Admin portal (2026-11-26, docs/SUPER_ADMIN.md)
`code` = the acting super admin's authenticator code (step-up; `400 step_up_required` without it, `401 invalid_code`).

| Method & path | Who | Body / notes |
| --- | --- | --- |
| GET `/admin/people/roles` | `users.view` | `{ roles: [{ key, label, description, system, members, permissions?: [{ key, description, allowed, default }], capabilities?: [{ key, description, enabled }], alwaysIncluded? }] }` |
| PUT `/admin/people/roles` | super admin | `{ adminAllowed: string[], adminDefaults: string[], disabled: Capability[], code, reason? }` |
| PATCH `/admin/people/users/:id/profile` | `users.manage` | `{ name }` |
| PUT `/admin/people/users/:id/email` | super admin | `{ email, code, reason? }` → 409 `email_taken` |
| POST `/admin/people/users/:id/status` | `users.manage` | `{ status: 'active'|'suspended'|'disabled', reason?, until?: ISO date }` (reason required unless active) |
| POST `/admin/people/users/:id/password-reset` | `users.manage` | sends the reset email; 429 after 3 per hour |
| POST `/admin/people/users/:id/verification` | `users.manage` | resends the verification email |
| POST `/admin/people/users/:id/recovery-link` | super admin | `{ reason, code }` → `{ link, expiresAt }` (shown once, 30 min, single use) |
| POST `/admin/people/users/:id/temporary-password` | super admin | `{ reason, code }` → `{ password, mustChangePassword: true }` (shown once) |
| POST `/admin/people/users/:id/sessions/revoke` | `users.manage` | `{ revoked }` |
| POST `/admin/people/users/:id/delete` | super admin | `{ reason, confirmEmail, code }` → 409 `has_live_courses`, `last_super_admin` |
| GET `/admin/people/users?status=disabled|deleted` | `users.view` | deleted accounts are left out unless asked for |
| GET `/admin/courses?view=active|archived|deleting|purged|all&featured=true` | `courses.review` | rows add `lifecycle, featured, archivedAt, archiveReason, deleteRequestedAt, deleteAfter, daysLeft, purgedAt` |
| GET `/admin/courses/:id/state` | `courses.review` | lifecycle facts + `learners: { paidAccessRunning, accessWithoutEndDate, lastPaidAccessEnds }` |
| PATCH `/admin/courses/:id` | super admin | `{ title?, subtitle?, description?, objectives?, requirements?, categoryId?, level?, language?, priceCents?, coverTemplateId?, reason? }` |
| POST `/admin/courses/:id/publish` | super admin | `{ note? }` → 409 `course_archived`, `course_empty` |
| POST `/admin/courses/:id/feature` | super admin | `{ on }` (published only) |
| POST `/admin/courses/:id/archive` · `/restore` | super admin | archive `{ reason }`; restore → previous status; 409 `course_purged` |
| POST `/admin/courses/:id/delete` · `/cancel-deletion` | super admin | delete `{ reason, confirmTitle, code }`; content removed ≥ 30 days later once no paid access runs |
| GET `/admin/system` | super admin | `{ checkedAt, environment, checks[], queues[], attention }` |

Errors added elsewhere: `403 capability_disabled` (a role capability turned off), `403 password_change_required`
(temporary password: only `/auth/me`, `/auth/password`, `/auth/logout`, `/auth/csrf`, `/auth/security`,
`/auth/password-policy` work). `/auth/me` returns `user.mustChangePassword`.

## Sales and promotions (owner decisions 2026-11-25)
Prices are worked out at request time: an instructor's sale (fixed sale price) and marketplace promotions (% off) apply only
between `startsAt` and `endsAt`; the lowest price wins and discounts never stack; free courses never change; nothing is
written to the course, so the regular price returns by itself. Instructors are in marketplace promotions unless they opt a
course out (DEL courses always in). Cart, checkout and Stripe use the current price; each order line stores `priceCents`
(paid), `listPriceCents` (regular), `saleKind`, `saleId`; the commission split is on `priceCents`. Every change is audited.

| Method | Path | Notes |
|---|---|---|
| GET | `/instructor/promotions` | instructor: own courses with current price, open sales, opt-out, promotions that reach them, rules |
| GET | `/instructor/courses/:id/sales` | instructor (owner): the course's sales, newest first |
| POST | `/instructor/courses/:id/sales` | `{ salePriceCents, startsAt?, endsAt }` (ISO). Rules: paid course, ≥10% off, ≥ $4.99, ≤ 31 days, start not in the past, no overlap (409 `sale_overlap`) |
| PATCH | `/instructor/courses/:id/sales/:saleId` | same body; a running sale keeps its start; ended/cancelled → 409 `sale_closed` |
| POST | `/instructor/courses/:id/sales/:saleId/cancel` | ends it now (running) or drops it (scheduled) |
| PUT | `/instructor/courses/:id/promotions` | `{ promoOptOut }`; DEL courses → 400 `platform_course` |
| GET | `/admin/promotions` | admin: promotions with `status` and `courseCount` (live courses in scope) |
| POST | `/admin/promotions` | **super_admin**: `{ name, percentOff 5–90, startsAt?, endsAt (≤ 90 days), scope: all\|categories\|courses, categoryIds?, courseIds? }` |
| PATCH | `/admin/promotions/:id` | **super_admin**: same body; running keeps its start |
| POST | `/admin/promotions/:id/cancel` | **super_admin** |
| GET | `/admin/course-sales?status=open\|all` | admin: instructor sales with course and instructor |
| POST | `/admin/course-sales/:id/cancel` | **super_admin**: `{ note }` (5+ chars, kept in the audit log) |

## Course covers (owner decisions 2026-11-25)
Every course image is a 1280×720 PNG generated on the server from a cover template and the course title (topic label + DEL
mark), stored at `images/covers/<courseId>-<hash>.png` and served by `GET /api/media/images/...`; card `thumbnailUrl` is it.
Covers regenerate when the title, topic or template changes. No custom uploads; changes go live at once (no review).

| Method | Path | Notes |
|---|---|---|
| GET | `/instructor/courses/:id/cover` | owner: `{ course: { title, topic, coverTemplateId, coverUrl }, templates: [{ id, name, group, suggested, … }] }` |
| GET | `/instructor/courses/:id/cover-preview/:templateId?w&title` | owner: PNG of a template with the course title (w 320–1280) |
| PUT | `/instructor/courses/:id/cover` | owner: `{ templateId }` (active templates only, 400 `cover_template`); audited |
| GET | `/admin/cover-templates` | admin: all templates with `courseCount`, plus `layouts`, `motifs` |
| GET | `/admin/cover-templates/:id/preview?w&title&topic` | admin: PNG preview |
| POST | `/admin/cover-templates/preview` | **super_admin**: PNG of an unsaved `{ layout, motif, palette, title?, topic?, w? }` |
| POST | `/admin/cover-templates` | **super_admin**: `{ name, layout, motif, palette: { bg: [hex, hex], ink, a, b, tone }, topics, active?, sort? }` |
| PATCH | `/admin/cover-templates/:id` | **super_admin**: any of the above; courses using it are regenerated; `active: false` moves them to their best other template (`coursesMoved`); the last active template can't be deactivated |

## Money: split, payout hold, refunds, disputes (owner-approved, docs/PAYMENTS_PROPOSAL.md)

Rules (`apps/api/src/commerce/money.ts`): per line `net = price − allocated Stripe fee` (fee split by price, largest
remainder), `instructor = round_half_up(net × (10000 − commissionBps) / 10000)`, `platform = net − instructor`. Tax is never
in the split. `commissionBps` is the platform's share (default `commission_bps` 2000; per-instructor override; 10000 for
DEL's own courses). Lines are snapshotted at purchase. `payee`: `instructor` (Stripe transfer), `platform` (DEL course),
`del_agreement` (written "pay to DEL" agreement: no transfer, share recorded). The fee is read from Stripe's balance
transaction after payment (`charge.updated` or a retrying job); dev test payments use a simulated 2.9% + 30¢.
Instructor shares wait **16 days** (`transferDueAt`) and are transferred by an hourly job; money owed from a refund or lost
dispute after a transfer is reversed in Stripe, or recorded in `ledger_entries` and netted from the next transfer.

| Method | Path | Notes |
|---|---|---|
| POST | `/checkout` | body `{ acceptTerms: true, termsVersion: "2026-11-25" }` required for every cart (`400 terms_required` / `terms_outdated`, details.currentVersion; stored on the order as termsVersion, termsAcceptedAt, termsAcceptedIp), plus `immediateAccessConsent: true` for paid carts (`400 consent_required`) |
| GET | `/orders/:id/refund` | own order: `{ eligibleUntil, policy: { version, generousFrom, windowDays, maxWatchedPercent, selfServicePerYear, autoApprove, url }, selfServiceLeft, pendingRequest: { id, status, paymentStatus } \| null, lines: [{ lineId, courseId, title, instructor, priceCents, purchasedAt, windowEndsAt, withinWindow, daysLeft, daysSincePurchase, totalSec, watchedSec, watchedPercent, lessons, lessonsStarted, lessonsTotal, lessonsCompleted, downloads, tracking: ok\|missing\|inconsistent, thresholdPercent, windowDays, policyVersion, eligible, reason, reasons[], outcome: approve\|review\|reject\|none, investigation, message }] }`; numbers from the purchase's policy version (docs/ACCESS_AND_REFUNDS.md) |
| POST | `/orders/:id/refund` | `{ lineIds?, reason? }` → `{ status: refunded\|processing\|payment_failed\|declined\|pending_review\|partial, requests: [{ requestId, status, lineIds, message }], requestId, message }`; `409 request_pending` while a request is open; `400 nothing_to_refund`. A confirmed refund revokes access and the course certificate |
| GET | `/instructor/terms` | `{ instructorSharePercent, platformBps, source: default\|agreement\|platform, defaultInstructorSharePercent, payToPlatform, note, formula, holdDays, refundWindowDays }` (from the refund policy in force: period + 2 days) |
| GET | `/instructor/sales` | items add `feeCents, netCents, payee, transferDueAt, disputeStatus`; totals add `feesCents, heldCents` |
| GET | `/admin/finance` | totals (gross, fees, net, instructor shares, DEL-agreement shares, platform revenue, refunded, held, due, transferred, frozen by disputes, owed by instructors) + `checks: { orders, problems: [{ orderId, check }] }` (empty = reconciled) |
| GET | `/admin/finance/waiting-for-onboarding` | instructors with shares waiting because Stripe onboarding isn't finished |
| POST | `/admin/finance/release-transfers` | super admin: run the payout release now (audited) |
| GET | `/admin/disputes` | chargebacks with status `open\|won\|lost` |
| GET | `/admin/refund-requests?status` | see "Access and refunds" below |
| POST | `/admin/refund-requests/:id/approve\|decline` | `{ note? }` (note required to decline) |
| GET / PUT | `/admin/instructors/:id/terms` | PUT super admin only: `{ commissionBps?: 0..10000 \| null, payToPlatform?, note (≥ 5 chars) }`, applies to new sales, audited `commission.terms_changed` |
| PUT | `/admin/settings` | now **super admin only** (`403 super_admin_required`) |

Webhooks add `charge.updated` (fee), `charge.dispute.created` (freeze the order's payouts) and `charge.dispute.closed`
(won: release; lost: revoke access and recover the instructor's share, like a refund).

## Support, protected playback and help videos (2026-11-25)
Details: docs/SUPPORT.md, docs/CONTENT_PROTECTION.md, docs/HELP_VIDEOS.md.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST | `/support/tickets` | signed in | own requests; create (5 per hour) |
| GET | `/support/tickets/:number` | requester, admin | `SUP-000123` |
| POST | `/support/tickets/:number/messages`, `/resolved`, `/still-need-help`, `/reopen` | requester | |
| POST | `/support/uploads` · GET `/support/attachments/:id` | signed in | private files |
| GET | `/admin/support/tickets`, `/admin/support/summary`, `/admin/support/staff` | admin | queue |
| POST/PATCH | `/admin/support/tickets/:number/messages`, `/admin/support/tickets/:number` | admin | reply, note, request_info, resolve; priority, topic, assignee, close (super admin) |
| POST | `/lectures/:id/playback` | access | encrypted HLS session when packaged, else signed MP4 |
| GET | `/playback/:sid/index.m3u8`, `/playback/:sid/key` | session owner | `no-store`; others 404 |
| GET | `/admin/playback/status` | admin | packaging counts, `cdn`, `renditions`, `audioOnly`, `singleQuality` (videos packaged with other settings than now) |
| GET | `/help/videos`, `/help/videos/:slug` | public | published, ready videos; 1-hour signed link, chapters, up next |
| GET | `/admin/help/videos`, `/admin/help/videos/:slug/preview` | admin | all videos; preview drafts |
| PUT/DELETE | `/admin/help/videos/:slug` | admin | create or update by address; delete |
| POST | `/admin/help/videos/:slug/publish` | admin | `{ published }`; needs a ready video |
| POST | `/admin/help/uploads/video` (+ `/:assetId/complete`, `/:assetId/captions`), `/admin/help/uploads/image` · GET `/admin/help/uploads/video/:assetId` | admin | studio upload pipeline |

## Sign-in, two-step sign-in, passwords (2026-11-25, docs/AUTH.md)
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/register`, `/auth/login` | public | `{ mfa: 'enroll' \| 'verify' }` (ticket cookie), or `{ user }` on a trusted device |
| GET | `/auth/mfa/pending` | ticket | stage, method, masked email, `methods { authenticator, email, recovery }`, `emailCode { length, ttlMinutes, sent, resendAfter }`, `prefers` |
| POST | `/auth/mfa/enroll` · `/auth/mfa/complete` · `/auth/mfa/cancel` | ticket | seed + otpauth URL · `{ code \| recoveryCode \| emailCode, trustDevice }` → session (+ `recoveryCodes` after set-up); 409 `session_limit` when the account is at its limit and the setting is "refuse" |
| POST | `/auth/mfa/email/send` | ticket | email sign-in code (students/instructors when allowed; 403 `email_code_not_allowed`, 429 `email_code_cooldown` / `email_code_limit`) → `{ sentTo, expiresAt, resendAfter }` |
| POST | `/auth/step-up/email` | signed in, no authenticator | email code for a sensitive change (then send it as `code`) |
| GET | `/auth/session` · POST `/auth/session/heartbeat` | signed in | `{ kind, inactivityMinutes, warningMinutes, idleAt, endsAt }`; the heartbeat records activity (at most once a minute) |
| — | any signed-in route | — | 401 `session_replaced` \| `session_idle` \| `session_lifetime` \| `session_admin` when this browser's session was ended; `/auth/me` then returns `{ user: null, sessionEnded, sessionEndedMessage }` once |
| GET | `/auth/providers` · `/auth/password-policy` | public | enabled providers, rules |
| GET | `/auth/oauth/:provider/start?mode=login\|link&next=` · `/auth/oauth/:provider/callback` | public / provider | redirects; `link` needs a session |
| POST | `/auth/password/forgot` · `/auth/password/reset` | public | same answer for every address · `{ token, password }` |
| GET | `/auth/security` | signed in | password, MFA, trusted devices, identities, providers |
| POST | `/auth/password` | signed in | change (`currentPassword`) or set first one (`code`) |
| POST | `/auth/mfa/recovery-codes`, `/auth/mfa/replace/start`, `/auth/mfa/replace/confirm` | signed in | need a code |
| DELETE | `/auth/trusted-devices` | signed in | forget all |
| POST | `/auth/identities/:id/unlink` | signed in | needs a code; not the last way in |
| POST | `/admin/users/:id/mfa/reset` | super_admin | never one's own; audited |
| GET · PUT | `/admin/auth-settings` · POST `/admin/auth-settings/reset` | super_admin | Authentication & security settings (`{ settings, code }`; step-up code; audited with the changed fields) |
| GET | `/admin/users/:id/sessions` | super_admin | live sessions (device, IP, last activity, end time), recent sign-ins, session ends; viewing is audited |
| DELETE | `/admin/users/:id/sessions/:sid` · POST `/admin/users/:id/sessions/end-all` | super_admin | `{ reason? }`; the browser is told "ended by support" |

## AI learning (2026-11-27, docs/AI_LEARNING.md)
Access = an active enrolment, the course owner or an admin (checked in `StudyService`). The assistant and notes
endpoints return **404 when `ANTHROPIC_API_KEY` is unset**; search never needs a key.
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/me/courses/:slug` | access | adds `study: { search, assistant, notes }` (which tabs the player shows) |
| GET | `/me/courses/:slug/search?q=` | access | spoken words in the course's videos → `{ query, items: [{ lectureId, lectureTitle, sectionTitle, startSec, endSec, parts: [{ text, match }] }] }` (max 30; 60/min) |
| POST | `/me/courses/:slug/ask` | access, AI key | `{ question (3–500), lectureId?, history?: [{ role, text }] (≤6) }` → `{ covered, answer (with [S1]/[L2] markers), citations: [{ ref, lectureId, lectureTitle, startSec }], remainingToday }`; `429 rate_limited` with `details.retryAfterSec` |
| GET | `/lectures/:id/study-notes` | access, AI key | `{ status: 'ready', summary, keyPoints[], questions: [{ question, answer, atSec }], generatedAt, model }` or `{ status: 'generating' \| 'unavailable' \| 'failed' }` (poll while generating) |
| GET | `/instructor/lectures/:id/study-notes` · POST `…/regenerate` | course owner or admin, AI key | same view; regenerate is audited |

## Career paths (2026-11-26, docs/CAREER_PATHS.md)
Only published paths are public, and only their published courses are listed. A path sells nothing: each course is
bought on its own. Slugs `summary`, `new` and `course-options` are reserved.
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/paths` | public | `{ items: [{ id, slug, title, summary, courseCount, totalDurationSec, totalPriceCents, currency, skills[], covers[] }] }` (empty: the web hides every entry point) |
| GET | `/paths/:slug` | public | the same plus `description`, `steps: [{ position, skills[], note, course: <course card> }]`; 404 for drafts |
| GET | `/me/paths` | signed in | `{ items: [<my path>], available }` (paths followed; `available` = published paths) |
| GET | `/me/paths/summary` | signed in | `{ available, following }` (Student Studio menu) |
| GET | `/me/paths/:slug` | signed in, following | `{ path, hoursPerWeek, progress: { coursesDone, courseCount, lecturesDone, lectureCount }, remainingPriceCents, steps: [... access: owned\|expired\|none, progress, certificateCode], plan: { remainingSec, weeks, finishOn, thisWeek: [{ lectureId, title, courseSlug, courseTitle, remainingSec }], thisWeekSec, blockedBy }, skills: [{ skill, state: done\|in_progress\|needed }] }` |
| PUT | `/me/paths/:slug` | signed in | follow, or change `{ hoursPerWeek? (1–40) }`; returns `<my path>`; 404 for drafts |
| DELETE | `/me/paths/:slug` | signed in | stop following (course progress stays) |
| GET | `/admin/paths` · `/admin/paths/:id` · `/admin/paths/course-options?q=` | admin + `content.manage` | list (status, stepCount, followerCount) · editor view · published courses for the picker (max 50) |
| POST | `/admin/paths` · PUT `/admin/paths/:id` | super_admin | `{ title (3–80), slug, summary (≤280), description (≤5000), steps: [{ courseId, skills[], note }] (≤20, no duplicates) }`; a published path must stay publishable; audited |
| POST | `/admin/paths/:id/publish` · `/unpublish` | super_admin | publish needs a summary and ≥2 courses, all published (`too_few_steps`, `course_not_published`, `summary_required`); audited |
| DELETE | `/admin/paths/:id` | super_admin | drafts only (409 `published`); audited |

## Support sessions and AI agents (2026-11-26, docs/SUPPORT_SESSIONS_AND_AGENTS.md)
- `GET /support-session` (public: `{active:false}` or who/why/until for the banner) · `POST /support-session/start`
  `{userId, reason, code, minutes?}` (super admin; sets the httpOnly `support_sid` cookie) · `POST /support-session/end`
  · `GET /support-session/history?userId=` · `POST /support-session/:id/revoke`. During a session `req.user` is the
  person, `req.realUser` the super admin; account security, money, learning records and `/admin` writes answer
  `403 support_restricted`.
- `GET|POST /admin/agents/tokens` (issue: `{instructorId, name, scopes[], days?, reason, code}`, token returned once) ·
  `POST /admin/agents/tokens/:id/revoke` · `GET /admin/agents/scopes|activity?tokenId=|pending` (super admin).
- `/agent/*` with `Authorization: Bearer del_agent_…` (no cookies/CSRF): whoami, categories, courses (read, create,
  edit, sections, lessons, curriculum, quiz, cover), videos, resumable uploads (`POST /agent/uploads`,
  `GET /agent/uploads/:id/parts`, `POST /agent/uploads/:id/complete|abort`), `GET /agent/courses/:id/validation|preview`,
  `POST /agent/courses/:id/submit`. Full list in the doc.
- Audit rows carry `onBehalfOfId`, `agentTokenId`, `supportSessionId` and `status` (ok/failed).

## Access and refunds (2026-11-25, docs/ACCESS_AND_REFUNDS.md)
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/me/learning` | signed in | `items` (with `access`: state, purchasedAt, expiresAt, daysLeft, canRenew) and `expired` |
| GET | `/me/courses/:slug` | access | adds `accessInfo`, `rating`, `canReview`, `myReview` |
| PUT | `/lectures/:id/progress` | access | `{ positionSec, completed?, played?: [[start, end], …] }` (unique seconds) |
| GET | `/orders/:id/refund` · POST `/orders/:id/refund` | buyer | facts per line · decided at once: `refunded` / `declined` / `pending_review` / `partial` |
| GET | `/orders/:id/refund-requests` · POST `/refund-requests/:id/review` | buyer | decisions · ask a person to review a decline |
| GET | `/admin/refund-requests?status=all\|needs_action\|pending\|investigation\|auto_declined\|auto_approved\|approved\|declined\|refunded\|processing\|failed` | finance.view | items `{ id, status, paymentStatus, paymentError, investigation, override, needsAction, message, policyVersion, user, orderId, paidAt, daysSincePurchase, amountCents, payment: { provider, paymentIntentId, chargeId, stripeRefundId }, downloads[], lines: [{ title, instructor, priceCents, refundedAt, transferStatus }], analysis, aiSummary, history }`, `counts` per filter, `policy` in force |
| POST | `/admin/refund-requests/:id/approve` · `/decline` | refunds.decide; super_admin to override an automatic decline (only while the policy allows exceptions) | note required to decline or override → `{ id, status, paymentStatus }` |
| POST | `/admin/refund-requests/:id/retry-payment` | refunds.decide | approved refund whose payment failed → `{ id, paymentStatus }` |
| GET | `/admin/refund-policy` | finance.view | `{ current, items: [version rows with effectiveFrom, effectiveUntil, inForce, orders, createdBy] }` |
| PUT | `/admin/refund-policy` | super_admin + authenticator `code` | `{ windowDays 1–365, maxWatchedPercent 0–100 (1 decimal), autoCheck, autoReject, autoApprove, allowExceptions, selfServicePerYear, messages?: { submitted, approved, declined, processed }, note?, code }` → new version; audited `refund.policy_changed` |
| GET | `/refund-policy` | public | `{ version, windowDays, maxWatchedPercent, effectiveFrom, selfServicePerYear, autoApprove, history[] }` |
| GET | `/me/courses/:slug/report` | enrolled student | `{ course, purchasedAt, orderId, enrolledAt, accessUntil, lessons: { total, completed, percent }, video: { totalSec, uniqueWatchedSec, percent, paidSec, paidWatchedSec, paidPercent }, lastAccessAt, downloads: { count, items: [{ title, at }] }, refund }` |
| GET | `/me/learning` | student | each item adds `refund: { state: eligible\|review\|not_eligible\|requested\|refunded, orderId, purchasedAt, deadline, daysLeft, watchedPercent, maxWatchedPercent, windowDays, reasons, message, policyVersion } \| null` |
| GET | `/me/notifications?limit` · POST `/me/notifications/read` `{ ids? }` | signed in | `{ unread, items: [{ id, kind, title, body, link, read, createdAt }] }` (own rows only) |

## Webhooks (server to server; no cookies/CSRF)

- `POST /webhooks/stripe`: raw body, `Stripe-Signature` verified with `STRIPE_WEBHOOK_SECRET`; event ids stored for idempotency.
  Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded|failed`, `checkout.session.expired`,
  `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refund.updated`, `charge.dispute.created`, `account.updated` and v2 `v2.core.account*` events
  (a refund is applied locally and reported to the student only once Stripe confirms it).
  Local: `stripe listen --forward-to http://127.0.0.1:4000/api/webhooks/stripe`.
- `POST /webhooks/mux`: verified with `MUX_WEBHOOK_SECRET`; `video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`.

## Seed accounts and the real catalogue (local)

`admin@del.example` (super_admin) · `courses@del.example` (DevOps Easy Learning, platform instructor) ·
`nadia@instructor.example` (instructor, no Stripe yet) · `student@del.example` (owns the free AI Foundations course).
Password: `SEED_PASSWORD` in `.env`. No invented reviews or ratings: reviews come only from real enrolled learners.

1. `npm run seed` (= `docker compose exec api npm run seed`; idempotent): accounts, categories, commission 2000, Nadia's two
   demo courses (and four demo DEL courses until the real catalogue is imported).
2. `npm run import:del` (= `./scripts/import-del.sh`; idempotent): the real DEL catalogue from
   `ai-videos/projects/ai-devops` (mounted **read-only** by `docker-compose.import.yml`; override the host path with
   `DEL_SOURCE_DIR` in `.env`). One course per finished category folder, one lecture per video in plan order, the first two
   lectures free previews (one-lecture courses have none), captions (SRT → WebVTT), lab ZIPs as lecture resources, quizzes
   parsed (never executed) from each tutorial's `quizSet([...])`, lecture summaries from the tutorial `subtitle`. Replaces
   the demo DEL courses and removes the old invented reviews.

Slugs: `ai-foundations-the-vocabulary-of-ai` (free, 12 lectures) · `before-ai-how-computers-and-devops-worked` ·
`by-hand-vs-with-ai-the-3am-outage` · `agents-and-rag-the-ideas` · `building-rag-one-architecture-three-implementations` ·
`ai-in-production-llmops-roles-and-hosting` · `hands-on-cloud-ai-labs` (9 labs with ZIPs) · `cloud-ai-services-explained-aws-and-azure`;
Nadia: `n8n-automation-for-devops-teams`, `aiops-monitoring-and-incident-response`.
