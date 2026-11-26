# Content protection (feature 4, owner 2026-11-25)

Adapted from the Insurance Knowledge Hub (`docs/CONTENT_PROTECTION.md` there), rewritten for NestJS. Code:
`apps/api/src/protection/`, `apps/api/src/worker/video.processor.ts` (`package-hls` job), `hls-backfill.ts`,
`apps/web/src/components/VideoPlayer.tsx`, `apps/web/src/app/admin/protection/`.

Delivery through CloudFront and adaptive qualities (720p/480p): docs/VIDEO_DELIVERY.md.

## What happens
1. **Packaging (worker).** When a local video becomes ready, and on every worker start for any ready video not yet packaged,
   the `package-hls` job runs ffmpeg **without re-encoding** (`-c copy`, H.264 + AAC/MP3) into ~4 s MPEG-TS segments.
   Each segment is encrypted in Node with AES-128-CBC (HLS `METHOD=AES-128`): one random key and IV per video; the key
   never touches disk. Segments go to `hls/<32 random hex>/seg_00000.ts`. The playlist is stored on `video_assets` with
   placeholders; the key is stored only wrapped (AES-256-GCM, key derived from `SESSION_SECRET`). The original stays
   private and unchanged. Other codecs are marked `unsupported` (set `HLS_REENCODE=true` to re-encode them, also to 2 s
   keyframes for a faster start). 3 attempts per job; the backfill retries failed ones up to 6 times.
2. **Playback.** `POST /api/lectures/:id/playback` for someone with access (enrolled, the course's instructor, admin)
   creates a **playback session** (6 h, user, video, lecture, IP, browser) and returns
   `{ format: 'hls', protected: true, url: /api/playback/<session>/index.m3u8 }`.
   - `GET /api/playback/:sid/index.m3u8` and `/key` answer only the signed-in owner of a live session (others: 404,
     signed out: 401), `Cache-Control: no-store`. Segment URLs are 6-hour signed storage links; the storage prefix and
     the original file never reach the browser.
   - **Fallback:** free previews, and any video not packaged yet, keep the 5-minute signed MP4 (nothing stops playing).
3. **Player.** hls.js sends the session cookie only to our API (never to storage); Safari falls back to native HLS.
   No download control, no context menu, no picture-in-picture or casting on protected video. **No watermark or
   letters on the video** (owner, 2026-11-25: "I do not want the … random letters on the videos"). Captions start off (rule 11); the learner's choice is remembered.
4. **Admin › Video protection.** Packaging counts.

## What it does and doesn't stop (honest)
Stops: right-click/save, download buttons and extensions that grab an MP4, sharing a link (sessions are tied to the
account and expire), reading files from storage. Does **not** stop screen recording; nothing in a browser can, and
without a watermark such a recording can't be traced (the owner's choice). Real DRM (Widevine/FairPlay) needs a licence service and is a later option
(Mux supports it; see the Hub doc §6).

## Settings (`.env`)
`PROTECTED_PLAYBACK=true` (false = signed MP4 for everyone, no repackaging needed to switch back),
`HLS_SEGMENT_SECONDS=4`, `HLS_REENCODE=false`. **Production S3** must allow `GET` with CORS from the web origin
(hls.js fetches segments with XHR); MinIO allows it by default.

## Rollback
Set `PROTECTED_PLAYBACK=false` and restart api + worker. Code: tag `checkpoint-2026-11-25-content-protection`.
