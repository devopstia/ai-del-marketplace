# AGENTS.md: how to work on the AI Learning Marketplace

Read this first, then **`docs/HANDOFF.md` (current state, open owner decisions, how to test and release)**, then `docs/DECISIONS.md`, `docs/BUILD_SPEC.md` and `docs/API.md`. Everything for this marketplace (code, plans,
research, docs) lives in this repository.

## What this is
A multi-instructor AI and DevOps learning marketplace for DevOps Easy Learning (DEL): students discover, preview, buy and study
courses; independent instructors publish and are paid through Stripe Connect; a super admin runs the platform.
Stack: Next.js 16 (`apps/web`) · NestJS 12 modular monolith + BullMQ worker (`apps/api`) · PostgreSQL (Prisma migrations) · Redis ·
S3/MinIO · Stripe · Mux. Local: `./scripts/make-env.sh && docker compose up -d --build` then `docker compose exec api npm run seed`.

## Owner's standing rules
1. **Approval before major work.** Audit → research → proposal → the owner approves → implement. Present findings, a prioritized
   roadmap and reuse plan first (owner, 2026-11-24).
2. **Only use what is needed** from the reference projects (DEL website, Insurance Knowledge Hub); never copy their secrets.
3. **World-class, not a clone** (owner, 2026-11-24): benchmark Udemy, Coursera, Skillshare and others; keep what works, fix their
   weaknesses, and add genuinely useful innovations (AI learning assistant grounded in course content, AI video search to the exact
   moment, AI study materials, personalised paths, hands-on labs with an AI troubleshooting assistant, skill analytics, instructor AI
   tools, career features, community). Features are integrated thoughtfully, not added as more buttons.
4. **Every visible control works.** No button, link, menu or form that does nothing. Never present a feature as working unless it is
   implemented and tested end to end. Unfinished features are hidden, not shown as placeholders.
5. **Exceptional, premium design**: impressive from the first screen; consistent typography, colour, spacing, motion; no excess
   empty space, no repetitive rectangle grids, no generic template look; every page has a clear purpose. **Light is the default
   theme for the whole site** (owner, 2026-11-25, final review; it replaced the earlier dark default); dark is available from the toggle and remembered. Outgoing emails always use the dark email design. Light/dark, 390–1440 px,
   accessible (keyboard, focus, contrast, reduced motion). Review every changed screen in screenshots at **390, 1440 and 1920 px** (the owner works on a ~1970 px screen) before calling it done; no empty regions or stranded elements (owner, 2026-11-24: homepage hero "empty", instructor band "not good", /teach "not well design").
6. **Dashboards are organized, not overloaded**: student (engaging learning), instructor (professional business tools), super admin
   (full operational visibility).
7. **Preserve what works**; enhance instead of rebuilding. Keep multi-instructor, Stripe Connect, enrolment, purchasing.
8. **Security is non-negotiable**: httpOnly session cookies + CSRF, ownership checks in the service layer, signed short-lived media
   URLs, verified idempotent webhooks, audit log for privileged and financial actions, secrets only in `.env` (never committed).
9. **Git**: feature branches; local commits; **no push, merge or non-local deployment without the owner's approval**.
11. **Captions/transcripts OFF by default** (owner, 2026-11-24: "Turn off the transcript by default. a student can add it if they
    want"): captions are available where a video has them, but never shown until the student turns them on (CC button); the
    student's own choice may be remembered. No always-visible transcript panel.
12. **Front end: small steps, owner reviews each** (owner, 2026-11-24: "I don't like the front upgrade… reverse it… make
    modification slowly. Only front"). The big Phase 1 front-end redesign was rejected and reverted (kept only in
    `git stash` "rejected-front-upgrade-2026-11-24" for reference; don't re-apply it wholesale). Change ONE page/section at a time,
    show the owner screenshots (390/1440/1920), wait for OK, then the next. Never run a parallel bulk redesign.
13. **Always preserve the approved design before changing it** (owner, 2026-11-24, mandatory): before modifying an existing
    design, make sure the current working version is committed, mark it with an annotated tag (`design-approved-<date>`) and a
    `backup/…` branch, record the hash, and do the work on a dedicated `feat/…` branch. Never merge or deploy a redesign without the
    owner's approval. Rollback on request: `git checkout <tag> -- apps/web` (or the affected paths) on the working branch, then
    rebuild the web container; unrelated work stays. Current baseline: `main` = production release `release-2026-11-27-course-publisher` (images `6307ad1c77f2`; light default theme); earlier approved design tags `design-approved-2026-11-24` = `9b0170e`, `release-local-2026-11-24`.
14. **Natural, not AI-generated design** (owner, 2026-11-24): clean typography, consistent spacing, proper alignment, professional
    colour; avoid excessive gradients, glows, repetitive cards, oversized headings, needless animation and decoration. Improve the
    existing identity, don't replace it. Preserve the course listing and course detail pages (owner likes them).
15. **Permanent rules for every agent** (owner master brief, 2026-11-24; they reinforce rules 1–14):
    - Inspect the existing code, docs and running app before changing anything; never assume a feature is missing until checked.
    - Before **any** modification phase (not only redesigns): commit the working state, add an annotated `checkpoint-<date>-<topic>`
      tag and a `backup/…` branch, record the hash in `docs/DECISIONS.md`, then work on a dedicated `feat/…` branch. No
      `reset --hard`, force push or branch deletion.
    - Never rebuild what works. Preserve the course and video functionality (catalogue, course page, curriculum, player, studio uploads).
    - Research professional references before major UI changes (`docs/research/`); decisions must be evidence-based.
    - Simplicity, professionalism and usability over decoration; no generic AI-generated look.
    - Functional features only, never decorative placeholders; test before presenting anything as complete; show screenshots.
    - Never merge or deploy major changes without the owner's approval; keep docs and rollback points current.
    - Don't create duplicate instruction files: this file is the single source of agent rules.
10. **Done means tested**: `npm test -w apps/api` (unit + e2e), `./scripts/smoke-api.sh`, `npm run typecheck && npm run lint -w apps/web`,
    Playwright `npm run test:e2e -w apps/web` (wait ~60 s after the API smoke run: register is rate-limited per IP), all green on a
    fresh stack (`docker compose down -v`), then a clean demo: fresh stack, `npm run seed`, `./scripts/import-del.sh`,
    `./scripts/demo-catalogue.sh` (only "AI for DevOps" listed, per the owner).
16. **Both themes are first-class; browser QA is part of "done"** (owner, 2026-11-25: "Dark mode should not look like an
    afterthought"; later the same day, final review: **light is the default** for new visitors). Every agent, for every
    frontend component, page or feature it creates or changes:
    1. **Light default, dark equal.** Build and judge the work in light (what visitors see first) and in dark (the stricter
       contrast check: `scripts/qa-dark.mjs` scans dark by default, `--light` scans light). Use
       the design tokens in `apps/web/src/app/globals.css` (`--paper`, `--surface`, `--ink`, `--muted`, `--line`, `--violet`,
       …); never hard-code a light-only colour (`bg-white`, `text-black`, `#fff` text on a token background, etc.).
    2. **Check readability and consistency**: text contrast at least 4.5:1 (3:1 for large text and icons), the same surfaces,
       borders, buttons, focus rings, hover, selected, disabled, alert and toast states as the rest of the site; no invisible
       text, no light patches, no overlapping or misaligned elements.
    3. **QA in a real browser before calling it done.** Open every changed page and its states (empty, loading, error, filled,
       signed out / student / instructor / admin as relevant) and run the contrast scan
       `node scripts/qa-dark.mjs [--as student|instructor|admin] [--widths 390,768,1440,1920] [--light] paths…` (it fails on text
       under the contrast threshold and on pages that scroll sideways). Text drawn over an image or video can't be measured: mark
       its container `data-qa-on-media` and check it by eye. A clean build is not proof.
    4. **Check sizes**: phone 390, tablet 768, desktop 1440 and the owner's 1920 px, with no sideways scrolling.
    5. **Fix dark-mode problems before asking for review**, and show the owner dark screenshots (light only where relevant).

17. **Standard course covers only** (owner, 2026-11-25: "every course cover should feel like it belongs to the same
    platform"). Every course image is a cover generated on the server from a platform template and the course title
    (`apps/api/src/covers/`: `cover-templates.ts` = the built-in collection, `cover-render.ts` = the renderer,
    `covers.service.ts` = storage and regeneration). Agents must:
    - never add a way to upload a custom course image, and never use a video frame or thumbnail as a course cover;
    - show course images only through the generated cover URL (`thumbnailUrl` on cards = `coverKey`);
    - make new templates from the existing layouts, palettes and designs (or extend them in the renderer) in the DEL font,
      with the topic label and DEL mark; check every new one renders at 1280×720 with a long and a short title, in dark and
      light pages (`npx jest src/covers` in apps/api renders all of them);
    - keep covers regenerating when the title, topic or template changes; bump `RENDER_VERSION` in `covers.service.ts`
      after changing the drawing code so existing covers are redrawn.

18. **Installable app (PWA)** (owner, 2026-11-25): the site must stay installable on phones and computers (docs/PWA.md).
    The service worker only shows the offline page and must never cache pages, API responses or videos. New pages work in
    the installed app: no reliance on browser chrome, fixed elements respect `env(safe-area-inset-*)`, phone inputs stay
    16 px. `apps/web/e2e/pwa.spec.ts` must stay green (Chrome's installability check reports no errors).

19. **Sign-in security** (owner, 2026-11-25: "registration extremely easy, but account access must remain secure";
    docs/AUTH.md). Every agent keeps these true:
    - Sign-in methods: email + password, Google, GitHub, Facebook, LinkedIn. A provider's button exists only when its
      keys are set (Super Admin › People › Sign-in methods, `/admin/sign-in`: keys checked with the provider, sealed,
      step-up code, audited; `.env` keys also work). Every method ends in the same two-step flow: **no session before a second step**: a Google Authenticator
      code, a recovery code, a trusted device of an enrolled account, or (students and instructors only, when the Super
      Admin allows it; owner 2026-11-26) a code sent to their email. **Admin and Super Admin always need the
      authenticator**; email codes are never enough for them (enforced in the API, the settings can't be saved otherwise).
    - Session security (owner 2026-11-26; docs/AUTH.md §7, Super Admin › People › Authentication & security): inactivity
      timeout with a warning (watching a video counts as activity), maximum lifetime, one signed-in browser per account
      (a completed sign-in ends the older one; a failed code never does), all enforced in the API. Sessions have a `kind`:
      only `user` sessions count; super admin support sessions (`support`) never disconnect the person. End sessions only
      through `SessionPolicyService.end()` (reason, audit, stops video playback). Government ID verification: not offered.
    - Accounts are matched by the provider's account id, **never merged by email**; linking happens only from a
      signed-in account (Account › Security) through the provider. One person = one account (courses, purchases,
      progress, roles).
    - Passwords: 12+ characters, letters and numbers, not the email/name, Have I Been Pwned range check (fail open),
      argon2id; lockout after 5 failures; reset links single use, 1 hour, end every session and trusted device.
    - Secrets, seeds and tokens are stored hashed or sealed, never logged; provider keys only in `.env`; the test
      provider never in production. Privileged changes (MFA reset, linking) are audited and emailed.
    - Tests, scripts and tools sign in through the real code step (`scripts/totp.mjs`, `SEED_MFA_SECRET`), never by
      bypassing it. `MFA_REQUIRED=false` in a local `.env` skips the code step on the owner's machine only (ignored in
      production); run the test suites with `MFA_REQUIRED=true`.

20. **One-year access and refunds** (owner, 2026-11-25: "I do not want our platform to offer lifetime access";
    docs/ACCESS_AND_REFUNDS.md). Never write "lifetime access" anywhere. A purchase gives 12 months; expiry is enforced in
    the API (`hasAccess`), never only in the UI; progress is never deleted; renewal is a new purchase at the current
    price, never automatic. Refunds: within the refund period **and** at most the watch limit of the paid video,
    measured only from merged playback ranges (unique seconds), never estimated. The numbers (default 14 days, 25 %) and
    the automatic handling come from the versioned refund policy (Super Admin › Refunds › Policy, owner 2026-11-26),
    **never hard-coded**: a purchase keeps its version, a later stricter version never applies to it. Missing or
    inconsistent tracking goes to a person, never an automatic decline. Every request is recorded with its facts; a
    decline can always be reviewed by a person; only a Super Admin overrides an automatic decline, with a reason. A
    refund is reported to the student only once the payment provider confirms it. AI may summarise refund facts for
    admins but never decides or invents numbers.

21. **Four roles and studios** (owner, 2026-11-25; docs/ROLES_AND_STUDIOS.md). Student is the default for every
    public sign-up (any method; registration schemas `.strict()`), Instructor only through an approved application
    or a super admin grant with a reason, Admin only with explicit permissions (`common/permissions.ts`, `@Perm`),
    Super Admin = DEL. Enforced in the API on every request, never by hiding menus. Only super admins change roles;
    no self-changes; step-up authenticator code for Admin/Super Admin changes; last super admin protected; every
    change audited. Every studio uses `AppShell`: collapsible sidebar, studio switcher, **Back to marketplace**
    always visible, back button, breadcrumbs; users must never feel trapped in a studio. New student pages go in
    the Student Studio (`/student/...`).

22. **Course content** (owner, 2026-11-25). Instructors build the whole curriculum on one screen
    (`components/studio/CurriculumStep.tsx`): drag sections and lessons (also between sections, one
    `PUT /instructor/courses/:id/curriculum`), upload each lesson's video from its row, several videos at once,
    and **files per lesson** (ZIP, PDF, Word, configs) where learners need them; the **complete course package**
    (`course_resources`) is an extra, never a replacement. Learners see a lesson's files under its video. Published
    courses change only through the draft revision. Paid files only for owners, admins and active enrolments.

23. **Production and global access** (owner, 2026-11-25; docs/DEPLOYMENT.md). Production is
    **https://ai-devopseasylearning.com** (staging: staging.ai-devopseasylearning.com), in the Insurance Hub AWS account
    with its own `del-marketplace-*` resources from `infra/terraform` (EC2, RDS, S3, ECR, SES, SSM, IAM, alarms).
    Secrets only in SSM Parameter Store (instance role, GitHub OIDC; never Hub credentials, never in git, images or
    workflows). Releases go through `release.yml` / `scripts/deploy-aws.sh` (staging first, snapshot, SSM; no SSH).
    **Stripe stays in test mode until the owner explicitly authorises live payments** (Super Admin › Payments &
    Stripe, typed confirmation + authenticator). **Never upload local training videos or unfinished courses to AWS**
    until the owner says so. **Never copy the Hub's geographic blocking** (nginx geo allowlist, CloudFront geo
    restriction, WAF geo rules): the marketplace is global, Africa included; protect it with rate limits, MFA and
    Stripe fraud checks instead. Never modify, delete or disrupt Insurance Hub resources.

24. **Email** (owner, 2026-11-25; docs/EMAIL.md). Every email goes through a template in `src/email/templates.ts`
    (the Hub's layout with DEL branding, dark-mode variant, text part) and the queue (`jobs.sendEmail`, with a
    `dedupeKey` when a retry could repeat it). No email for routine sign-ins. Locally read them in Mailpit
    (http://127.0.0.1:8025); production sends through Amazon SES for ai-devopseasylearning.com.

25. **Manual enrollment** (owner, 2026-11-25; docs/MANUAL_ENROLLMENT.md). Instructors request (own courses only),
    super admins verify external payments (allocation per course, actual fees, USD with the original currency),
    approve and activate, or enroll directly; never Stripe charges or payouts; 80/20 of the net per instructor;
    invitations hashed, single use, 7 days, newest link only, email code before the password, then Google
    Authenticator. Never grants Instructor or Admin roles.

26. **Guest cart, review moderation, storage** (owner, 2026-11-25). Visitors shop without an account (course ids only
    in the browser, `lib/guest-cart.ts`); sign-in is asked only at checkout and the cart merges after any sign-in.
    Instructors report reviews, never delete them; admins hide/restore with a reason, only super admins delete; honest
    low ratings stay. New uploads go under `instructors/<id>/courses/<id>/…` (`common/storage-keys.ts`).

27. **DevOps Easy Learning full program** (owner, 2026-11-25). The marketplace sells individual courses and
    promotes the full training program on **https://www.devopseasylearning.com** (`lib/del-program.ts`; the www host
    because the bare domain's certificate doesn't cover it): homepage band, footer, course pages, Student Studio.
    Not in the top menu bar (owner). Enrolment and payment for the program happen only on that site, never through
    the marketplace checkout. Social links (YouTube, Facebook, X, TikTok, LinkedIn) live in `components/SocialLinks.tsx`.

28. **Support sessions and AI agents** (owner, 2026-11-26; docs/SUPPORT_SESSIONS_AND_AGENTS.md). A super admin may
    open a non-super-admin's dashboard only through a support session (step-up code, reason, time limit, the person
    is emailed, banner on every page, Return without signing in again). AI agents work only through scoped,
    expiring, revocable agent tokens for ONE instructor on `/api/agent/*` (MCP server `tools/mcp-server`, skill
    `.claude/skills/del-course-agent`): never publish, never payments, never other accounts. `req.user` is always the
    effective user, `req.realUser` the person at the keyboard; audit entries always name the real person
    (`onBehalfOfId`, `agentTokenId`, `supportSessionId`, `status`). Nothing is ever attributed to the student or
    instructor. Account security, money, learning records and admin writes stay blocked in support sessions; a new
    session-security rule must not end or count support sessions.

29. **Course Upload and Publishing Agent** (owner 2026-11-26). Courses from the AI video folders are uploaded by the
    `del-course-publisher` agent (`.claude/agents/`, skill `.claude/skills/del-course-publisher`, settings
    `courses/publisher.config.json`, one `courses/<slug>/plan.json` per course, tool `tools/mcp-server` →
    `del-publish-course`). Staging and drafts only until the owner says otherwise; review captions, slides and labs
    before structuring; never upload PowerPoint, thumbnails or secrets; idempotent re-runs; report, then update
    `courses/LESSONS_LEARNED.md` and `courses/GENERATION_FEEDBACK.md`.

30. **Course Creation and Publishing Standard** (owner 2026-11-26, global): `docs/COURSE_STANDARD.md` is the authority
    for every agent that generates, organises, uploads or publishes courses (generation agent, `del-course-publisher`,
    `del-course-agent`). Think like an instructor; study every lesson's content before placing it; an honest, compelling
    course page; an introduction video first (position reserved, never an empty lesson); at least two free previews;
    modules in a learning order; new lessons inserted where they belong with existing lesson ids kept (progress,
    enrolments, quiz results preserved); agents talk through `course.manifest.json`, `courses/GENERATION_FEEDBACK.md`
    and `courses/LESSONS_LEARNED.md`; instructor, student and customer review before anything goes to students.

## Known pitfalls
- Use `127.0.0.1`, not `localhost` (cookies are shared by host between web :3000 and api :4000).
- After sign-in/registration use a full navigation (`window.location.assign`), not `router.push`: production Next.js may serve a
  prefetched copy made while signed out (a cached redirect to /login).
- MinIO's official image is no longer published; local dev uses the pinned community build `pgsty/minio`. Production uses S3.
- Stripe and Mux code paths are untested against the real services until keys exist; local payments use the dev-only test mode.
- The release scan gate (`.github/workflows/images.yml`) blocks CRITICAL image findings; accepting one is the owner's decision
  (see docs/HANDOFF.md §2). ECR tags are immutable; git release tags are never moved (`-r2`, `-r3` for successors).
- Staging and production share one EC2 server and one RDS instance on purpose (owner will delete staging later); don't load-test
  staging while real users are on production. More pitfalls: docs/HANDOFF.md §5.

## Where things are
`docs/ASSESSMENT.md` (original assessment) · `docs/DECISIONS.md` · `docs/BUILD_SPEC.md` · `docs/API.md` · `docs/research/` ·
`docs/ROADMAP.md` (2026-11-24 roadmap, historical) · `scripts/` (env, smoke, deploy-aws.sh) · `docs/DEPLOYMENT.md` · `docs/EMAIL.md` ·
`docs/MANUAL_ENROLLMENT.md` · `docs/ROLES_AND_STUDIOS.md` · `docs/ACCESS_AND_REFUNDS.md` · `docs/AUTH.md` · **`docs/HANDOFF.md`** ·
`docs/FINAL_REVIEW_2026-11-26.md` (latest audit + release) · `docs/AWS_COSTS.md` · `docs/STORAGE.md` · `docs/PAYMENTS.md` ·
`docs/VIDEO_DELIVERY.md` · `docs/AI_LEARNING.md` · `docs/SEO.md` · `docs/TRUST.md` · `docs/CAREER_PATHS.md` · `docs/SUPPORT_SESSIONS_AND_AGENTS.md` · `docs/COURSE_STANDARD.md`. Local email inbox: http://127.0.0.1:8025.
