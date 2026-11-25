# Features to bring over from the Insurance Knowledge Hub (2026-11-25)

Source: `/home/tia/work/insurance-knowledge-hub` (read-only review of its `docs/`, `frontend/`, `services/`, `video-academy/`).
Its secrets (`.env`, `.deploy-secrets.env`, `keys/`) were not opened and must never be copied (AGENTS.md rule 2).

**Stack difference.** The Hub is Next.js 15 / React 18 + Python FastAPI microservices; we are Next.js 16 + one NestJS API.
Backend logic is **ported** (rewritten in NestJS following its documented rules); frontend pieces (speech engine, search
palette, PWA files, HLS player) can be **adapted** more directly. Nothing is copied wholesale.

## What our marketplace already has
Catalogue, course pages, player with signed URLs and captions (off by default), quizzes per lecture with explanations,
notes, progress, certificates, reviews, cart/checkout/refunds/payouts, sales and promotions, standard covers, studio,
admin. Dark-first design rules.

## Candidates, by value for an AI and DevOps learning marketplace

| # | Feature (Hub doc) | What it does there | Why it helps DEL | Size |
|---|---|---|---|---|
| 1 | **AI Tutor** + AI explanations (`AI_BYOK.md`, `TRAINING.md`) | Ask questions; answers grounded in the course; platform key or the user's own key | The "AI learning assistant grounded in course content" in our rule 3; strongest differentiator vs Udemy | L |
| 2 | **Read aloud** (`SPEECH.md`, `frontend/lib/speech/`) | Listen to chapters, quiz questions, explanations; follow-along highlight; free browser voices | Accessibility and learning on the go; no running cost | S |
| 3 | **Practice and retention**: flashcards, practice exams, question of the day, streaks, study plan and reminders, mastery (`TRAINING.md` §4–5, §10) | Turns content into daily practice | Keeps learners coming back; needs quiz banks per course | M–L |
| 4 | **Content protection** (`CONTENT_PROTECTION.md`, `lib/protected-playback.ts`) | AES-128 encrypted HLS via ffmpeg remux (no re-encode), session-bound keys, no download, moving watermark traceable to an account | Protects paid instructors' videos far better than our signed MP4 links | M |
| 5 | **⌘K search** (`SEARCH.md`) | Command palette over every page the viewer may reach, derived from the navigation | Fast navigation in studio/admin; course search from anywhere | S |
| 6 | **Installable app (PWA)** (`PWA.md`, `public/sw.js`, `lib/pwa.ts`) | Home-screen app, offline shell, install page per device | Mobile learning without app stores | S–M |
| 7 | **Question reports** (`TRAINING.md` §13) | Learners flag a wrong or unclear quiz question; quality report for authors | Better course quality; instructors fix issues | S |
| 8 | **Support Center** (`SUPPORT.md`) | In-app tickets with browser context; staff queue | Students and instructors get help inside the product | M |
| 9 | **Live events / webinars** (`EVENTS.md`) | Classes and webinars with registration | Instructor live Q&A, office hours, launches | M |
| 10 | **Platform Academy** + **video-academy engine** (`LEARNING_CENTER.md`, `video-academy/`) | Help videos on using the platform, produced automatically (narrated MP4, cover, captions, deck, QA report) from short specs | "How to use DEL" for students and instructors; the engine is product-independent (`brands/<name>/`) | M |
| 11 | **Agreements** (`AGREEMENTS.md`) | Terms/AI-disclosure acceptance recorded per version | Legal record for terms and AI-generated content | S |
| 12 | **Email deliverability** (`EMAIL.md`) | Templates, SPF/DKIM/DMARC checklist | Receipts and payout mails stay out of spam | S |
| 13 | Notifications centre, announcements, onboarding, achievements, passkeys, playback speed memory, offline study | Smaller engagement and convenience features | Useful later | S each |

**Not relevant** (insurance or team-specific): licenses, recruitment, organizations/teams, coaching, birthdays, QR codes,
banners, team export, geo access, contacts, policy notes.

## Recommendation
Start with **2 Read aloud, 5 ⌘K search, 7 Question reports** (small, visible, low risk), then **4 Content protection**
(protects revenue), then **1 AI Tutor** (largest value; needs the owner's AI provider/key decision), then **3 Practice**,
**6 PWA**, **8 Support**. Each as its own branch with rollback tag, tests and dark-mode browser QA (AGENTS.md rules 15–16).
