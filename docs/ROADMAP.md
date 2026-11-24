# From good to exceptional: improvement roadmap

**Status: proposal for the owner's approval (2026-11-24). Nothing below is implemented yet.**
Inputs: the platform audit (`docs/research/platform-audit-2026-11.md`), the competitor benchmark
(`docs/research/competitor-benchmark-2026-11.md`), and our own course production (37 finished videos with captions and lab ZIPs).

## Where we stand
- **v1 works end to end** for every role (audit: no broken journeys, no server errors, every page interactive in under 1 s, solid
  accessibility, consistent visual system). Keep: purchase → learn → certificate loop, refunds, the player, the studio editor with
  its readiness checklist, the admin review queue, honest test-payment copy, the loop identity, the accessibility foundation.
- **Ten real problems** (P1) and a set of design weaknesses: wrong instructor stats on the home page, "Save and continue" advancing
  after a failed save, price validation mismatch, a promo status stuck on "Processing", a Stripe payouts button that can't work yet,
  "downloadable lab files" promised on every course, one-click admin role changes, live edits to published courses with no review,
  placeholder content presented as real, repeated generic covers, empty page bottoms, desktop layouts squeezed onto mobile.
- **The market**: Coursera and Udemy merged (closed 11 May 2026: Coursera 10-Q). AI assistants grounded in course content are now
  table stakes (Udemy, Coursera Coach, Pluralsight Iris, DataCamp). Learners complain about uneven quality, outdated content,
  endless fake discounts, slow Q&A and weak hands-on practice; instructors about shrinking revenue shares.

## Our positioning: "the place where AI and DevOps skills are proven, not just watched"
1. **Every lesson is runnable**: a lab per lesson, verified on a date with tool versions, and an AI helper that fixes your lab.
2. **Find the exact moment**: search across every course's transcripts and jump to the second where it's explained.
3. **An assistant that cites its sources**: answers from the course's own transcripts and labs, with clickable timestamps.
4. **Honest marketplace**: real prices (no fake strike-through), a "last verified" date, instructor Q&A response times, and a fair,
   visible revenue share for instructors.

## Phases

### Phase 1: Make everything true and polished (first; ~1–2 weeks)
- Fix the ten audit P1 items and P2 polish (pagination, order details and partial refunds, friendly validation messages, toast
  de-duplication, one enrolment check per page, captions and avatar upload in the studio, focus in the preview modal).
- **Published-course safety**: edits to a published course create a draft revision that goes through review (the IKH revision
  pattern); admin role changes need confirmation; payouts UI shows "Stripe not connected yet" instead of a failing button.
- **Replace placeholder content with our real catalogue**: import the finished DEL videos (AI Foundations, labs, explainers) with
  their captions, thumbnails, quizzes and lab ZIPs as DEL courses; remove fake ratings and the invented testimonial.
- **Design elevation pass**: a premium homepage (hero with real course art and the live loop, curated rows, learning paths, social
  proof only when real), distinctive course covers from our own video art, a richer course page (no overlaps, a full-height layout,
  "what you'll build", lab preview, last-verified badge), a mobile-first redesign of the player, studio and admin tables.

### Phase 2: Table stakes, done better (~2–3 weeks)
Wishlist · coupons and real sale prices (honest, time-boxed) · gift purchases · bundles · notifications (in-app + email) and
instructor announcements · course Q&A with an instructor response-time badge · bookmarks and notes synced to the account (with
timestamps) · certificate sharing (LinkedIn, verify page) · reviews moderation · instructor analytics (drop-off per lecture,
conversion) · a DEL subscription plan **if** the owner wants one (see decisions).

### Phase 3: AI that genuinely helps (~3–4 weeks)
- **Transcripts for every lecture** (our videos already have captions; uploads get automatic transcription).
- **Course assistant**: answers from the course's transcripts, articles and lab files only, citing clickable timestamps; refuses
  off-topic; per-user daily limits and caching to cap cost.
- **Moment search**: catalogue-wide semantic search over transcripts → results with the exact second → opens the player there.
- **Study materials**: AI-drafted summaries, flashcards and practice questions per section, **reviewed by the instructor** before
  students see them.
- **Instructor AI tools**: chapters from transcripts, quiz drafts, descriptions, caption translation, "confusing moments" (where
  students ask the assistant most).
- Provider: Amazon Bedrock or the owner's own key (BYOK), behind one interface; prompt-injection guards; secrets redacted.

### Phase 4: Hands-on labs and skills (~3–4 weeks)
- **Lab guides per lesson** (steps, expected output, troubleshooting), runnable on the learner's computer or VM, from our lab ZIPs.
- **"Fix my lab" assistant**: paste the error or output; secrets are redacted before anything is sent; answers grounded in the lab
  guide.
- **Verified badges**: labs tested automatically (CI) on a schedule; the course page shows the last pass date and tool versions.
- **Skills**: skill map per course, short skill assessments, progress and skill analytics, personalised learning paths and career
  paths (e.g. "AI Platform Engineer"), interview practice later.
- **Hosted cloud sandboxes**: later, as a paid tier (cost and abuse controls required).

### Phase 5: Community and scale
Study groups and discussions, live sessions or cohorts (optional), multilingual UI and captions, team/business accounts.

### Launch readiness (in parallel when the owner is ready)
Stripe test keys → full Connect testing → live account; Mux account; S3 + CloudFront; production deployment (AWS), monitoring,
backups; terms, refund policy and instructor agreement; tax and accounting advice (we are merchant of record).

## What we reuse
Everything in v1 that works (above) · IKH patterns: revision-under-review, watermark/trace for piracy, analytics kit, email
outbox · our video pipeline outputs (MP4, captions, thumbnails, quizzes, lab ZIPs) as the DEL catalogue · our lab and AI agent work
(BYOK clients, redaction) for the assistants.

## Decisions for the owner
1. Approve **Phase 1** to start now (fixes, real catalogue import, design elevation).
2. **Pricing model**: individual courses only, or also a DEL subscription (all DEL courses) and bundles?
3. **Instructor revenue share** for independent instructors (e.g. 80/20 in their favour, published openly).
4. **AI budget and provider** for Phase 3 (Bedrock vs. your own OpenAI key; monthly cap).
5. **Labs**: local/VM labs first (recommended), hosted sandboxes later as a paid tier.
