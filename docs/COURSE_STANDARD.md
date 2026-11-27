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
Vocabulary lessons go just before the lessons that use the words. Quizzes ("Check your understanding") follow
their lesson.

## 7. How the agents work together
| Course Generation Agent | Course Upload and Publishing Agent |
|---|---|
| curriculum, videos, PDF slides (always a PDF next to any PowerPoint), labs as ZIP, quiz questions, transcripts (SRT), lesson metadata, intro video, its own content QA | watches the course folders, studies the content, organises modules and lessons, writes the course page, picks the cover, sets previews, uploads, keeps the order, validates the student experience, maintains published courses, reports missing content and quality issues |

They talk through files:
- **`course.manifest.json`** in each course folder, written by the generation agent: course structure, per lesson
  title, description, objectives, prerequisites, role (`intro|lesson|vocabulary|project|conclusion`),
  recommended position, resource files, quiz. Schema: `courses/manifest.schema.json`. A hint, validated by the upload
  agent against the content; `courses/<slug>/plan.json` (the upload agent's) is the source of truth.
- **`courses/GENERATION_FEEDBACK.md`**: the upload agent's findings for the generation agent (missing labs, gaps,
  topics the owner wants but the course lacks), newest first.
- **`courses/LESSONS_LEARNED.md`**: what the upload agent learned, read before every upload.

## 8. Updating courses
- New content is **inserted where it belongs**, not appended: the upload agent decides the module and position.
- Existing lessons keep their ids (never deleted and recreated), so enrolments, progress, completed lessons, quiz
  results, access and purchases are preserved. A published course changes through its draft revision and a super
  admin approves it in the Review queue.
- After significant new content: review the description, objectives, curriculum, total duration and course page.

## 9. Before students see it: three reviews
- **Instructor:** sound, logically ordered, accurate, practical; every promise ("download the lab") kept.
- **Student:** easy to navigate, every video plays, Next/Previous, downloads open, captions only on CC, quizzes work,
  on phone/tablet/desktop, light and dark.
- **Prospective customer:** the course page says clearly what you get and why to enrol; previews play; price right.
Record what was actually checked. A course that fails any of the three is not submitted.

## 10. Safety rules (unchanged)
Staging first, then production only when the owner allows it (`courses/publisher.config.json`). Agent keys only
(scoped, expiring, owner-issued; kept in the session scratchpad, never in chat, repo or files that are kept). Never
upload PowerPoint, thumbnails, raw files or secrets. Never live payments, never another account's courses, never delete
content without the owner. Prices are the owner's decision.
