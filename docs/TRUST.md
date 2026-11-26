# Reviews you can believe and verified certificates (owner 2026-11-26, stand-out ideas 2 and 8)

## Watched share on every review
Every review shows how much of the course its author really watched, wherever reviews are listed: the course page,
Student Studio › Reviews, Instructor Studio › Reviews and Admin › Course reviews.

- **Measure:** unique seconds of video played (`lecture_progress.watchedSec`, from merged playback ranges), capped per
  lesson and divided by the course's current video length, one decimal. It is the same measure the refund rule uses
  (`access/consumption.ts`), so a review and a refund decision never disagree. Never estimated.
- **Live, not a snapshot:** computed when reviews are listed, for the whole page in two queries (`reviewerWatch`),
  never per review. A reviewer who keeps watching after reviewing shows the new figure. No migration.
- **Wording** (`components/WatchedBadge.tsx`): "Completed the course" when every lesson is marked done; otherwise
  "Watched 82 % of the course" (rounded down, so 99.6 % never reads as everything), "Watched less than 1 % of the
  course", or "Hasn't watched the videos yet". Nothing is shown for a course without video.
- Honest low ratings stay (AGENTS rule 26); the watched share is shown for every rating, high or low.
- The API returns `watchedPercent` (number or null) and `completed` (boolean); reviewer user ids are not exposed.
- Not done: a "most watched" sort (needs a stored value to paginate; not worth a snapshot column yet).

## Verified certificate page
`/certificates/<code>` (API `GET /certificates/:code`) is open to anyone with the link.

- Shows: learner's name, course, instructor, issue date, certificate code, course length and lessons, quizzes passed
  (best attempt per quiz, pass mark 70 %, the same as the quiz endpoint) and the course's "What you'll learn" list as
  the skills it covered. Nothing else about the learner (no email, no account details).
- **Add to LinkedIn** opens LinkedIn's add-certification form filled in (course title, DevOps Easy Learning, issue
  year and month, certificate id and link); the learner confirms on LinkedIn. **Copy link** copies the public link.
- **Link preview:** Open Graph and X card tags, and a 1200×630 image (`opengraph-image.tsx`, DEL dark style) with the
  learner's name, course, issue month and code, so the shared link shows the certificate.
- **Not in search engines:** the page sends `noindex, nofollow` (a learner's name is personal data). Don't block
  `/certificates/` in robots.txt, or crawlers can't see the noindex; LinkedIn and WhatsApp still read the preview.
- The "View the course" button only appears while the course is published.
- Not done: revoking a certificate (there is no revoked state yet; every issued certificate is valid) and an
  opt-in public skill profile (idea 9).
