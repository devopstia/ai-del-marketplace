# AI learning: search inside videos, course assistant, study notes (2026-11-27)

AGENTS.md rule 3 ("AI learning assistant grounded in course content, AI video search to the exact moment, AI study
materials"). Code: `apps/api/src/study/`, `apps/api/src/worker/caption-backfill.ts`,
`apps/web/src/components/learn/{VideoSearchPanel,AskPanel,StudyNotesPanel}.tsx`, the tabs in `LearnPlayer.tsx`.
Migration `20261127030000_ai_learning`. Endpoints: `docs/API.md` › AI learning.

## 1. Search inside videos (no AI, always on)

- **Index.** A lesson video's WebVTT captions (`video_assets.captionsKey`, the same file the CC button shows) are parsed
  (`study/vtt.ts`: tags, NOTE/STYLE blocks and repeated roll-up lines removed) and consecutive cues merged into
  passages of about 15 seconds (`caption_segments`: video, seq, start/end seconds, text). Postgres keeps a stored
  `tsvector` (English stemming) of each passage with a GIN index. `caption_indexes` records the caption file's key,
  ETag and SHA-256, so an unchanged file is never re-indexed.
- **When.** The worker indexes everything new or changed on start and every 10 minutes (an ETag check per caption
  file); the API also indexes a course's not-yet-indexed captions right before the first search, so results never
  depend on timing (seeded or imported captions work immediately).
- **Search.** `GET /me/courses/:slug/search?q=` for people with access (active enrolment per `hasAccess`, the course
  owner, admins; checked in `StudyService`). Every word must match, the last one as a prefix ("kube" finds
  "Kubernetes"); stemming finds "restoring releases" in "restore the previous release". Words full-text search drops
  fall back to a plain substring match. Max 30 results, 60 searches a minute per client.
- **Player.** Tab **Search videos** (only when the course has captioned videos). Each result shows the matching words
  highlighted, the lesson and the time; clicking plays that lesson from that moment. Results appear only for what the
  learner typed: there is no transcript panel and captions stay off (rule 11).

## 2. Course assistant: "Ask" (needs `ANTHROPIC_API_KEY`)

1. The learner asks in the **Ask** tab of the player (3–500 characters). The browser keeps the conversation (last 2
   questions and answers are sent along for follow-ups); the server stores no question or answer.
2. Retrieval (`StudyService.retrieve`): an OR full-text query over this course's passages only, the 8 best hits plus
   one neighbouring passage each side (hits in the current lesson count 1.5×), joined into passages and capped at
   8 passages / 7,000 characters. The course's lesson list (section, title, length, one-line summary) is always included.
3. If no passage matched and no lesson title or summary shares a word with the question, the answer is a fixed
   "not covered in this course" text: **the model isn't called**.
4. Otherwise Claude answers with structured output `{ covered, answer }`. The prompt (`study/prompts.ts`) says: use
   only the material given, cite every statement `[S2]` (passage) or `[L4]` (lesson), say "not covered" rather than
   guess, send payments/refunds/access/account/other-course questions to Help or DEL support, ≤ ~180 words.
   The server keeps only citations that point at material it actually sent; the browser turns them into buttons
   that play the lesson from the cited second.
5. **Prompt injection.** Transcripts, titles, summaries and the question are wrapped in tags as data; every `<` and `>`
   inside them is replaced (‹ ›) so text can't close its tag, and the system prompt says instructions inside the data
   are ignored. The model has no tools and sees no other course, user or secret, so a successful injection could at
   worst change the wording of that one answer.
6. **Limits** (`study/limits.ts`, counted from `ai_usage`, the request is recorded before counting so parallel requests
   can't slip through): 5 questions a minute and 30 a day per learner, 500 a day for the whole platform (a cost
   ceiling); `429 rate_limited` with a friendly message. `max_tokens` 4,000 per answer, effort `low`.
7. A model refusal gives a polite "can't help with that here"; an API failure gives `503 assistant_unavailable`.

## 3. Study notes (needs `ANTHROPIC_API_KEY`)

- Tab **Study notes** on video lessons with captions, labelled "AI-generated from the lesson transcript": a summary,
  3–7 key points and 3–5 self-check questions (answer behind "Show answer", "Watch from m:ss").
- Generated **once per video and caption version** (`study_notes`, keyed by video, `contentHash` = the caption file's
  SHA-256) the first time anyone opens the tab, in the worker (`study-notes` job on the media queue; the tab polls),
  and shared by every learner. New captions → new hash → regenerated on the next open (the worker scan also
  regenerates notes someone already opened). Transcripts under ~40 words get no notes. 3 attempts, then "couldn't be
  prepared". Effort `medium`, `max_tokens` 8,000, transcript capped at 60,000 characters (the prompt says when the end
  is missing).
- Instructors: `GET /instructor/lectures/:id/study-notes` and `POST …/regenerate` (own lessons, or admins; audited).
  **No studio button yet**: the API is ready, the studio screen is a later small front-end step (rule 12).

## 4. Settings (`.env`, passed to api and worker by docker-compose)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | empty | Without it the Ask and Study notes tabs don't exist and their endpoints return 404. Search works regardless. |
| `LEARNING_AI_ENABLED` | `true` | `false` hides the assistant and notes even with a key. |
| `LEARNING_AI_MODEL` | `claude-opus-5-5` | Study notes (and questions, unless the next one is set). |
| `LEARNING_AI_ASK_MODEL` | empty | Model for "Ask" (high volume). Empty = `LEARNING_AI_MODEL`. See costs. |
| `LEARNING_AI_PER_MINUTE` / `LEARNING_AI_PER_DAY` | 5 / 30 | Questions per learner. |
| `LEARNING_AI_PLATFORM_PER_DAY` | 500 | Questions per UTC day for everyone together. |

Production: add the variables to SSM like `REFUND_AI_MODEL` (owner's decision to enable; nothing is on until a key exists).
All calls go through `study/ai-client.ts` (official `@anthropic-ai/sdk`, streaming with `finalMessage()`, 90 s timeout,
1 retry). Opus 5.x and Sonnet 5.5 requests carry the server-side refusal fallback (`fallbacks: 'default'`); other models
run without it. The system prompt and lesson list come first and are marked for prompt caching, so follow-up questions in
the same course reuse them (only when that prefix is long enough for the model's minimum cacheable size; small courses
simply don't cache).

## 5. Costs (estimates, list prices 2026-11)

Per question: ~3,000 input tokens (rules ~450, lesson list ~1,000 for a 30-lesson course, passages ~1,000–1,750,
history) and ~500 output tokens (answer ≤ ~250 plus a little thinking at effort low).

| Model for "Ask" | $ in / out per M tokens | Per question | Per 1,000 questions |
|---|---|---|---|
| `claude-opus-5-5` (default) | 4 / 20 | ~$0.022 | **~$22** (worst case with long material ~$40) |
| `claude-sonnet-5-5` | 2 / 10 | ~$0.011 | ~$11 |
| `claude-haiku-5-5` | 0.10 / 0.50 | ~$0.0006 | ~$0.55 |

Study notes with `claude-opus-5-5`: ~4,000 input + ~2,400 output tokens for a 15-minute lesson ≈ **$0.06 per lesson,
once** (100 lessons ≈ $6). The platform cap of 500 questions a day bounds the assistant at ≈ $11/day on Opus 5.5
(≈ $0.30 on Haiku 5.5). Questions that match nothing cost nothing (no model call). Real usage per request (tokens,
cache reads/writes, model) is in `ai_usage` for checking these numbers.

Recommendation for the owner: keep Opus 5.5 for notes (rare, quality matters) and decide whether "Ask" should run on
Haiku 5.5 or Sonnet 5.5 (`LEARNING_AI_ASK_MODEL`) after trying a few questions; answers are short and fully grounded
in retrieved text, which suits a smaller model.

## 6. Privacy

- Sent to Anthropic (Claude API): the course title, lesson titles/summaries, matching transcript passages, the
  learner's question and their last two exchanges in that tab; for notes, the lesson title and transcript. **Never**
  names, emails, account, payment or progress data.
- Stored by us: `ai_usage` rows (user id, course/lesson id, model, status, token counts, number of passages, time) for
  rate limits, cost and audit; never the question, the answer or the transcript. The conversation exists only in the
  browser tab and is gone when the tab closes (a refresh clears it too). Study notes are course content, shared.
- No secret is logged: errors are logged as a short reason (`rate limited by the API`, `API error 500`), never the
  request, the key or the learner's text.

## 7. Tests

Unit (`apps/api/src/study/*.spec.ts`, fake Anthropic client, the real API is never called): WebVTT parsing and
passage merging, query building (no tsquery operators get through), ranking and passage budget, highlighting,
prompt building (outline cached, passages and question last, injection can't close tags, history alternation),
citation parsing (unknown ids dropped), "not covered" without a model call, refusals and API errors, rate limits,
the index builder (unchanged file skipped, changed file rebuilt, removed captions cleared, ETag scan).
API e2e (`test/app.e2e-spec.ts`, "search inside videos…"): real Postgres full-text search, access (401 signed out,
403 not enrolled or expired, owner allowed), re-index on new captions, AI endpoints 404 and flags off without a key.
Playwright (`apps/web/e2e/video-search.spec.ts`): the demo student searches "WebVTT", clicks the result, the player
plays that lesson from that second, captions still off.

## 8. Rollback

Unset `ANTHROPIC_API_KEY` (or `LEARNING_AI_ENABLED=false`) to remove the assistant and notes at once. Search has no
switch: it only reads captions. The migration only adds tables; dropping them doesn't touch existing data.
