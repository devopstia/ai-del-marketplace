# DevOps Easy Learning: Course Creation and Publishing Standard

Owner, 2026-11-26. **The authority for every agent in the course lifecycle**: the Course Generation Agent (makes the
videos, slides, labs, quizzes, transcripts), the Course Upload and Publishing Agent (`del-course-publisher`) and any
instructor agent (`del-course-agent`). Applies to every DevOps Easy Learning course, now and later. Agents read this
before working on a course and improve it (with the lessons learned) when a course teaches them something.

## 1. Think like an instructor
The job is a learning experience that attracts students and builds practical skills, not a folder of videos.
For every course and every lesson ask:
- What must the student learn first? What do they need to know before the next lesson?
- How does this lesson serve the course objectives?
- Are the explanations and labs right for the audience (level)?
- What makes the course valuable and worth buying? What can a student do after it?

## 2. Study every lesson before placing it
Read the captions/transcript (start, end, the in-video questions, the promises: "download the lab…"), the slides
(page count, a look at the pages), every lab README and its files, and the video itself (duration, format; ffprobe).
Never rely only on file names or on what the generation agent wrote: the manifest (§7) is a hint, checked against
the content. From that decide: lesson title, description, objectives, prerequisites, module, position, slides, lab,
quiz questions, and the real skills and tools covered. **If a lesson can't be reviewed** (no captions, unreadable
video, missing slides), report it and ask for the material; never guess.

## 3. Course presentation (what a prospective student sees)
Every course has, written from the content, specific and honest:
| Field | Where |
|---|---|
| Title, subtitle (one sentence of value) | course fields |
| Description (markdown) with: what you'll build (the real projects), who it's for, tools and technologies, how it's organised, prerequisites, what you can do afterwards | `description` |
| Learning objectives (skills, each ≤ 200 chars, starting with a verb) | `objectives` |
| Requirements / prerequisites | `requirements` |
| Level, language, category | course fields |
| Cover | a platform cover template (AGENTS.md rule 17), never a video frame |
| Curriculum: modules and lesson titles that are descriptive, consistent, professional | sections / lessons |
| FAQ | the platform FAQ on the course page (access, refunds, certificate); course-specific answers go in the description |

### 3a. Presentation quality (owner 2026-11-27, permanent)
Write like a senior instructor and a course marketer, for a busy engineer deciding in 30 seconds. A visitor must see
at once: what the course is, why it is worth it, what they will be able to do, which real problems they will solve
(and, for AI courses, what AI really adds), and why this course rather than another.

**How the course page reads** (top to bottom; write each part for its place, never repeat one in another):
| Part | Rules |
|---|---|
| Title | ≤ 60 characters, the outcome and the main tool; no codes, no hype words |
| Subtitle | one sentence (≤ 200), the concrete value; no list of every tool |
| What you'll learn (objectives) | 6–10 outcomes, each starting with a verb, specific (a reader can picture it), ≤ 200 characters |
| Course content | modules named by what the learner achieves, short and parallel; lesson titles descriptive (≤ ~70), the same style throughout; quizzes named "Quiz: …" or "Quiz", never long |
| Lesson summaries | ≤ 300: what you do in the video and what you walk away with |
| Requirements | short, real (from the labs): tools, accounts, hardware; marks optional ones |
| About this course (description) | hook (2–3 lines: the problem, the promise) → **What you'll build** (5–7 bullets, bold outcome first) → **Why this course** (3–4 true differentiators) → **Who it's for**. No prerequisites or objectives again, no full curriculum again |
| Free previews | the intro + the most convincing hands-on demo (chosen from the captions: clear result, good pace) |
| Cover | a platform template whose motif matches the topic (rule 17) |

**Style:** short paragraphs (≤ 3 lines), plain words, active voice, the learner as "you", numbers and concrete
examples over adjectives. Never: "unlock", "supercharge", "dive into", "seamless", "leverage", "game-changer",
"in today's fast-paced world", "comprehensive guide", emoji, ALL CAPS, exclamation marks, chains of dashes. Honest:
every claim is something a video shows; no future lessons, no "master", "expert" or job promises.

**Formatting:** the description is Markdown rendered by `components/Markdown.tsx`: `##` headings, `-` and `1.` lists,
`**bold**`; no tables or HTML. After any change, open the course page in a browser at 390, 1440 and 1920 px in light
and dark: headings render (no stray `##`), nothing overlaps the cover, no empty or cluttered regions, the price,
previews and curriculum read well. Fix and look again before reporting.

No generic filler, no exaggeration, nothing the videos don't teach. If the owner wants a topic the content doesn't
cover (e.g. more AI), say so, describe only what exists, and send the gap to the generation agent (§7).

## 4. Introduction video
- Every course starts with an introduction: what the course is, why it matters, what you'll learn, who it's for,
  prerequisites, tools, projects, how it's organised, what you can do afterwards.
- Until it exists the first position is **reserved without an empty lesson** (no broken or placeholder lessons are
  ever visible to students). The generation agent names it `00-intro-<slug>/` (or the manifest says `"role": "intro"`);
  the upload agent detects it, reviews it, uploads it, puts it first in the first module, marks it as a free preview
  and may use it as the course promo video.

## 5. Free previews
- At least **two** free preview videos on the course page: the introduction plus the best practical demonstration
  (chosen for teaching value and presentation quality). Until the intro exists: the overview lesson plus the best demo.
- Use the platform's Free Preview (`isPreview`; visitors play it from the curriculum). Everything else, and every
  paid download, stays protected by the API.

## 6. Organisation
Modules, not a long list. Adapt this progression to the content: introduction and overview → fundamentals →
environment setup → core tools → guided demonstrations → intermediate implementations → advanced concepts →
real-world projects → troubleshooting and best practices → final assessment and conclusion.
Vocabulary lessons go just before the lessons that use the words. Quizzes ("Quiz: <short lesson name>") follow
their lesson.

## 7. How the agents work together
| Course Generation Agent | Course Upload and Publishing Agent |
|---|---|
| curriculum, videos, PDF slides (always a PDF next to any PowerPoint), labs as ZIP, quiz questions, transcripts (SRT), lesson metadata, intro video, its own content QA | watches the course folders, studies the content, organises modules and lessons, writes the course page, picks the cover, sets previews, uploads, keeps the order, validates the student experience, maintains published courses, reports missing content and quality issues |

They talk through files in `courses/` (owner 2026-11-27: no agreement may live only in a chat or a context window):
| File | What | Who writes |
|---|---|---|
| `AGENTS.md` (repo root) | responsibilities and rules for every agent | either, with the owner's rules |
| `courses/HANDOVER.md` | how to pick up the work, what's happening now | whoever stops working |
| `courses/COURSE_STATUS.md` | each course: ids, URLs, status, price, content counts, what's waiting | UPLOAD after every sync |
| `courses/CONTENT_REQUESTS.md` | **the request register**: id, course, module/lesson, request, why, owner, date, priority, status, deliverables, delivered at, upload status, log | UPLOAD opens; GEN updates its status |
| `courses/LESSONS_LEARNED.md` | what each agent learned, newest first | both |
| `course.manifest.json` (in each course folder) | the generation agent's course structure and lesson metadata (schema `courses/manifest.schema.json`); a hint, validated by UPLOAD | GEN |
| `courses/<slug>/plan.json` | the upload agent's source of truth for the course page and curriculum | UPLOAD |

**Request lifecycle:** requested → in-progress → generated → ready-for-review → validated → uploaded → verified → completed
(or declined with a reason). The register is updated first; then a short message (Claude Code `SendMessage`) names the
request ids. When GEN marks a request `ready-for-review`, UPLOAD reviews, uploads, verifies and closes it.

**Find gaps proactively.** UPLOAD doesn't just upload what exists: after studying a course it checks for a missing intro,
fundamentals, prerequisite lessons, demonstrations, advanced topics, real-world use cases, slides, labs, source code,
transcripts, quizzes and assessments, troubleshooting, best practices and a conclusion, and opens a request for each gap
it can justify (what, why, where it fits).

## 8. Updating courses
- New content is **inserted where it belongs**, not appended: the upload agent decides the module and position.
- Existing lessons keep their ids (never deleted and recreated), so enrolments, progress, completed lessons, quiz
  results, access and purchases are preserved. A published course changes through its draft revision and a super
  admin approves it in the Review queue.
- After significant new content: review the description, objectives, curriculum, total duration and course page.

## 8a. Assessments (owner 2026-11-27, standard for every course)
- **Lesson quizzes** after lessons that teach something checkable (3–5 options, the correct one, an explanation);
  imported from the spoken in-video questions or from the manifest, never invented by the upload agent.
- **Module assessment** at the end of each module (8–10 questions over the module), and a **final assessment**
  (about 20 questions) before the conclusion.
- Questions come only from the course's own content. GEN writes them; UPLOAD checks every answer against the captions,
  then uploads them as quiz lessons named "Quiz: …" / "Module <n> assessment" / "Final assessment".
- Missing assessments are a content request (CR) like any other.

## 9. Before students see it: three reviews
- **Instructor:** sound, logically ordered, accurate, practical; every promise ("download the lab") kept.
- **Student:** easy to navigate, every video plays, Next/Previous, downloads open, captions only on CC, quizzes work,
  on phone/tablet/desktop, light and dark.
- **Prospective customer:** the course page says clearly what you get and why to enrol (§3a: the 30-second test);
  previews play; price right; the page looks premium on phone and desktop, light and dark.
Record what was actually checked. A course that fails any of the three is not submitted.

## 10. Safety rules (unchanged)
Staging first, then production only when the owner allows it (`courses/publisher.config.json`). Production uploads use
the owner's own sign-in (`scripts/del-signin.sh`, session mode; no agent keys, owner 2026-11-27), staging may use a
scoped, expiring agent key; sessions and keys live only in the session scratchpad and are removed at the end. The exact
production steps: `.claude/skills/del-course-publisher/SKILL.md` › "Production upload: how it works". Never
upload PowerPoint, thumbnails, raw files or secrets. Never live payments, never another account's courses, never delete
content without the owner. Prices are the owner's decision.
