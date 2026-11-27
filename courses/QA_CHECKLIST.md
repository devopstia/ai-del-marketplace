# Course QA checklist (permanent, every course, every update)

A course is not complete because its videos are uploaded. Tick every line (or write why it doesn't apply) in the
course's report before saying "done", submitting for review, or closing a content request. Standard:
`docs/COURSE_STANDARD.md`; how things work: `docs/COURSE_PLATFORM_REFERENCE.md`.

## Content (as an instructor)
- [ ] Every lesson studied from its captions, slides and lab; titles and summaries match what the video does.
- [ ] Learning order makes sense; vocabulary before use; prerequisites before the lessons that need them.
- [ ] Intro first (or its slot reserved and a request open); conclusion last (or requested).
- [ ] Gaps checked (standard §7): fundamentals, demos, real-world use cases, troubleshooting, best practices, advanced
      topics, assessments. Each justified gap is a request in `CONTENT_REQUESTS.md` with the full brief (template there).
- [ ] Nothing claims a topic no video teaches.

## Materials (per lesson, against the source folder)
- [ ] Video processed and plays; captions uploaded (off until CC).
- [ ] Slides PDF attached ("Slides (PDF)"); never a PowerPoint.
- [ ] Lab ZIP attached ("Hands-on lab (ZIP)") where the lesson is hands-on; scanned for secrets first.
- [ ] Quiz after the lesson ("Quiz: …"); module assessment and final assessment where delivered.
- [ ] Missing material → a request, never skipped silently.

## Course page (as a prospective student; standard §3a)
- [ ] Title, subtitle, objectives, requirements, description written to §3a; no banned phrases; no repetition between parts.
- [ ] Two free previews: the intro (or overview) and the most convincing hands-on demo; they play signed out.
- [ ] Introduction video meets standard §4a: scored ≥ 90/100 in `courses/INTRO_VIDEOS.md`, covers the current curriculum, plays signed out as the first preview with the enrol / start-free action.
- [ ] Cover from a matching template; readable; nothing covers its title.
- [ ] Price right (owner's decision); category right.

## Student experience (in a real browser)
- [ ] As an enrolled student: play the first seconds of every video; Previous/Next; full screen; autoplay to the next lesson.
- [ ] Open "Files for this lesson" under a video and download one PDF and one ZIP per module; they open and hold the right files.
- [ ] Take one quiz; answers and explanations show; progress updates.
- [ ] 390, 768, 1440 and 1920 px; light and dark; `node scripts/qa-dark.mjs` passes on the course page.
- [ ] Certificate: finish the course as a test student (staging); the certificate appears by itself; download the PDF
      (one page) and PNG; scan the QR with a phone and see "Valid" (docs/CERTIFICATES.md).
- [ ] Nothing broken elsewhere: home, catalogue, cart, checkout page load.

## Close-out
- [ ] Report written (`reports/<env>-*.md`) with what was actually checked.
- [ ] `COURSE_STATUS.md`, request statuses, `LESSONS_LEARNED.md`, `HANDOVER.md` "Now" updated; committed.
- [ ] Sessions signed out, scratchpad credentials deleted.
