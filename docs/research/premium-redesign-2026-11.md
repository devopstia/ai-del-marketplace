# Premium marketplace redesign: research, audit and plan (2026-11-24)

Owner brief: "Master prompt: complete premium frontend redesign" (2026-11-24). Branch `feature/premium-marketplace-redesign`,
checkpoint tag `checkpoint-2026-11-24-premium-redesign` = `bd57c5d`, backup branch `backup/pre-premium-redesign-2026-11-24`.
This complements `design-benchmark-2026-11.md` (text-only research; Udemy was blocked there). This time the public pages were
**rendered in a real browser** (Chromium, 1440 px and 390 px, full page and first screen) on 2026-11-24.

## 1. What was inspected (rendered)

| Site | Rendered? | Notes |
|---|---|---|
| Udemy home + a Docker/Kubernetes course page | Yes (some rails rendered as loading skeletons for a headless browser) | First real look at Udemy's live layout |
| Coursera home + "Supervised Machine Learning" course page | Yes (cookie banner over the lower first screen) | |
| LinkedIn Learning, edX, Skillshare, DataCamp, KodeKloud, Master.dev (+ /courses), egghead, Maven | Yes | |
| Pluralsight | **No**: 1440 px stopped at a bot check; 390 px came back unstyled | Not used as evidence |
| Vercel, Linear | Yes | Technology-SaaS polish references, not learning platforms |

## 2. Findings that drive the design

**Header.** Every marketplace keeps the header to one row of about 64–72 px: logo, one "Explore" entry, a wide search field
(Udemy ≈ 560 px, Coursera ≈ 480 px), then Teach/Business links, cart, Log in (outline) and Sign up (solid). No one shows a theme
toggle in the main row on desktop. Udemy and Coursera centre the content at about 1340 px; KodeKloud and DataCamp use full-bleed
dark bands with centred content.

**Hero.** Two families: (a) **photo/screen + short literal headline + one CTA** (Udemy, LinkedIn Learning: one photograph,
two buttons); (b) **promo carousel** (Coursera: two-and-a-half cards visible, dots below; Udemy: a single wide banner). Technology
platforms (KodeKloud, DataCamp) show **the product itself**: a real lab terminal, a real exercise. The most credible tech hero in the
set is KodeKloud's: a dark band, a short headline and a real lab screen below it. Its weakness is three competing CTAs plus a sale
banner. NN/g's carousel guidance still applies to the owner's requested two slides: visible frame controls, a pause control, no
auto-advance under reduced motion, nothing important *only* in slide 2.

**Discovery.** Udemy: "Skills to transform your career" tabs (topic → courses). Coursera: three columns "Most popular / Hot new
releases / Trending AI" as compact rows (thumbnail 64 px + partner + title + rating), not big cards. Master.dev: tool-logo strip
("Go deep on every layer") then course rails. Rows of small thumbnails read as more premium and denser than 4-up card grids.

**Course card.** Universal fields: 16:9 thumbnail, title (2 lines), instructor, rating (only if it exists), price; badges sparingly
("Bestseller", "New"). Udemy course page: dark title band, purchase card floating on the right, "What you'll learn" box first.
DEL's course page already follows this; the owner likes it, so it stays.

**Trust.** Specific numbers (Udemy "17,000 companies", LinkedIn "26,800 courses"), logos, named testimonials. DEL has none of
those yet, and inventing them is forbidden (Step 0). What DEL *can* show truthfully: the course's own facts (43 lessons, 4 h 50,
12 lab downloads, 34 quizzes, captions, certificate), the 14-day refund rule, Stripe checkout, lifetime access, and real screens from
the labs.

**Instructor recruitment.** Udemy and Skillshare place "Teach" as a header link plus one modest band near the bottom; it never
competes with the learner's content.

**What to avoid (observed weaknesses).** Sale countdowns and stacked promo banners (Coursera, DataCamp, KodeKloud on Black
Friday); duplicated carousels (Coursera); grids of near-identical rectangles (Master.dev home is ~10 rails of the same card);
stock-photo heroes that say nothing about the subject (Udemy's "Skills that start careers" faces).

## 3. Audit of the current frontend (`main` @ bd57c5d)

Screenshots of every page at 390/1440/1920 were taken as student, instructor (Nadia) and super admin. Main problems:

**Global / design system**
1. Content is capped at 1320 px. At 1920 px (the owner's screen), ~300 px of empty paper on each side, and the hero's text block
   is narrow inside it: the "empty" feeling the owner described.
2. Headings are oversized and heavy (hero 4.1 rem / 800 weight, section headings 2.1 rem / 800): the "oversized headings" rule 14
   warns against. Everything is bold, so nothing stands out.
3. Corner radii (22 px panels) and many pill outlines make the UI look soft and template-like.
4. Header: the search field is narrower than peers. "Browse courses" is the only discovery entry. The theme toggle takes a
   main-row slot on desktop.
5. Footer links lead to **empty results**: "Free courses" (`/courses?price=free`, 0 courses; the only course is paid) and
   "MCP & Agents" (`/courses?category=mcp-agents`, 0 courses). That breaks rule 4 and is the "paid courses labelled as free"
   impression the owner reported.

**Homepage**
6. The hero's right half is an abstract DevOps-loop diagram. It says nothing about the courses, and the floating "Free preview"
   card overlaps the band edge.
7. Below the hero, one course fills ~60 % of the page as a 17-row "route". On mobile it is ~2,000 px of numbered rows. It reads as
   a training-company landing page, not a marketplace.
8. "You run it in production. Teach it here." is a large dark rectangle with a decorative loop outline. It competes with the
   learner content and looks unlike the rest of the page.
9. "Taught by practitioners" is hidden (one instructor), which is right; it stays hidden until there are ≥ 2 instructors.
10. No "how buying works" information on the page: preview, one-time purchase, refund window, lifetime access and certificate
    are only discoverable on the course page.

**Catalogue (/courses)**
11. The topic filter lists 7 topics, but 6 of them return nothing. "Free" in the price filter returns nothing. The results area is
    one row next to a tall empty sidebar.

**Player (/learn)**
12. **Bug, owner rule 11 broken:** captions are ON by default (`useState(true)` + `<track default>` since the first web
    commit). They overlap the control bar. Must be off by default, and the learner's choice remembered.

**Dashboards (studio, admin, My learning)**
13. Functional and calm. Main issues are the same global ones (heavy headings, large radii, wide empty canvas at 1920 px) plus a
    lot of empty white on the studio dashboard. These are handled by the design-system pass, then reviewed page by page.

## 4. Design direction

Keep the identity (DEL infinity mark, violet + cyan, Schibsted Grotesk + Atkinson Hyperlegible) and make it **quieter and more
precise**:
- **Type scale**: display headings 600–700 weight, hero 3–3.4 rem max, section headings 1.5–1.75 rem. Body 16 px / 1.55.
- **Surfaces**: radii 14/12/8 px (panel/tile/control); 1 px hairlines; one shadow level for floating things only.
- **Width**: container 1400 px (+ wider gutters at ≥1600 px). Dark full-bleed bands carry the width at 1920 px instead of empty
  paper.
- **Colour**: violet stays the action colour; cyan is reserved for "lab / hands-on"; the dark "stage" navy is used for the hero
  and media surfaces only. No gradients except the faint stage vignette; no glows.
- **Imagery**: real frames from DEL's own lab recordings (VS Code, terminal, Terraform). These are true, technical and owned by
  DEL; no stock photos, no baked-in fake buttons.

## 5. Homepage content strategy (new order)

1. **Hero, two slides** (owner request) on a dark full-bleed stage band. Manual arrows + dots, auto-advance every 8 s that pauses
   on hover/focus, a visible pause button, no auto-advance with reduced motion.
   - Slide 1 *Marketplace*: "Learn AI and DevOps from engineers who run it in production", search, popular topics (each verified
     by e2e to return a course), a framed real lab screen.
   - Slide 2 *Featured course*: the real course title, facts, price, "View the course" and "Watch a free lesson" (real preview).
2. **Facts bar** under the hero: real course/platform facts (lessons, hours, labs, quizzes, 14-day refunds, lifetime access).
3. **Course discovery**: a "Featured course" spotlight using a marketplace course card (thumbnail, instructor, rating when it
   exists, price). At ≥ 4 courses it switches automatically to rails (Popular / New), and the category strip appears at ≥ 3 live
   categories (existing logic kept).
4. **Inside the course**: the curriculum as three compact stages (Understand → Build in labs → Automate) with counts and the
   section names, linking to the full curriculum. Replaces the 17-row route.
5. **How it works for learners**: Preview free → Buy once → Learn with labs → Certificate (real rules: 14-day refund, Stripe).
6. **Teach on DEL**: a quiet two-column band with the real share from `/platform/terms`, not a dark billboard.
7. **Footer**: category links generated only from categories with courses; "Free courses" only when free courses exist.

## 6. Plan for the rest of the frontend (one page at a time, owner OK between each, rule 12)

| Step | Pages | Main changes |
|---|---|---|
| A (this step) | Design tokens, header, footer, homepage, caption fix | As above |
| B | Catalogue + search | Hide empty topics/prices; result rows match the new card; empty state with suggestions |
| C | Course page | Keep layout (owner likes it); tokens only, plus a sticky mini-buy bar on mobile |
| D | Login / register / cart / checkout | One consistent auth shell; checkout summary |
| E | My learning + player | Continue-learning header; player chrome tidy; captions verified off |
| F | Instructor studio | Denser dashboard (fill the empty right column), consistent tables |
| G | Admin | Same table/KPI components as studio; overview density |

## 7. Backend limitations noticed (for later, not touched now)
- Only the first lesson thumbnail is imported (`import-del.ts`), so lesson-level images can't be shown from the API. The homepage
  uses curated lab frames shipped with the web app until the API exposes lesson thumbnails.
- No public "verified review" or completion stats yet, so social proof is limited to real course facts.
- Categories exist without courses (seeded topics); the API could expose `courseCount` reliably for filters.
