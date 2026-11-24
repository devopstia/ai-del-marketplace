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
{ "error": { "code": "validation_failed", "message": "courseId: Invalid UUID", "details": [{ "path": "courseId", "message": "Invalid UUID" }] } }
```

| Status | Typical `code`s |
|---|---|
| 400 | `validation_failed` (has `details`), `invalid_json`, `cart_empty`, `note_required`, `not_ready`, `video_not_ready`, `upload_missing`, `invalid_signature` |
| 401 | `unauthorized` (no/expired session), `invalid_credentials` |
| 403 | `forbidden` (role), `csrf_invalid`, `not_enrolled`, `account_suspended`, `super_admin_required`, `self_change` |
| 404 | `not_found` (also returned for other people's resources: ownership failures look like "does not exist") |
| 409 | `conflict`, `email_taken`, `already_enrolled`, `course_locked` (in review), `invalid_status`, `not_complete`, `already_applied` |
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
| GET | `/courses?q&category&level&price&sort&page&pageSize` | Published only. `category` = slug, `level` = beginner\|intermediate\|advanced, `price` = free\|paid, `sort` = popular (default)\|newest\|rating\|price_asc\|price_desc, `pageSize` ≤ 48 (default 12). Returns `{ items: CourseCard[], page, pageSize, total, totalPages }` |
| GET | `/courses/:slug` | CourseDetail (below). Owner/admin can also see unpublished. **No asset URLs.** |
| GET | `/courses/:slug/reviews?page&pageSize` | `{ items: [{ id, rating, body, instructorReply, createdAt, author: { name, avatarUrl }, verifiedPurchase }], ratingAvg, ratingCount, distribution: { "1".."5": n }, page, pageSize, total }` |
| GET | `/instructors/:id` | `{ id, name, avatarUrl, headline, bio, website, stats: { courses, students, reviews }, courses: CourseCard[] }` |
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
  curriculum: { id: string; title: string; lectures: { id: string; title: string; position: number; type: 'video' | 'article' | 'quiz'; durationSec: number; isPreview: boolean; resourceCount: number }[] }[];
  viewer: { signedIn: boolean; enrolled: boolean; inCart: boolean; isOwner: boolean };
};
type Playback = { url: string; expiresAt: string; format: 'mp4' | 'hls'; captionsUrl?: string /* WebVTT */ };
```

Playback URLs are presigned and expire after **5 minutes**: request a new one when the player starts or the URL expires
(`format: 'mp4'` = progressive file from MinIO; `'hls'` = Mux `.m3u8`, use hls.js). `captionsUrl` goes in a `<track kind="captions">`.

## Auth

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/auth/register` | public | `{ email, password (10–200 chars), name }` → `201 { user: Me, csrf }` + sets `sid` |
| POST | `/auth/login` | public | `{ email, password }` → `200 { user: Me, csrf }` + sets `sid` (any previous session on this browser is revoked) |
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

```ts
type Order = { id; status: 'pending'|'paid'|'failed'|'refunded'|'partially_refunded'; totalCents; currency; provider: 'stripe'|'test'|'free';
               paidAt: string | null; createdAt; lines: { id; courseId; slug; title; priceCents; refundedAt: string | null }[] };
```

## Learning (enrolled students; the course owner and admins also have access)

| Method | Path | Notes |
|---|---|---|
| GET | `/me/learning` | `{ items: [{ course: { id, slug, title, thumbnailUrl, instructor: { name } }, enrolledAt, progress: { total, completed, percent }, lastLecture: { id, title, positionSec, at } \| null, certificateCode }] }` |
| GET | `/me/courses/:slug` | Player data: `{ id, slug, title, subtitle, instructor, thumbnailUrl, access: 'enrolled'\|'owner'\|'admin', progress, lastLectureId, certificate, myReview, sections: [{ id, title, lectures: [{ id, title, type, durationSec, isPreview, articleMd?, videoStatus, hasCaptions, hasQuiz, resources: [{ id, title, sizeBytes, mime }], progress: { positionSec, completed } }] }] }`. `403 not_enrolled` otherwise. |
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
| GET | `/instructor/courses` | `{ items: [{ id, slug, title, status, reviewNote, priceCents, category, thumbnailUrl, students, ratingAvg, ratingCount, updatedAt, publishedAt }] }` |
| POST | `/instructor/courses` | `{ title, subtitle?, description?, language?, level?, objectives?, requirements?, priceCents? (0 or ≥ 99), categoryId?, thumbnailKey?, promoVideoAssetId? }` → InstructorCourse (`status: 'draft'`) |
| GET | `/instructor/courses/:id` | InstructorCourse: all course fields + `thumbnailUrl` + `sections[].lectures[]` with `video: { id, status, durationSec, hasCaptions, provider } \| null`, `resources[]`, `quiz: { questions } \| null` |
| PATCH | `/instructor/courses/:id` | same fields as create, all optional. `409 course_locked` while in review |
| DELETE | `/instructor/courses/:id` | only drafts without students/sales |
| POST | `/instructor/courses/:id/submit` | → `in_review`. `400 not_ready` with `details: string[]` (needs description, category, ≥1 lecture, every video processed) |
| POST | `/instructor/courses/:id/sections` | `{ title }` |
| PATCH / DELETE | `/instructor/courses/:id/sections/:sectionId` | `{ title }` |
| PUT | `/instructor/courses/:id/sections/order` | `{ ids: [sectionId, ...] }` (all of them) |
| POST | `/instructor/courses/:id/sections/:sectionId/lectures` | `{ title, type? ('video'), isPreview?, articleMd?, videoAssetId? }` |
| PUT | `/instructor/courses/:id/sections/:sectionId/lectures/order` | `{ ids: [lectureId, ...] }` |
| PATCH / DELETE | `/instructor/courses/:id/lectures/:lectureId` | `{ title?, type?, isPreview?, articleMd?, videoAssetId? (null detaches), sectionId? (move) }` |
| PUT / DELETE | `/instructor/courses/:id/lectures/:lectureId/quiz` | `{ questions: [{ q, options: string[3..5], correct: index, why }] }` |
| POST | `/instructor/courses/:id/lectures/:lectureId/resources` | `{ title, storageKey }` (step 2 of a resource upload) |
| DELETE | `/instructor/courses/:id/resources/:resourceId` | |
| GET | `/instructor/sales?from&to` | `{ totals: { grossCents, commissionCents, earningsCents, refundedCents, paidOutCents, pendingPayoutCents, sales }, byCourse: [...], items: [{ orderLineId, orderId, paidAt, course, priceCents, commissionBps, instructorShareCents, transferStatus, refundedAt }] }` |
| GET | `/instructor/students?courseId` | `{ items: [{ student: { id, name }, course: { id, title }, enrolledAt, source, progressPercent }] }` |
| GET | `/instructor/reviews` | `{ items: [{ id, rating, body, status, instructorReply, createdAt, author: { name }, course }] }` |
| POST | `/instructor/reviews/:id/reply` | `{ reply }` |
| POST | `/instructor/stripe/onboarding-link` | → `{ url, expiresAt }` Stripe-hosted onboarding (returns to `WEB_URL/instructor/payouts?return=1`, expired → `?refresh=1`: call again). `503` without Stripe keys. |
| GET | `/instructor/stripe/status` | `{ connected, payoutsEnabled, isPlatform, stripeConfigured, pendingPayoutCents? }` |

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
| GET | `/admin/review-queue` | `{ items: [{ id, slug, title, priceCents, instructor: { id, name, email }, category, submittedAt, sections }] }` (oldest first) |
| GET | `/admin/courses?status&q&page&pageSize` | paginated |
| GET | `/admin/courses/:id` | full course incl. curriculum + `history` (audit entries). Admins can play any lecture via `POST /lectures/:id/playback`. |
| POST | `/admin/courses/:id/approve` | `{ note? }` in_review → published |
| POST | `/admin/courses/:id/request-changes` | `{ note }` (required) in_review → changes_requested |
| POST | `/admin/courses/:id/reject` | `{ note }` (required) in_review → rejected |
| POST | `/admin/courses/:id/unpublish` | `{ note }` (required) published → unpublished (students keep access) |
| GET | `/admin/users?q&role&status&page&pageSize` | paginated |
| PATCH | `/admin/users/:id` | `{ status?: 'active'\|'suspended', roles?: Role[] }`. Roles need `super`; changing another admin needs `super`; never yourself. Suspending/role change revokes their sessions. |
| GET | `/admin/instructors?status` | `{ items: [{ userId, name, email, headline, bio, website, status, reviewNote, isPlatform, stripeConnected, payoutsEnabled, courses, appliedAt }] }` |
| POST | `/admin/instructors/:id/approve` | `{ note? }` → grants role `instructor` |
| POST | `/admin/instructors/:id/reject` | `{ note }` |
| GET / POST | `/admin/categories` | `{ name, slug?, icon?, sort? }` |
| PATCH / DELETE | `/admin/categories/:id` | delete only when empty |
| GET / PUT | `/admin/settings` | `{ commission_bps: 0..10000 }` (default 0 = instructors keep 100%; the platform's own courses never pay out) |
| GET | `/admin/orders?status&page&pageSize` | paginated |
| GET | `/admin/orders/:id` | order + user + lines (with transfer status) |
| POST | `/admin/orders/:id/refund` | `{ lineIds?: string[], reason? }` (omit `lineIds` for a full refund) → order. Refunds the Stripe charge, reverses instructor transfers, revokes those enrolments. |
| PATCH | `/admin/reviews/:id` | `{ status: 'visible'\|'hidden' }` |
| GET | `/admin/audit?action&actorId&targetType&targetId&page&pageSize` | `action` is a prefix match (e.g. `course.`, `order.`) |

## Webhooks (server to server; no cookies/CSRF)

- `POST /webhooks/stripe`: raw body, `Stripe-Signature` verified with `STRIPE_WEBHOOK_SECRET`; event ids stored for idempotency.
  Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded|failed`, `checkout.session.expired`,
  `charge.refunded`, `charge.dispute.created`, `account.updated` and v2 `v2.core.account*` events.
  Local: `stripe listen --forward-to http://127.0.0.1:4000/api/webhooks/stripe`.
- `POST /webhooks/mux`: verified with `MUX_WEBHOOK_SECRET`; `video.upload.asset_created`, `video.asset.ready`, `video.asset.errored`.

## Seed accounts (local)

`admin@del.example` (super_admin) · `courses@del.example` (DevOps Easy Learning, platform instructor) ·
`nadia@instructor.example` (instructor, no Stripe yet) · `student@del.example` (owns the free course) · reviewers
`priya@`/`marco@`/`lena@student.example`. Password: `SEED_PASSWORD` in `.env`.
Run: `docker compose exec api npm run seed` (idempotent).
