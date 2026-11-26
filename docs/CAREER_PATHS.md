# Career paths (owner 2026-11-26, idea 4)

A career path is a goal such as "DevOps engineer": marketplace courses in the order to take them, the skills each one
gives, and a note per step. Students follow a path to get a weekly plan, an estimated finish date and a skill map. A path
sells nothing itself: every course is bought on its own through the normal checkout. The last step of every path points to
the full DEL program on devopseasylearning.com (enrolment only there, AGENTS rule 27).

Code: API `apps/api/src/paths/` (`plan.ts` = the pure weekly plan and skill map, `paths.service.ts`, `paths.controller.ts`),
migration `20261127070000_career_paths` (`career_paths`, `career_path_steps`, `career_path_follows`). Web: public
`app/(site)/paths` (list and path page), `components/paths/` (`FollowPath`, `PathsBand`), Student Studio
`app/student/paths`, admin `app/admin/paths` (list and editor), `lib/paths.ts` (types), `lib/paths-server.ts`.
Endpoints: docs/API.md › Career paths. Tests: `src/paths/plan.spec.ts` (unit), `test/paths.e2e-spec.ts` (e2e).

## Who does what
- **Super admins** create, edit, publish, unpublish and delete paths (Admin › Marketplace › Career paths). Every change
  is audited (`career_path.created|updated|published|unpublished|deleted`). Admins with `content.manage` can look.
- Publishing needs a summary and at least **2 courses, all published**. A published path can't be saved into a state it
  couldn't be published in. Only drafts can be deleted (unpublish first).
- If a course in a published path is later unpublished, it disappears from the public path and from plans until it is
  published again.
- **Students** follow a published path from its page (guests are sent to sign in and back), choose the hours a week
  they can study (1–40; 5 by default), change it or stop following in Student Studio › Career paths. Course progress
  is never touched.
- No invented paths. The local/staging seed adds one **draft** "Demo: DevOps engineer" from the demo courses; it is
  never public by itself, and the seed refuses to run on production.

## Where paths appear (only while at least one is published; AGENTS rule 4)
- `/paths` and `/paths/<slug>` (server-rendered; title, description, canonical link; the path page has `ItemList`
  JSON-LD of its courses). Without a published path `/paths` is a 404.
- Footer › Learn › Career paths; a line on `/courses` ("Not sure where to start? See career paths"); a homepage band
  before the full-program band (up to three paths).
- Student Studio menu › Learning › Career paths (published paths exist or the student follows one).
- **Not in the top menu** (owner rule: keep the header as approved). Adding it there is the owner's call.
- **Sitemap**: add `/paths` and each `/paths/<slug>` (`GET /api/paths`) to the sitemap when it exists.

## The plan (real data only; `plan.ts`)
- Time left in a lesson = its length minus the **unique seconds already watched** (the same merged playback ranges as
  the refund rule); a completed lesson counts zero. A lesson without a length: articles at 200 words a minute, quizzes at
  30 seconds a question (at least a minute each).
- **This week** = the next unfinished lessons in path order (course order, then section and lesson order) until the
  week's hours are used, always at least one, at most 12. It stops at the first course the student doesn't own
  (`blockedBy`: "the path continues with …", link to the course); expired access counts as not owned.
- **Estimated finish** = today + time left ÷ (hours a week ÷ 7), rounded up to whole days; **weeks** = time left ÷ hours a
  week, rounded up. Courses not bought yet are included, so the date is the whole path.
- **Skill map**: a skill is *done* when a course that gives it is complete (every lesson completed), *in progress* when
  such a course is started, otherwise *still needed*; a skill given by several courses takes the best state.
- Remaining price = current prices (sales and promotions included) of the courses the student doesn't own.
