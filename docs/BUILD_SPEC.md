# Build specification (v1, local deployment)

The contract between the API (`apps/api`) and the web app (`apps/web`). Keep it in sync when either side changes.

## Repository layout
```
apps/api      NestJS 12 (TypeScript 5.9), Prisma 7.10 + PostgreSQL 16, BullMQ 6 + Redis 7. Same image runs `api` and `worker`.
apps/web      Next.js 16 (App Router, React 19, TypeScript 5.9), Tailwind CSS 4.
docker-compose.yml   postgres, redis, minio (+ bucket init), api, worker, web.  .env.example at the root; .env never committed.
docs/         ASSESSMENT, DECISIONS, BUILD_SPEC, research/
```
Ports (all on 127.0.0.1): web 3000 · api 4000 · postgres 5433 · redis 6380 · minio 9000 (console 9001).
npm workspaces at the root; `package-lock.json` committed.

## Roles and security (non-negotiable)
- Roles: `student` (default), `instructor` (applies → admin approves), `admin`, `super_admin`. A user can be student and instructor.
- Sessions: API sets an **httpOnly, Secure (in prod), SameSite=Lax cookie** `sid` (opaque random id; sessions table, 30-day expiry,
  revocable). No tokens in localStorage. CSRF: state-changing requests must carry header `X-CSRF-Token` matching cookie `csrf`
  (double submit). Passwords: argon2id. Rate limit login/register.
- Every endpoint authenticated unless listed as public. **Ownership checks in the service layer**: an instructor reads/writes only
  their own courses, lectures, sales, students; students only their own orders, progress, notes. Admin-only routes check the role.
- Every privileged or financial action writes `audit_logs` (actor, action, target, ip, metadata, at).
- Never return a video/resource storage URL publicly; playback and downloads go through short-lived signed URLs issued per user.
- Validation with zod or class-validator on every input. Errors: `{ error: { code, message } }`.

## Data model (Prisma)
User(id, email unique, passwordHash, name, avatarUrl, roles[], status active|suspended, createdAt)
Session(id, userId, expiresAt, ip, userAgent, revokedAt)
InstructorProfile(userId PK, headline, bio, website, status pending|approved|rejected, stripeAccountId?, payoutsEnabled bool)
Category(id, slug unique, name, icon, sort)
Course(id, slug unique, instructorId→User, categoryId, title, subtitle, description (markdown), language, level beginner|intermediate|advanced,
  objectives text[], requirements text[], priceCents, currency 'usd', thumbnailKey?, promoVideoAssetId?, status draft|in_review|changes_requested|published|unpublished,
  reviewNote?, publishedAt?, ratingAvg, ratingCount, studentCount, createdAt, updatedAt)
Section(id, courseId, title, position)
Lecture(id, sectionId, title, position, type video|article|quiz, videoAssetId?, articleMd?, durationSec, isPreview bool)
VideoAsset(id, ownerId, provider local|mux, status uploading|processing|ready|failed, storageKey?, muxAssetId?, muxPlaybackId?, durationSec, captionsKey?)
Resource(id, lectureId, title, storageKey, sizeBytes, mime)        // lab ZIPs, scripts
Quiz(id, lectureId unique, questions jsonb [{q, options[3..5], correct, why}]) ; QuizAttempt(id, userId, quizId, score, answers jsonb, at)
CartItem(userId, courseId) PK(userId,courseId)
Order(id, userId, status pending|paid|failed|refunded|partially_refunded, totalCents, currency, stripeCheckoutSessionId?, stripePaymentIntentId?, stripeChargeId?, paidAt?)
OrderLine(id, orderId, courseId, instructorId, priceCents, commissionBps, instructorShareCents, transferId?, transferStatus none|pending|paid|reversed, refundedAt?)
Enrollment(userId, courseId, orderLineId?, source purchase|free|admin, createdAt, revokedAt?) PK(userId,courseId)
LectureProgress(userId, lectureId, positionSec, completed bool, updatedAt) PK(userId,lectureId)
Review(id, userId, courseId, rating 1..5, body, status visible|hidden, instructorReply?, createdAt) unique(userId,courseId)
Certificate(id, userId, courseId, code unique, issuedAt)
PlatformSetting(key PK, value jsonb)   // commission_bps (default 0), etc.
WebhookEvent(id PK = stripe event id, type, processedAt)   // idempotency
AuditLog(id, actorId?, action, targetType, targetId, ip, meta jsonb, at)

## API (prefix /api, JSON)
Public: `GET /health` · `GET /categories` · `GET /courses?q&category&level&price=free|paid&sort=popular|newest|rating|price_asc|price_desc&page`
(published only; card fields: slug, title, subtitle, thumbnailUrl, instructor{name}, priceCents, ratingAvg, ratingCount, studentCount, totalDurationSec, level)
· `GET /courses/:slug` (detail + curriculum with titles/durations/isPreview — **no asset URLs**) · `GET /courses/:slug/reviews` ·
`GET /instructors/:id` · `POST /lectures/:id/preview-playback` (only if isPreview) · `GET /certificates/:code` (verify).
Auth: `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` (user, roles, csrf) · `GET /auth/sessions` · `DELETE /auth/sessions/:id`.
Cart/checkout: `GET/POST/DELETE /cart` (+ `/cart/:courseId`) · `POST /checkout` → `{ url }` (Stripe Checkout URL, or the dev test-payment URL) ·
`POST /webhooks/stripe` (raw body, signature verified) · `POST /dev/test-payments/:orderId/complete` (only when DEV_TEST_PAYMENTS=true and NODE_ENV!=production; calls the same fulfilment function) ·
`GET /orders` · `GET /orders/:id` (receipt).
Learning: `GET /me/learning` (enrolled courses + progress % + last lecture) · `GET /me/courses/:slug` (full curriculum for enrolled) ·
`POST /lectures/:id/playback` → `{ url, expiresAt, captionsUrl? }` (enrolled or owner/admin) · `PUT /lectures/:id/progress {positionSec, completed}` ·
`GET /lectures/:id/resources` · `POST /resources/:id/download` → signed URL · `GET/POST /lectures/:id/quiz` (submit attempt) ·
`POST /courses/:slug/reviews` (enrolled only) · `POST /courses/:slug/certificate` (when 100% complete).
Instructor (role instructor, own data only): `POST /instructor/apply` · `GET/PUT /instructor/profile` ·
`GET/POST /instructor/courses` · `GET/PATCH/DELETE /instructor/courses/:id` · sections/lectures CRUD + reorder under the course ·
`POST /instructor/uploads/video` → upload target (local: presigned PUT to MinIO; mux: direct-upload URL) + VideoAsset id ·
`POST /instructor/uploads/video/:assetId/complete` · `POST /instructor/uploads/resource` · `POST /instructor/courses/:id/submit` ·
`GET /instructor/sales?from&to` · `GET /instructor/students?courseId` · `GET /instructor/reviews` + `POST /instructor/reviews/:id/reply` ·
`POST /instructor/stripe/onboarding-link` · `GET /instructor/stripe/status`.
Admin (admin/super_admin): `GET /admin/stats` · `GET /admin/review-queue` · `POST /admin/courses/:id/approve|request-changes|reject|unpublish {note}` ·
`GET /admin/courses|users|instructors|orders` · `POST /admin/instructors/:id/approve|reject` · `PATCH /admin/users/:id {status, roles}` (super_admin for roles) ·
categories CRUD · `GET/PUT /admin/settings` (commission_bps) · `POST /admin/orders/:id/refund` · `GET /admin/audit`.

## Payments (Stripe, test mode)
- Checkout: create Order(pending) + OrderLines (commission from settings; instructorShare = price − commission) → Checkout Session
  (platform account, line items, `payment_intent_data.transfer_group = order.id`, metadata.orderId, success/cancel URLs).
- Fulfilment (single idempotent function, used by webhook and dev test payments): order → paid, enrol each course, clear cart, issue
  transfers for lines whose instructor has `stripeAccountId` and is not the platform (DEL), using `source_transaction` and an
  idempotency key per line; audit.
- Webhooks: `checkout.session.completed`, `checkout.session.async_payment_succeeded|failed`, `charge.refunded` (reverse transfers,
  revoke enrolments), `charge.dispute.created`, `account.updated` / v2 account events (payoutsEnabled). Store event ids (idempotent).
- Connect onboarding: create the instructor's connected account (recipient), return an Account Link URL; status endpoint.
- Without STRIPE_SECRET_KEY: checkout returns the dev test-payment URL when DEV_TEST_PAYMENTS=true (never in production).

## Video
- Provider interface: `createUpload(owner) → {assetId, uploadUrl}`, `onUploaded(assetId)`, `playbackUrl(asset, userId) → {url, expiresAt}`.
- `local`: private MinIO bucket `del-media`; presigned PUT for upload, presigned GET (5 min) for playback; worker job reads duration
  with ffprobe (ffmpeg in the image) and marks ready. `mux`: direct uploads, signed playback (JWT), webhook `video.asset.ready`.
- Resources: same bucket, presigned GET for enrolled users only.

## Seed (local)
super_admin `admin@del.example`, instructor DevOps Easy Learning `courses@del.example` (approved, platform-owned), a second
instructor `nadia@instructor.example` (approved, no Stripe yet), student `student@del.example`; passwords from `.env`
(`SEED_PASSWORD`). Categories: AI Foundations, AI for DevOps, CI/CD & GitOps, MCP & Agents, Cloud AI (AWS & Azure), Automation (n8n).
Courses: 4 DEL courses + 2 by the second instructor, with sections, lectures (2 previews each), sample short videos generated by
ffmpeg (test pattern + tone, 10–20 s) uploaded to MinIO, one resource ZIP, one quiz, reviews.

## Quality bar
- API: unit tests for fulfilment, ownership checks, webhook idempotency, auth; e2e (supertest) for register→cart→checkout(test
  payment)→enrolled→playback; `npm test` green.
- Web: typecheck + lint green; Playwright smoke: home, course page, register, buy (test payment), My Learning, play lecture,
  instructor creates course + submits, admin approves.
- Every screen reviewed in screenshots at 1440 px and 390 px; light and dark.
