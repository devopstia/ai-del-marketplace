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
| GET | `/courses?q&category&level&price&sort&page&pageSize` | Published only. `category` = slug, `level` = beginner\|intermediate\|advanced, `price` = free\|paid, `sort` = popular (default)\|newest\|rating\|price_asc\|price_desc, `pageSize` ≤ 48 (default 12). `q`: every word (max 6, case-insensitive, simple plural stemming) must appear in the title, subtitle, description, instructor name, or a section/lecture title of the live course. Returns `{ items: CourseCard[], page, pageSize, total, totalPages }` |
| GET | `/courses/:slug` | CourseDetail (below). Owner/admin can also see unpublished. **No asset URLs.** |
| GET | `/courses/:slug/reviews?page&pageSize` | `{ items: [{ id, rating, body, instructorReply, createdAt, author: { name, avatarUrl }, verifiedPurchase }], ratingAvg, ratingCount, distribution: { "1".."5": n }, page, pageSize, total }` |
| GET | `/instructors/featured?limit` | `{ items: FeaturedInstructor[] }`, approved instructors with ≥ 1 published course, most learners first (`limit` 1–24, default 6). Use this for home-page stats. |
| GET | `/instructors/:id` | `{ id, name, avatarUrl, headline, bio, website, stats: { courses, students, reviews }, courses: CourseCard[] }` (same counting as featured) |
| GET | `/platform/terms` | `{ currency: 'usd', pricing: { freeAllowed: true, minCents: 499, maxCents: 99999 }, commissionBps: 2000, instructorSharePercent: 80, singleCoursePurchases: true }`: show on /teach and in the pricing step; never hard-code |
| POST | `/cart/preview` | Guest cart (no session; CSRF header still needed, 60/min per IP): `{ courseIds: uuid[] (≤ 50) }` → `{ items: (CourseCard & { available: true })[], count, totalCents, currency, unavailableIds: string[] }` (order kept; drop `unavailableIds` from the browser cart). No writes. |
| POST | `/lectures/:id/preview-playback` | Only if the lecture `isPreview` and the course is published → Playback |
| POST | `/courses/:slug/promo-playback` | Course promo video (if `hasPromo`) → Playback |
| GET | `/certificates/:code` | Verify: `{ code, issuedAt, studentName, course: { title, slug, instructorName, totalDurationSec }, valid: true }` |
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
type Playback = { url: string; expiresAt: string; format: 'mp4' | 'hls'; captionsUrl?: string /* WebVTT */ };
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
| GET | `/me/courses/:slug` | Player data: `{ id, slug, title, subtitle, instructor, thumbnailUrl, access: 'enrolled'\|'owner'\|'admin', progress, lastLectureId, certificate, myReview, sections: [{ id, title, lectures: [{ id, title, summary, type, durationSec, isPreview, articleMd?, videoStatus, hasCaptions, hasQuiz, resources: [{ id, title, sizeBytes, mime }], progress: { positionSec, completed } }] }] }`. `403 not_enrolled` otherwise. |
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
| POST | `/instructor/courses/:id/lectures/:lectureId/resources` | `{ title, storageKey }` (step 2 of a resource upload) |
| DELETE | `/instructor/courses/:id/resources/:resourceId` | |
| GET | `/instructor/sales?from&to` | `{ totals: { grossCents, commissionCents, earningsCents, refundedCents, paidOutCents, pendingPayoutCents, sales }, byCourse: [...], items: [{ orderLineId, orderId, paidAt, course, priceCents, commissionBps, instructorShareCents, transferStatus, refundedAt }] }` |
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
| GET | `/admin/audit?action&actorId&targetType&targetId&q&from&to&page&pageSize` | server-side: `action` prefix (e.g. `course.`, `order.`), `q` searches action, target and actor name/email, `from`/`to` ISO dates |

```ts
type AdminOrder = { id; status; provider; currency; totalCents; refundedCents; paidAt; createdAt; stripePaymentIntentId: string | null;
  user: { id; name; email };
  lines: { id; course: { id; title; slug }; instructor: { id; name; isPlatform }; priceCents; commissionBps; commissionCents; instructorShareCents;
           transferStatus: 'none'|'pending'|'paid'|'reversed'; transferId: string | null; refundedAt: string | null; refundable: boolean }[];
  history: { id; action; at; meta; actor: { id; name } | null }[] };
```

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
| POST | `/checkout` | body `{ immediateAccessConsent: true }` required for paid carts (`400 consent_required`) |
| GET | `/orders/:id/refund` | own order: `{ eligibleUntil, policy: { windowDays: 14, maxWatchedPercent: 25, selfServicePerYear: 3 }, selfServiceLeft, pendingRequest, lines: [{ lineId, courseId, title, eligible, reason, watchedPercent }] }`; reasons `already_refunded`, `free_course`, `not_paid`, `window_closed`, `certificate_issued`, `watched_too_much`, `disputed` |
| POST | `/orders/:id/refund` | `{ lineIds?, reason? }` → `{ status: 'refunded' }` or, over 3 self-service refunds in 12 months, `{ status: 'pending_review', requestId }`; `400 <reason>` when not eligible. A refund revokes access and the course certificate |
| GET | `/instructor/terms` | `{ instructorSharePercent, platformBps, source: default\|agreement\|platform, defaultInstructorSharePercent, payToPlatform, note, formula, holdDays: 16, refundWindowDays: 14 }` |
| GET | `/instructor/sales` | items add `feeCents, netCents, payee, transferDueAt, disputeStatus`; totals add `feesCents, heldCents` |
| GET | `/admin/finance` | totals (gross, fees, net, instructor shares, DEL-agreement shares, platform revenue, refunded, held, due, transferred, frozen by disputes, owed by instructors) + `checks: { orders, problems: [{ orderId, check }] }` (empty = reconciled) |
| GET | `/admin/finance/waiting-for-onboarding` | instructors with shares waiting because Stripe onboarding isn't finished |
| POST | `/admin/finance/release-transfers` | super admin: run the payout release now (audited) |
| GET | `/admin/disputes` | chargebacks with status `open\|won\|lost` |
| GET | `/admin/refund-requests?status` | learner requests that need review |
| POST | `/admin/refund-requests/:id/approve\|decline` | `{ note? }` (note required to decline) |
| GET / PUT | `/admin/instructors/:id/terms` | PUT super admin only: `{ commissionBps?: 0..10000 \| null, payToPlatform?, note (≥ 5 chars) }`, applies to new sales, audited `commission.terms_changed` |
| PUT | `/admin/settings` | now **super admin only** (`403 super_admin_required`) |

Webhooks add `charge.updated` (fee), `charge.dispute.created` (freeze the order's payouts) and `charge.dispute.closed`
(won: release; lost: revoke access and recover the instructor's share, like a refund).

## Webhooks (server to server; no cookies/CSRF)

- `POST /webhooks/stripe`: raw body, `Stripe-Signature` verified with `STRIPE_WEBHOOK_SECRET`; event ids stored for idempotency.
  Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded|failed`, `checkout.session.expired`,
  `charge.refunded`, `charge.dispute.created`, `account.updated` and v2 `v2.core.account*` events.
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
