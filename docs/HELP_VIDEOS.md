# Help videos and the video engine (feature 10, owner 2026-11-25)

Short "how to use DEL" videos for students and instructors, recorded on the real site, narrated, captioned and published
to **/help**. Adapted from the Insurance Knowledge Hub's Platform Academy and its `video-academy/` engine.

## On the site
- **/help** (public): videos by topic (Getting started, Learning on DEL, Buying and payments, Teaching on DEL, Your
  account and help), filter *All / For students / For instructors*. Links: footer, Help and support page.
- **/help/<address>**: the player (captions off until the viewer turns them on, rule 11), chapters you can jump to,
  Up next, and *Still need help?* → a support request with the matching topic.
- **Admin › Help videos**: every video with its status (Processing, Draft, Published, Video failed), Preview, Publish /
  Unpublish, Edit, Delete, and **New video** (upload MP4, optional .vtt/.srt captions and cover). Uploads use the
  studio's video pipeline; every change is in the audit log (`help.*`).
- API: `GET /api/help/videos`, `GET /api/help/videos/:slug` (public; 1-hour signed link), admin routes under
  `/api/admin/help/…` (docs/API.md). Code: `apps/api/src/help/`, `apps/web/src/app/(site)/help/`, `app/admin/help/`.

## The engine (`video-academy/`)
Turns a short JavaScript script per video into: a narrated 1080p MP4 recorded from the running local site (dark, the
site's default), a cover, SRT captions, a slide deck (PPTX + PDF) and a QA report (Whisper transcript vs. script, loudness).
- `cli.mjs` stages: script → voice (Kokoro, voice `af_heart`) → record (Playwright, visible cursor and highlights) →
  cover → assemble (ffmpeg) → deck → qa. `node cli.mjs list | build <id…> [--from stage] [--only s02] | inventory`.
- `brands/del/`: DEL colours (the dark tokens), logo, fonts, demo accounts, categories (`brand.mjs`) and the plan of
  every help video (`plan.mjs`). `tutorials/<id>.mjs`: one script per video. `engine/`: generic recorder, slides, media.
- `tools/publish-help.mjs [id…] [--publish] [--dry-run]`: uploads built videos with captions, cover and chapters to the
  **local** site as drafts (or published). Signs in as the local admin with `SEED_PASSWORD` from `.env`, read at run time.
- Output: `~/work/videos/del-help/<NN-topic>/` (`VA_OUT` to change). `.venv/`, `.models`, `.work/` are machine-local.
- Setup once: `cd video-academy && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`; the Kokoro
  model files go in `.models/` (`kokoro-v1.0.onnx`, `voices-v1.0.bin`). The local stack must be running.
- Rules: fictional demo accounts only (`@del.example`, `@instructor.example`); a script that creates records removes
  them (`setup`/`cleanup`); leftover test data is hidden in recordings; **never publish to production, push or deploy
  without the owner's approval**. Production publishing uses the owner's admin account at that time.

## The voice
An AI voice (Kokoro, offline, no cost, no account). Each line is checked by Whisper; mismatches are listed by the
`voice` and `qa` stages. Pronunciations live in `brand.voice.say` (for example DEL → "D E L").
