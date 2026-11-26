# Search engines and link previews (owner 2026-11-26)

Goal: students find the marketplace and its courses on Google (and Bing, DuckDuckGo, Yahoo), and shared links show a
proper preview. Code: `apps/web/src/lib/seo.ts` (site address, indexing switch, schema.org builders), `app/robots.ts`,
`app/sitemap.ts`, `app/opengraph-image.tsx`, `components/JsonLd.tsx`. Test: `apps/web/e2e/seo.spec.ts`.

## Only production is indexed
- `SITE_URL` = `WEB_URL` (runtime) or the origin of `NEXT_PUBLIC_API_URL` (build time), so pages rendered during the build
  get the right host too. Indexable only when it is `https://ai-devopseasylearning.com`; `SITE_INDEXABLE=true|false`
  overrides (for example a new production domain).
- Not indexable (staging, test, local): `robots.txt` is `Disallow: /`, the sitemap is empty, every page has
  `<meta name="robots" content="noindex, nofollow">`, and staging's Caddy also sends `X-Robots-Tag: noindex, nofollow`
  (`deploy/Caddyfile`). Keep all three.

## What exists
| Item | Where |
| --- | --- |
| `robots.txt`: public pages allowed; studios, learning player, cart, checkout, sign-in pages, support tickets and `/api/` (except course images) disallowed | `app/robots.ts` |
| `sitemap.xml`: home, catalogue, topic pages (topics with courses), every published course (with its cover), instructors with courses, help videos, deals, teach, contact, install, policies. Built per request from the API (fetches cached 1 h); static pages only when the API is down | `app/sitemap.ts` |
| Canonical address on every public page; `/courses?category=x` (one topic, no other filter) points to `/courses/topic/x`, other filters and pages to `/courses`; search results (`?q=`) are `noindex, follow` | `pageMeta()` in `lib/seo.ts`, `courses/page.tsx` |
| Link previews (Open Graph + X card): course pages use their generated cover (1280×720), instructor pages their first course's cover, other pages the default image `/opengraph-image` (1200×630) | `pageMeta()`, `app/opengraph-image.tsx` |
| Topic pages `/courses/topic/<slug>`: the catalogue for one topic, own title, description (from name and course count; categories have no description), breadcrumbs. Linked from course breadcrumbs, the homepage topic strip and the footer. Topics without courses are `noindex` | `courses/topic/[slug]/page.tsx`, `courses/_catalogue.tsx` |
| Course: schema.org `Course` (offers with price and currency, `CourseInstance` online with workload, instructor, image, language, level, teaches, prerequisites, `aggregateRating` only when real ratings exist), `BreadcrumbList`, `FAQPage` (the same answers as "Questions before you buy" on the page) | `courseLd()`, `courses/[slug]/page.tsx`, `components/CourseFaq.tsx` |
| Homepage: `Organization` (logo, support email, `sameAs` = the social accounts in `components/SocialLinks.tsx` + www.devopseasylearning.com) and `WebSite` with a `SearchAction` to `/courses?q=` | `organizationLd()`, `websiteLd()` |
| Instructor pages: `ProfilePage` with the instructor as `Person` | `instructors/[id]/page.tsx` |
| Course page text in the HTML: what you'll learn, requirements, description, instructor bio and **every lesson title** (closed curriculum sections are only hidden). Paid lesson content is never in the page | `components/Curriculum.tsx` |
| Certificates: `noindex` (they carry a learner's name), reachable by link | `certificates/[code]` |
| Honest descriptions: no "hands-on labs" claim (there are no in-browser labs) | `SITE_DESCRIPTION` in `lib/seo.ts` |

Structured data only states what the page shows. Never add invented ratings, reviews, prices or claims.
Note: Google shows FAQ rich results only for a few authoritative sites since 2023; the FAQ data is still valid and
harmless, and Bing uses it.

## Speed (Lighthouse, mobile preset)
Covers are 1280×720 PNGs (~200 KB) shown ~380 px wide on phones. The web image route (`app/media/images/...`) now
returns WebP copies for `?w=320|480|640|960` (sharp, kept in memory; the original if sharp is missing), covers use
`srcset`/`sizes`, and the first covers on screen load at once (`priority`) instead of lazily. A course cover went from
200 KB to 11–15 KB on a phone.

| Page (built locally, data from staging) | Before: performance / SEO | After |
| --- | --- | --- |
| Home | 98 / 63 (staging, noindex) | 98 / 100 |
| /courses | 89 / 63 | 90 / 100 |
| Course page | 85 / 63 | 93 / 100 |
| Topic page | (new) | 94 / 100 |

SEO 63 "before" is staging's deliberate noindex; production had no robots.txt, sitemap, canonical or previews.
Accessibility 98–100. Best practices 96 locally only because the test pages called the staging API across origins.

## Owner steps (items 6 and 7)
1. **Google Search Console** (search.google.com/search-console): sign in with the DEL Google account → Add property →
   **Domain** → `ai-devopseasylearning.com` → copy the `google-site-verification=…` TXT value and send it to the agent,
   who adds it to the Route 53 zone (Terraform, `infra/terraform`). Click **Verify**, then **Sitemaps** → submit
   `https://ai-devopseasylearning.com/sitemap.xml`. Use **URL inspection** → *Request indexing* for the homepage and
   each course after publishing.
2. **Bing Webmaster Tools** (bing.com/webmasters): sign in → **Import from Google Search Console** (no second DNS record)
   → the sitemap comes with it. Covers Bing, DuckDuckGo and Yahoo.
3. Check rich results with Google's Rich Results Test on a course URL after release.

Courses only appear once they are published on production. Brand searches ("DevOps Easy Learning", course names)
usually show within days of submitting the sitemap; competitive searches ("DevOps course") take weeks to months and
depend mostly on links from devopseasylearning.com, YouTube descriptions and social posts.
