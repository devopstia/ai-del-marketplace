# Social sharing: link previews, banners and share buttons

Owner brief 2026-11-28 ("social media sharing master prompt"). When someone shares the site or a course on WhatsApp,
Facebook, LinkedIn, X, Telegram or by email, the app shows a preview card: an image, a title, a description and the site
name. This document is how DevOps Easy Learning produces those, how to change them, and what to do when an app shows an
old preview.

## 1. What a preview is made of

Every public page renders these tags **on the server** (Next.js metadata, `apps/web/src/lib/seo.ts` › `pageMeta`), so apps
that never run JavaScript read them:

| Tag | Value |
| --- | --- |
| `og:title`, `twitter:title` | Page title (course title on course pages) |
| `og:description`, `twitter:description`, `description` | One plain sentence, at most 160 characters |
| `og:image` + `og:image:secure_url`, `:width` 1200, `:height` 630, `:type`, `:alt`; `twitter:image` + `:alt` | The sharing banner, absolute HTTPS URL |
| `og:url`, `<link rel=canonical>` | The canonical address (`https://ai-devopseasylearning.com/courses/<slug>`) |
| `og:type` | `website` (homepage, catalogue, topics), `article` (course pages) |
| `og:site_name`, `og:locale` | DevOps Easy Learning, en_US |
| `twitter:card`, `twitter:site` | `summary_large_image`, @devopseasylearn |

* **Homepage, /courses, topic pages:** the site title, description and banner from Super Admin › Social Media & Sharing
  (`GET /api/social/site`, cached one minute by the web server).
* **Course pages:** course title, subtitle (or a generated sentence) and the course's own banner. **Only published
  courses** expose a banner. A draft, in-review, unpublished or archived course seen by its instructor or an admin is
  `noindex` and uses the site banner; visitors and crawlers get a 404 for it. No stored banner is ever made for a course
  that is not published.
* **Every other public page** (help, policies, teach, contact…): the site banner at the fixed address `/og/site.jpg`,
  which always serves the current site banner (a JPEG) from the API.

## 2. The banners

Drawn on the server (`apps/api/src/social/`), 1200×630, the DEL font measured with its real metrics so text never runs out
of its column, original artwork only (no AWS, Microsoft, HashiCorp, CNCF or other logos; technology names are written).
Every text and logo stays inside the **safe area** (60 px from the sides, 30 px from top and bottom) and the important part
(DEL mark, headline, button) sits in the left two thirds, so small or cropped previews stay readable. Encoded as JPEG
under 300 KB, or PNG when that is smaller (the site banner is always JPEG).

A banner is a **family** (one of the owner's chosen designs) plus a **topic design** (accent colours, symbol, name):

| Family | Design | Right side (site banner) | Right side (course banner) |
| --- | --- | --- | --- |
| `pro` (**default**) | 3 · Cloud and DevOps professional: light sky-blue, ink headline with a violet second line | Two white panels (default AWS / Azure, editable) | Topic panel (symbol, name, lessons · hours) and a Certificate panel |
| `marketplace` | 4 · Premium learning marketplace: violet, gold last line and button | Three cards: the top published courses (featured first, then newest) and a "Verified certificate" seal | The course as the front card, one or two related published courses behind (then same topic, then top courses), the seal |
| `enterprise` | 1 · Modern enterprise technology: deep ink, blueprint grid, circuits, glow (the night-blueprint covers' family) | Topic chips (editable) and the cyan button | The topic symbol, and 3–5 chips taken from the course's own title, subtitle, objectives or section names (never invented) |

Topic designs (`share-templates.ts`), each available in every family: `ai`, `aws`, `azure`, `terraform`, `kubernetes`,
`devops`, `automation`, `software-dev`, `cybersecurity`, `general`. A course gets the design of its category by default
(`topics` lists in the same file); an instructor or super admin can pick another. Course banners always show the topic
label, the title (a "Title: Subtitle" title is split onto a main line and an accent line), the subtitle when there is
room, **FREE COURSE** when the price is 0, the button ("View course" or "Start free course"), "DevOps Easy Learning" and the
site address. Course cards and chips only ever name **published** courses.

A **custom upload** (super admin for the site; instructor or super admin for a course) replaces the drawn banner: PNG,
JPG or WebP, 1200×630 (or larger with the same 1.91:1 shape), at most 5 MB. It is re-encoded at 1200×630, which drops
EXIF, GPS, colour profiles and comments. A video frame is never used.

## 3. Storage, addresses and caching

* Course: `images/social/<courseId>-<hash>.jpg|png`; site: `images/social/site-<hash>.jpg`; uploads:
  `images/social/upload-<courseId|site>-<hash>.jpg|png` (in the media bucket, like covers).
* Public address on the site: `https://ai-devopseasylearning.com/media/images/social/<file>` (the web app proxies
  `/media/images/*` to the API, same files). No sign-in, no signed URL, no cookies.
* `<hash>` is a hash of **everything drawn** (family, design, title, headline, subtitle, topic, price badge, lessons and
  hours, cards, chips, renderer version). Any change gives a new file name, so the files are served with
  `Cache-Control: public, max-age=31536000, immutable` and **no CDN or proxy invalidation is ever needed**.
* When banners are redrawn: at once when a super admin saves the settings or someone changes a course's banner; within a
  minute for everything else (title, subtitle, price, category, lessons, related courses, featured order: the API checks
  every published course each minute and draws only what changed). After a change to the drawing code bump
  `SHARE_RENDER_VERSION` in `social.service.ts` so every banner is redrawn.
* Old files stay in the bucket (they are small); nothing links to them once a newer one exists.

## 4. Who changes what

| Who | Where | What |
| --- | --- | --- |
| Super Admin | **Super Admin › Platform › Social Media & Sharing** (`/admin/social`) | Default title and description; site banner style and its texts (headline up to three lines, supporting line, button, `pro` panels, `enterprise` chips); a custom site banner upload; the default style for course banners; which topic designs instructors may use; **Restore defaults**. Live previews of all three styles and illustrative WhatsApp, Facebook, LinkedIn and X cards. Takes effect at once, no redeploy. |
| Super Admin | Super Admin › Courses › a course | That course's style, topic design, headline or uploaded banner |
| Instructor | Studio › a course › Media › **Sharing banner** | Their own course: style, topic design, a shorter headline, or an uploaded banner; preview before saving |
| AI agents | `GET/PUT /api/agent/courses/:id/share`, MCP `get_share_banner` / `set_share_banner`, publisher plan `course.share` | Style, topic design, headline (no uploads) |

All changes are audit-logged: `social.settings_updated`, `social.settings_restored`, `social.site_banner_uploaded`,
`social.site_banner_upload_removed`, `course.share_banner_changed`, `course.share_banner_uploaded`,
`course.share_banner_upload_removed`.

API (`apps/api/src/social/social.controller.ts`): public `GET /api/social/site`, `GET /api/social/site-image`; super admin
`GET|PUT /api/admin/social`, `POST /api/admin/social/restore-defaults`, `GET /api/admin/social/preview?family=&draft=`,
`POST|DELETE /api/admin/social/site-upload`, `GET|PUT /api/admin/courses/:id/share`, `GET /api/admin/courses/:id/share-preview`,
`POST|DELETE /api/admin/courses/:id/share-upload`; instructor (own courses) the same under `/api/instructor/courses/:id/…`.
The public course page payload (`GET /api/courses/:slug`) carries `share: { path, width, height, type, alt }` (null unless
published).

## 5. Share buttons

Public course pages show **Share**: WhatsApp, Facebook, LinkedIn, Telegram, X, email, the device's own share sheet (only
where the browser has one) and **Copy link** (`components/ShareButtons.tsx`). They are plain links to each app's share
address with the canonical course URL; the message is "<Course title>, on DevOps Easy Learning: <url>". No platform
script, pixel, cookie or tracker is loaded. The certificate page keeps its own "Add to LinkedIn" and "Copy link".

## 6. Crawlers

Checked for this feature (docs/SEO.md has the indexing rules):

* **Caddy** (`deploy/Caddyfile`): no user-agent or bot rules, no geographic rules; `/api/*` → API, everything else → web.
* **CloudFront** serves only signed lesson video segments; pages and banners do not go through it.
* **Rate limits** apply only to sign-in, registration, contact and similar routes, never to pages or `/media/images/*`.
* **robots.txt** (production) allows `/` (pages, `/media/images/`, `/og/site.jpg`) and `/api/media/images/`. Staging says `Disallow: /` and
  `X-Robots-Tag: noindex`; some preview apps respect that, so **test previews on production**.
* `www.` redirects permanently to the bare domain; canonicals and `og:url` always use the bare domain.

Local check (any of these user agents must get 200 with the tags, and 200 for the image):

```bash
for ua in "WhatsApp/2.23.20.0 A" "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)" "Twitterbot/1.0" "TelegramBot (like TwitterBot)"; do
  curl -s -A "$ua" -o /tmp/p.html -w "%{http_code} $ua\n" https://ai-devopseasylearning.com/courses/<slug>
  grep -o '<meta property="og:image"[^>]*>' /tmp/p.html
done
curl -sI https://ai-devopseasylearning.com/media/images/social/<file>   # 200, image/jpeg, immutable
```

## 7. When an app shows an old or missing preview

Apps keep their own copy of a link's preview, often for days or weeks. Our banner addresses change with every change, but
the app has cached the **page**; ask it to read the page again:

* **Facebook (and Instagram, Messenger):** Sharing Debugger, https://developers.facebook.com/tools/debug/ — paste the
  URL, **Scrape Again** (twice if the image was new). It also lists any tag problem.
* **LinkedIn:** Post Inspector, https://www.linkedin.com/post-inspector/ — paste the URL; inspecting refreshes LinkedIn's
  copy.
* **X:** there is no public validator any more; X re-reads a page after about a week. Share a variant address (below).
* **WhatsApp:** keeps a preview per exact link on each phone and on its servers; there is no refresh tool. Share the
  address with a harmless extra parameter, e.g. `https://ai-devopseasylearning.com/courses/<slug>?v=2` (the page's
  canonical stays the clean address). Count up for each retry.
* **Telegram:** send the link to @WebpageBot and ask it to update the preview.
* **Slack, Teams, Discord, iMessage:** cache by URL too; use the `?v=2` variant.

We do not control how each app lays out, crops or shortens a preview, and they change it without notice. The admin page's
mock cards are illustrative only.

## 8. Checks for the owner after a deploy (real devices)

These cannot be automated from here:

1. **WhatsApp on a phone:** send a course link (with `?v=1`) to yourself or a test chat. Expect the banner, the course title
   and the address. Repeat with the homepage.
2. **iMessage on an iPhone:** send the same link in Messages; expect the large banner card.
3. **Facebook:** Sharing Debugger on the homepage and one course: no warnings, the 1200×630 banner shows. Optionally post
   (only me) to see the card.
4. **LinkedIn:** Post Inspector on the same two links.
5. **X:** start a post with a course link (don't send) and check the card preview.
6. **Telegram:** send a course link in Saved Messages.
7. Change a course title in the studio, wait a minute, share with `?v=2`: the new title is on the banner.

## 9. Files

`apps/api/src/social/` (`share-templates.ts` families and topic designs, `share-render.ts` drawing and encoding,
`share-inputs.ts` settings and banner inputs, `social.service.ts`, `social.controller.ts`, `share-render.spec.ts`),
`apps/api/test/social.e2e-spec.ts`, migration `20261128150000_social_sharing`, `apps/web/src/lib/seo.ts`,
`apps/web/src/lib/share-server.ts`, `apps/web/src/app/og/site.jpg/route.ts`, `apps/web/src/components/ShareButtons.tsx`,
`apps/web/src/components/social/` (studio/admin editor and mock previews), `apps/web/src/app/admin/social/page.tsx`.
