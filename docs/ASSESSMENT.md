# AI Learning Marketplace: assessment and proposed plan

**Status: for the owner's review and approval. Nothing is implemented yet.** (2026-11-24)

Sources reviewed (read-only): the DevOps Easy Learning platform (`devops-work/org/del/del-website`), the Insurance Knowledge Hub
(`insurance-knowledge-hub`), and current Stripe and video-hosting documentation. Detailed notes: `docs/research/`.
Guiding instruction from the owner: **use only what is needed.**

---

## 1. The existing DEL platform: what we have

**Shape:** Next.js 14 web app + Go gateway + six NestJS/TypeORM services (iam, user, course, commerce, community, platform) + two
FastAPI services (ai, tts), Postgres (one database per service), Redis, Docker Compose. About 790 files.

**What works:** a polished, Udemy-like frontend (catalogue, course page with YouTube previews, cart, checkout screens, student
dashboard with player and notes, a large admin area), dark mode, i18n (en/es/fr), multi-stage Dockerfiles.

**What doesn't (verified in the code):**
| Area | Finding |
|---|---|
| Authentication | Effectively absent. Only `refresh`/`logout` in iam-service have guards; every other endpoint is open. The web app treats **any `Bearer` token as admin** (`web/lib/auth.ts`), uses one shared admin password stored in localStorage, and identifies students by an id in localStorage |
| Authorization | Roles/permissions tables exist but are never enforced; any caller can read or change another user's cart, payments, enrolments, profile by changing an id |
| Payments | Checkout collects **raw card numbers** in plain inputs (a PCI problem) and posts to an endpoint that doesn't exist; ownership is granted in the browser. Stripe is used only for PaymentIntents; `POST /payments/confirm` is open; the webhook route, raw body and fulfilment are all broken. **No Stripe Connect** |
| Video | Paid video URLs are **public S3 links**; the whole curriculum (with every video URL) is returned to anyone; no transcoding, no HLS, no signed playback |
| Data | Curriculum stored as one JSONB blob; categories are free strings; a second, file-based JSON "database" inside the web app; hardcoded demo courses, reviews and coupons |
| Learning | Progress is lesson-completion only, in localStorage; no resume position, no captions; certificate and progress routes don't match the backend |
| Instructors | No instructor role, dashboard or onboarding (a marketing page only) |
| Engineering | No tests, no CI, no migrations (`synchronize` only), lockfiles gitignored |

**Conclusion:** the frontend and the domain ideas are valuable; the backend is scaffolding with critical security gaps. Patching auth,
commerce and media in place would cost more than building them correctly once.

## 2. Insurance Knowledge Hub: what to reuse

A mature, tested product (≈2,350 unit tests, 87 Playwright specs, CI/CD) with patterns that fit a marketplace well:
- **Video player** (resume, speed, chapters, captions, autoplay + "Up next", theater/fullscreen, keyboard).
- **Content review workflow** (draft → in review → changes requested / rejected / published / unpublished, revisions, audit trail):
  becomes course submission and approval.
- **RBAC engine** (permissions defined in code, roles in the database, rank rule), **session security** (single signer, revocation,
  MFA/passkeys), **direct resumable S3 uploads**, **captions pipeline**, **Stripe webhook + reconciliation** pattern, **admin UI kit**
  (users panel, tables, KPI cards, audit viewer), theme engine with contrast checks, CI/CD with AWS OIDC and post-deploy e2e.
- **Not reused:** insurance content, team/sponsorship features, its single-database/11-copies layout, schema-without-migrations,
  tokens in localStorage, and its committed secrets (this repo commits `.env.example` only).

## 3. Gap analysis (Udemy-style marketplace)

Missing or to rebuild: real authentication and roles · instructor accounts, onboarding and dashboard · normalised course →
section → lecture → asset model with versions and review status · course approval queue · categories · server-side cart, orders and
order lines · Stripe Checkout + Connect + verified, idempotent webhooks · enrolment on confirmed payment · protected video upload,
processing and signed playback · progress with resume position · captions · lab/resource downloads with access checks · quizzes and
certificates wired to lessons · verified-buyer reviews · commission ledger, instructor revenue, payouts, refunds and reconciliation ·
super admin with audit logs · tests, CI, migrations, backups, monitoring.

## 4. Recommended architecture: lean and secure

**One web app + one API (a modular monolith) + one worker.** A course marketplace doesn't need eight services; modules keep clean
boundaries and can be split later if traffic demands it.

```
 Browser ──► Next.js (TypeScript, App Router)  ── httpOnly session cookie ──►  API (NestJS, TypeScript)
                public catalogue · learner app · instructor studio · admin           modules: auth · users · catalogue ·
                                                                                      curriculum · media · commerce ·
                                                                                      enrolment · learning · reviews ·
                                                                                      payouts · admin · audit
                                                                                         │            │
                                                                     PostgreSQL (migrations) ◄─┘   Redis + BullMQ worker
                                                                                                  (webhooks, emails, media jobs)
 Stripe (Checkout + Connect) ──webhooks──► API          Video provider (signed playback) ◄── API issues tokens
 S3 (private: lab files, images) ◄── presigned, short-lived URLs only for enrolled students
```

- **TypeScript end to end:** keeps DEL's Next.js/NestJS skills and lets us reuse IKH's React components directly (its backend patterns
  are ported, not copied).
- **Security by default:** every endpoint authenticated and authorised; ownership checks in the data layer (an instructor can only
  query their own courses, sales and students); httpOnly cookies; rate limits; audit log for every privileged action; secrets only
  in `.env` / a secrets manager.
- **Data:** users, roles · instructors (profile, Stripe account id, status) · categories · courses (owner, price, status, version) →
  sections → lectures (video asset, duration, preview flag) → resources · orders → order lines (course, instructor, amount,
  commission) · payments, transfers, refunds · enrolments · progress (lecture, position, completed) · reviews · quizzes, attempts ·
  certificates · audit log. Migrations from day one.

## 5. Payment design (Stripe Connect)

**Recommended: one Stripe Checkout Session per cart, then one transfer per instructor ("separate charges and transfers").** It is the
Stripe model that supports a Udemy-style cart with courses from several instructors.
1. Student checks out → Checkout Session on the platform account (Stripe collects the card; we never touch card data).
2. Verified webhook (`checkout.session.completed`, async success/failure) → mark the order paid → **enrol the student** (idempotent).
3. For each instructor in the order: transfer (price − platform commission) to their connected account, linked to the charge.
   DEL's own courses need no transfer if the platform account belongs to DEL.
4. Refunds reverse the matching transfer; disputes and failed payments update the order and enrolment; a nightly reconciliation
   job compares our ledger with Stripe.
5. Instructors connect through **Stripe-hosted (or embedded) onboarding**, never by entering keys. New accounts use Stripe's current
   Accounts v2 "recipient" configuration.

**What this means for you:** the platform is the merchant of record: your name on card statements, and you carry refunds,
disputes, negative balances and (depending on jurisdiction) sales-tax obligations. Cross-border instructors are limited to the
US/CA/UK/EEA/CH corridor. **Simpler alternative:** one checkout per instructor (destination charges), less code but no mixed cart.

## 6. Video hosting

**Recommended to start: a managed video service (Mux)**: direct uploads from the instructor studio, automatic adaptive streaming,
signed playback tokens (no public links), automatic captions, DRM available later. Estimated cost for the first ~300 videos:
roughly $5–20 per month. We keep a small "video provider" interface so we can move to self-hosting later.
**Alternative:** private S3 + transcoding to HLS + CloudFront signed cookies (reusing IKH's packager and watermark): more control,
more work and more operations.
Lab ZIPs, scripts and images: private S3, short-lived presigned links for enrolled students only.

## 7. Frontend design

Our own brand identity for DevOps Easy Learning (not a Udemy clone): a distinctive, professional design system (tokens, type,
light/dark), built for discovery and studying:
- **Public:** home (featured, popular, new, categories, instructors), search with filters and sorting, course pages (cover, promo
  video, free previews, curriculum with durations, objectives, instructor, verified reviews, sticky purchase card), instructor
  profiles, cart, checkout, confirmation.
- **Learner:** My Learning (continue where you left off), the player (outline sidebar, resume, speed, captions, next/previous,
  notes, resources, quiz), certificates, purchase history and receipts.
- **Instructor studio:** guided course creation (details → media → curriculum → pricing → submit), uploads with progress, sales,
  students, reviews, payouts (Stripe onboarding status).
- **Admin:** approvals queue, courses, instructors, users, categories, orders/refunds, commission settings, analytics, audit log.
We reuse DEL's page layouts and IKH's player/admin components as references, and review every screen in screenshots before calling it
done.

## 8. Roadmap (local deployment at the end of every phase)

| Phase | Delivers | Reuses |
|---|---|---|
| 0. Foundations | Repo layout, Docker Compose, CI, migrations, auth (cookies, roles), RBAC, audit log, design system | IKH RBAC + session ideas; DEL Tailwind theme |
| 1. Catalogue + studio | Categories, course/section/lecture model, instructor studio, uploads (video + resources), approval workflow, public catalogue + course pages with previews | IKH review workflow + uploads; DEL catalogue/course layouts |
| 2. Buy + learn | Cart, Stripe Checkout (test mode), verified webhooks, enrolment, My Learning, player (resume, progress, captions), downloads, receipts | IKH player + webhook/reconcile; DEL dashboard layout |
| 3. Instructors get paid | Stripe Connect onboarding, per-instructor transfers, commission settings, revenue dashboards, refunds/disputes, reconciliation | — |
| 4. Engagement | Verified reviews, quizzes, certificates, coupons, search ranking, emails | DEL review/coupon ideas |
| 5. DEL catalogue + launch prep | Import the AI course videos and lab ZIPs as DEL courses; security review, backups, monitoring, production deployment plan | ai-videos outputs |

## 9. Risks and decisions for you

**Decisions needed before Phase 0:**
1. **Build lean in this repo (recommended)**, reusing designs and patterns, vs. patching the DEL codebase in place.
2. **Stack:** TypeScript end to end (Next.js + NestJS) (recommended) vs. Python backend (IKH-style FastAPI).
3. **Payments:** one cart with several instructors (separate charges and transfers, platform is merchant of record) (recommended) vs.
   one checkout per instructor (simpler). Whose Stripe account is the platform: DevOps Easy Learning's?
4. **Commission:** platform fee for independent instructors (e.g. 0% at launch, configurable).
5. **Video:** Mux to start (recommended) vs. self-hosted S3/HLS/CloudFront.

**Risks:** being merchant of record (refunds, disputes, tax: get accounting/tax advice before going live) · Stripe Connect country
limits · content quality and copyright from outside instructors (approval workflow, takedown process) · video piracy (signed
playback, watermark later) · scope creep (stick to the phases) · the two reference repos contain committed secrets: never copy them.

**Not doing:** no changes to `devops-work` or `insurance-knowledge-hub`; no push, merge or deployment beyond local without your OK.
