# Platform audit: AI Learning Marketplace (2026-11-24)

Scope: the running local stack (web `http://127.0.0.1:3000`, API `http://127.0.0.1:4000/api`), audited as **visitor, student
(`student@`), DEL platform instructor (`courses@`), independent instructor (`nadia@`) and super admin (`admin@`)**, plus a freshly
registered applicant. No source code was changed and the stack was not restarted. Scripts, raw JSON results and 358 screenshots are
in `.work/audit/` (gitignored): `out/crawl-*.json` (link crawl), `out/clicks-*.json` (every visible control clicked), `out/journey-*.json`
(end-to-end flows), `shots/` (every page at 1440 and 390 px, light and dark, plus one shot per journey step), `sheets/` (per-page contact sheets).

**Method.** (1) Playwright crawl of every same-origin link reachable from header, footer, menus and dashboards per role (42–68 URLs per
role, 251 page loads, recording HTTP status, console errors, failed requests, timings, unlabelled inputs, nameless buttons, missing alt).
(2) A generic "click everything" pass over 46 representative pages: each visible button, tab, toggle, select, radio and in-page anchor
was clicked on a fresh load and classified by its effect (navigation, request, DOM change, dialog, error). Destructive or
state-changing controls were skipped in that pass and exercised deliberately in the journeys instead. (3) Scripted end-to-end journeys
with valid and invalid input. (4) Screenshots reviewed by eye. (5) Keyboard, focus, reduced-motion and mobile-interaction checks.

**Headline.** The core marketplace loop works end to end: discover → preview → cart → test checkout → My learning → player
(play, speed, seek, keyboard, fullscreen, resume) → notes → resource download → quiz → review → certificate → verify; and
apply → approve → create course → upload image/promo/video/resource → curriculum/quiz → pricing → submit → admin review (play,
request changes, approve) → published → sale shows in Sales/Students/dashboards → admin refund revokes access → unpublish. Zero HTTP 5xx,
zero JS exceptions, no horizontal overflow at 390 px, every page reaches network-idle in 0.55–0.85 s. The problems are a handful of
logic bugs and misleading labels, several "visible but cannot work here" controls, thin/placeholder seed content, and a design that
is clean and consistent but still template-like in places (repeated dark cover rectangles, sparse dashboards, weak mobile density).

> Side effect to know about: the generic click pass pressed "Move section down" on Nadia's live *AIOps* course, which reordered the
> sections of a published course immediately (no review, no undo). I restored the original order through the API
> (`PUT /instructor/courses/:id/sections/order`). Data created on purpose is listed at the end.

## 1. Prioritized findings

### P0: broken flows
None. Every journey in the brief completed. (No wishlist or coupon exists, so those steps are absent rather than broken; see section 5.)

### P1: wrong data, misleading labels, controls that cannot work, unsafe actions
| # | Where | Finding | Evidence |
|---|---|---|---|
| 1 | Home, "Taught by practitioners" | **Instructor stats are double/triple counted.** Nadia shows "6 courses, 5 learners" and DEL "8 courses, 19 learners"; the real figures are 2 and 4 courses, 5 and 10 learners. `app/(site)/page.tsx` builds `all = [...popular, ...newest, ...rated]` (duplicates) and counts `mine = all.filter(...)`. | `GET /instructors/:id` stats vs home screenshot |
| 2 | Studio → course → Pricing | **"Save and continue" advances even when the save failed.** Price $0.50 → API 400 "Paid courses cost at least $0.99" toast, yet the page moves on to Review and submit. `StepFooter` awaits `onSave` and calls `goto(next)` regardless (same footer on Details). | journey-instructor2 step 13 |
| 3 | Pricing | **No client validation and a wrong hint.** Typing `abc` keeps the previous value and shows "Price saved." (a no-op save that looks successful). The hint says "Free, or at least $9.99" but $5.00 saves fine (API minimum is $0.99). | steps 10–12 |
| 4 | Studio → Media | **Promo video status is hard-coded to "Processing"** (`<StatusBadge status="processing" />`) and never becomes Ready, although the asset is `ready` in `GET /instructor/videos`. | journey-instructor steps 9–10 |
| 5 | Studio → Payouts (`nadia`) | **"Set up payouts with Stripe" is shown although Stripe is not configured**: click → `503 stripe_not_configured`, toast "Stripe is not configured". `GET /instructor/stripe/status` already returns `stripeConfigured:false`, so the UI could explain or hide it (owner rule 4). Acceptable in dev only if labelled. | clicks-nadia |
| 6 | Course page "This course includes" | **Claims "Downloadable lab files" on every course**, including those with no resources (n8n, AIOps, MCP, Cloud AI all have `resourceCount: 0`). "Certificate of completion" and "Watch on mobile" are true; this line is not. | `/courses/:slug` API vs card |
| 7 | Admin → Users | **Role chips grant or revoke admin / super admin on a single click, with no confirmation** and a weak on/off visual (all chips look alike). Suspend also has no confirm. One mis-tap makes someone an admin. | admin users screenshot, code `admin/users/page.tsx:47` |
| 8 | Studio → published course | **Curriculum edits on a published course go live immediately** (reorder, rename, delete section/lecture, toggle free preview, replace video) with no review and no undo; only the Details/Pricing of a course in review are locked. My click test reordered a live course. Needs at least confirmation + an "unpublished changes" model or audit. | section 1 note |
| 9 | Seed/demo content | **Placeholder content presented as real**: all lecture videos are 10–20 s ffmpeg test patterns ("1 min of on-demand video", "1 min" on every card), every course is rated "4.5 (2)" by the same seeded reviewers, and `/teach` shows a first-person testimonial attributed to Nadia ("I recorded my incident-response course in three weekends…") that no one said. Home "quotes" are each instructor's first bio sentence presented in quotation marks. | screenshots home/teach/courses |

### P1: no-op or dead controls
The click pass found **no button that silently does nothing** apart from the items below. Everything else either navigated, called the API,
changed the DOM or opened a dialog (130 "works" results). Controls reported as "no visible effect" were already-selected defaults (All
topics, All levels, Any price, 30 days, All, Overview, Applications tab), which is expected.

| Where | Control | Behaviour |
|---|---|---|
| Admin → Categories | **Add** with an empty name | Silent no-op, no message (P2). |
| Studio → Curriculum | **Add section** with an empty title | Silent no-op, no message (P2). |
| Studio → Curriculum | **Save and continue** | Saves nothing (curriculum autosaves on blur); the label implies a save (P2 wording). |

### P2: polish, consistency, scale, accessibility
1. **Course page fires `GET /me/courses/:slug` three times** for signed-in, non-enrolled users (two PurchaseCards render, desktop and mobile, each probes), giving 3 × `403` console errors per course view, although `viewer.enrolled` is already in the course payload.
2. **Two PurchaseCards in the DOM** (one hidden) → duplicate `data-testid`s and duplicated focusable content for screen readers using the virtual cursor.
3. **Admin lists are capped at `pageSize=100` with no pagination** (users, orders, courses); **Audit log loads only the first page and filters it client-side**, so older entries can't be found.
4. **Admin → Orders**: the Courses column shows "1 course" instead of titles (list endpoint has no lines), there is no order detail view (API `GET /admin/orders/:id` exists) and refunds are always full (API supports `lineIds` partial refunds).
5. **No captions upload in the studio** although the API supports it (`/uploads/video/:id/captions`) and the player has a Captions button (correctly hidden when a lecture has none). No avatar upload on Account (API supports it).
6. **Toasts stack duplicates** ("Name updated. / Name updated.", "Price saved." repeated) and old toasts linger into the next action.
7. **Cart aria-label "Cart, 1 items"** (plural).
8. **Preview modal**: native `<dialog>`; focus cycles out of it once ("Skip to content") before wrapping; Escape and close return focus correctly.
9. **User menu** has `role="menu"` but no arrow-key navigation (Tab works). Either implement menu keyboard semantics or drop the role.
10. **Learn page on mobile**: the Notes tab sits off-screen in a horizontally scrolling tab bar; Overview has no lecture description/transcript, so the tab area is mostly empty.
11. **Studio course editor on mobile**: step nav clipped (Pricing/Submit off-screen), "New lecture title" input squeezed to ~4 characters, sticky footer covers content.
12. **My learning**: "Next up: <title>" actually shows the last lecture opened, not the next one.
13. **Home ordering is unstable** for ties (rating sort): the "Start here" picks differ between loads.
14. Notes are browser-only (honestly labelled "Saved in this browser… not synced"). Works when typing; acceptable, but a learning platform should sync notes.

### Accessibility and performance summary
- Good: skip link first in tab order and visible on focus; every input has a label (crawler found **0** unlabelled inputs, **0** nameless buttons, **0** images without `alt`, exactly one `h1` per page); focus rings visible on all tabbed elements; `prefers-reduced-motion` stops all running animations (2 → 0); text contrast passes AA in both themes (muted `#5a6079` on `#f4f5fa` ≈ 5.9:1, dark `#9599b8` on `#0c0f22` ≈ 7:1); modal returns focus to its trigger; quiz/review stars use radio semantics; `aria-current`, `aria-expanded`, `aria-pressed` used correctly.
- Issues: items P2-2, 8, 9 above; admin tables at 390 px scroll inside a card with the action column off-screen.
- Performance: no slow page. DOM-content-loaded ~0.55 s, network idle 0.56–0.85 s on every route (local). Video preview starts in < 1 s. Uploads (4 s MP4) were processed by the worker within ~5 s.

## 2. End-to-end journeys (result per step)

### Student
| Step | Result |
|---|---|
| Header search "n8n" → results → course page | Works (1 result, correct course). |
| Preview this course (modal) | Works: signed preview URL, video plays, switches between the 2 free previews, Escape closes, focus returns. |
| Wishlist | **Not present** (no UI, no API). |
| Add to cart ×2 → cart badge → Cart page | Works: badge "2", items, total, Remove buttons. |
| Coupon | **Not present** (no UI, no API). |
| Checkout → Pay → local test-payment page → Complete | Works: clear "development-only test payment" page, order created, fulfilment, success page "You're enrolled" with per-course Start learning, My learning, View receipt. Cart badge resets to 0. |
| Orders → receipt → Print | Works (print dialog invoked). |
| Course page after purchase | Shows "You're enrolled / Go to course". |
| My learning | Lists 3 courses, Continue hero, tabs All / In progress / Completed filter correctly, certificate action. |
| Player | Play/pause, ±10 s, mute, speed menu (1.5× applied and remembered), fullscreen, keyboard (K/J/L/F), Next/Previous, sidebar collapse, section accordions, mark complete checkbox, resume to last lecture: all work. Autoplay is blocked by the browser (shows play button), fine. Captions button only appears when a lecture has captions; **no seeded lecture has captions**, so captions could not be exercised with seed data. |
| Notes | Work (typing then clicking away saves; survives reload and lecture switch). Browser-only. |
| Resources → Download | Works on the AUDIT course lecture (ZIP via presigned URL). Seed courses have only one resource in total. |
| Quiz | Submit disabled until all answered; score "0 of 3" with per-question "Why"; Try again works. |
| Mark all complete → certificate | Overview shows "Get your certificate" → My learning "Get your certificate" → certificate page with code; verify with good and bad codes works. |
| Review | Empty submit blocked; 4 stars + text posts and shows after reload as verified. |
| Account | Name save (disabled until changed) updates header; wrong current password → "Current password is incorrect"; short new password blocked by browser validation; sessions list with current device. |
| After admin refund | Course removed from My learning; player shows "You are not enrolled"; order shows Refunded. |

### Instructor (Nadia, plus a new applicant)
| Step | Result |
|---|---|
| Register (invalid email / short password, then valid) → /teach | Works; native validation messages; redirect honours `next`. Wrong-password login shows a clear message. |
| Apply (short bio invalid, then valid) | Works; studio shows "Application received" until approved. |
| Admin approves → applicant's studio unlocks in the same session | Works. |
| New course modal (empty submit blocked, Cancel, create with title + category) | Works. |
| Details: subtitle, description, 4 outcomes, requirement, level → Save | Works ("Details saved."). Empty title → API 400 shown as raw "title: Too small: expected string to have >=3 characters" (P2: developer wording). |
| Media: thumbnail upload, promo upload | Work; promo status label wrong (P1-4). |
| Curriculum: section, video/article/quiz lectures, video upload (processed to Ready 0:04), free-preview toggle, resource ZIP, article text, reorder, rename | All work. Invalid quiz save shows raw Zod paths ("questions.0.q: Too small…", P2). Valid quiz saves. |
| Pricing | Tier buttons work; validation problems P1-2/3. |
| Submit checklist → Submit for review → locked | Works; editing paused with clear banner. |
| Admin review queue: play lecture, reject without note (blocked with message), request changes with note | Works; instructor sees "Changes requested by the reviewer" + note in editor and course list. |
| Admin approve → published → public page | Works. |
| Student buys → Sales / Students / Dashboard | Sale appears in Sales (earnings, commission 0 %), Students (with course filter), dashboard KPIs and chart. |
| Reviews: reply publicly / "Needs a reply" filter | Works ("Reply posted."). |
| Payouts | Nadia: Stripe button → 503 (P1-5). DEL platform account: correct "Platform-owned courses, no transfers needed". |

### Admin
| Step | Result |
|---|---|
| Overview KPIs, waiting-work cards, revenue chart, recent activity | Works and updates live. |
| Review queue (select, play, approve / request changes / reject) | Works. |
| Instructors (Applications / All tabs, approve) | Works. |
| Users (search, suspend, reactivate) | Works; role toggles unsafe (P1-7); no pagination. |
| Categories (add, rename on blur, delete empty, delete non-empty → "Move the courses out of this category first") | Works; empty add silent. |
| Settings (commission %, 150 % disables Save, save) | Works. |
| Orders (refund dialog, cancel, refund with reason) | Works: access revoked, order Refunded, audit entry written. |
| Courses (search, status filter, unpublish requires note) | Works; unpublished page returns 404 publicly, enrolled students keep access. |
| Audit log (filter, Details) | Works on the loaded page only (P2-3). |
| Non-admins on /admin, non-instructors on /studio | Clear "Admins only" and "Apply to teach" screens. Signed-out users are redirected to login with `next`. |

## 3. Design critique per page
General: one coherent system (display font, violet/cyan accent, loop motif, consistent radius and spacing), dark mode is complete and
intentional, nothing overflows at 390 px. The main weaknesses are **repetition of the same generated dark cover rectangle** (every course,
in every size, carrying its own title text, so titles appear twice), **sparse pages that end in large empty areas**, and **mobile layouts
that are single-column stacks of desktop components** rather than designed for the phone.

| Page | What works | Problems (concrete) |
|---|---|---|
| Home `/` | Strong headline, live search with popular chips, animated DevOps loop, editorial "Start here" split, ranked "Most enrolled" list breaks the card grid, dark teach CTA band. | Hero right column: the loop graphic plus a small floating "Free preview available" card feel unanchored; at 390 the loop drops below the search with a large gap and the spotlight card disappears. Category strip shows "1" after each category, which advertises how thin the catalogue is. "Taught by practitioners" has two quotes in a three-column space (empty third) and wrong stats (P1-1). "New on DEL" repeats the same four dark covers seen above. Mobile "Most enrolled" thumbnails (≈56 px) render cover titles as "n8n Autom", illegible. |
| Catalogue `/courses` | Clean list rows with all key facts, sticky filter column, chips for active filters, mobile Filters disclosure works. | Each row repeats the title inside the cover and next to it. Uniform "4.5 ★ (2)" and "1 min" on every row look fake. At 390 the cover becomes a tiny tile with truncated title text. No result count per filter and no empty-state suggestions beyond "Clear all filters". |
| Course detail | Dark header with breadcrumb, meta row, sticky purchase card, curriculum accordion with preview buttons, rating histogram, instructor block. | **"Preview this course" label overlaps the generated cover title** (both white text on the same spot, unreadable) at 1440 and 390. Below the header the page is a narrow left column with a large empty right side once the sticky card scrolls by. "What you'll learn" box with three bullets is a heavy bordered rectangle for little content. Reviews: two cards, no sort/filter. Mobile: purchase card sits between header and content (good) but "This course includes" repeats on every course and contains the false lab-files claim. |
| Instructor profile | Simple and correct stats. | Thin: avatar initials, short bio, a grid of the same covers; no social proof beyond counts. |
| Teach `/teach` | Clear value props, four-step "How it works", payouts explainer. | Fabricated testimonial (P1-9). "How payouts work" box: heading alone in a wide left column, text squeezed right. On mobile the "Start your application" CTA is pushed below three feature items; the four steps become a long scroll of rules and numerals. |
| Login / Register | Split layout with a quote, clean forms, good validation. | Quote panel uses another unattributed marketing quote. |
| Cart / Checkout / Test payment / Success | Clear, honest test-payment page; success page lists each course with Start learning. | Cart empty state is a big dashed box in an otherwise empty page; checkout is a small card in a large empty canvas. |
| My learning | Continue hero with loop meter, filter tabs, list rows with progress and certificate links, suggestions. | Suggestions row shows 3 cards in a 4-column grid (empty slot; orphan card on mobile). Hero label "Next up" is wrong (P2-12). Rows again duplicate titles in covers. |
| Player `/learn` | Focused full-height layout, good custom controls, readable sidebar with completion checkboxes, keyboard hints. | Below the video the Overview tab is nearly empty (title, course, instructor, progress); no description, transcript, Q&A or AI help, so the lower half of the screen is unused. Mobile: Notes tab off-screen. |
| Certificate | Clean certificate card with code, issue date, print. | The owner's view leads with a "Verify a certificate" input above their own certificate (weak hierarchy); no share/LinkedIn or download-PDF action beyond browser print. |
| Orders / receipt / Account | Clear tables, sessions list with device and IP. | Plain tables; receipt is functional but generic. |
| Studio dashboard | KPI band (not floating cards), daily earnings chart, latest reviews, course list. | Chart with one bar and odd axis ticks ("10.00 / $20"); course thumbnails without an image are flat violet blocks; at 1440 the left sidebar's user footer floats mid-page on short pages. |
| Studio course editor | Step navigation with done checks, sticky save footer, strong curriculum editor (status chips, durations, inline upload with progress). | Mobile: step nav clipped, lecture title input squeezed, sticky footer covers rows. Raw validation strings. Promo status wrong. |
| Studio Sales / Students / Reviews / Payouts / Profile | Consistent tables, range selector, honest commission display, review reply flow. | Sales chart is mostly empty; Payouts page is long explanatory text when Stripe is off. |
| Admin overview | Clear KPI band, "waiting" cards that turn amber, activity feed. | Activity feed shows raw action names ("course price changed" ×3), no grouping; no refunds/failed transfers/pending payouts KPIs; chart sparse. |
| Admin review queue | Excellent focused layout: queue, curriculum with Play, note box, three decisions. | None significant. |
| Admin users / orders / courses / audit | Searchable tables, status badges. | Role chips unclear and unsafe; no pagination; orders without course titles or detail; tables clipped at 390. |
| 404 | Friendly "This page isn't here" with way back. | Fine. |

## 4. What is genuinely good and should be preserved
- **The full purchase and learning loop** (cart → test/Stripe checkout → fulfilment → My learning → player → progress → certificate → verify) and the **refund path** that revokes access and writes the audit log.
- **The custom video player**: signed short-lived URLs with automatic refresh, resume position, remembered speed, keyboard shortcuts, accessible controls.
- **Studio course editor** (step navigation with readiness checklist, direct-to-storage uploads with progress, worker-processed video, quiz editor with "why" explanations) and the **admin review queue** (watch lectures, required notes for changes/rejection, instructor sees the note).
- **Honest copy**: the test-payment page, notes "saved in this browser", unpublish dialog explaining enrolled learners keep access, platform-owned payouts explanation.
- **Accessibility foundation**: labels on every control, skip link, focus rings, reduced motion, semantic tabs/radios, focus return from dialogs, AA contrast in both themes.
- **Visual identity**: the DevOps loop motif and LoopMeter progress, the editorial home sections ("Start here", ranked "Most enrolled"), the KPI band component, complete dark theme.
- **Speed**: every route under 1 s to idle locally; zero 5xx and zero JS exceptions during the whole audit.
- **Security behaviours observed**: protected routes redirect with `next`, role screens for non-admins/non-instructors, other users' resources return 404, CSRF on every write, login rate limit, session list with revoke.

## 5. Missing versus the brief and the benchmark (not defects, since nothing is shown for them)
Wishlist, coupons/promotions, lecture Q&A/discussion, transcripts, synced notes, captions authoring, avatar upload, certificate sharing,
course search inside the player, AI learning assistant / AI search / AI study materials (owner rule 3), instructor analytics beyond sales,
admin order detail and partial refunds, payouts reporting for admins.

## 6. Data created by this audit
- Courses (Nadia): **"AUDIT Kubernetes Cost Guardrails 42421"** (published → bought by student → refunded → unpublished) and **"AUDIT Kubernetes Cost Guardrails 18024"** (changes requested).
- User **AUDIT Applicant** (`audit-applicant-…@example.test`, approved instructor; suspended then reactivated).
- Student: paid test order for n8n + AI-Powered CI/CD, AUDIT order (refunded), 4-star "AUDIT review" on n8n (with Nadia's "AUDIT reply"), free course marked 100 % and certificate `DEL-8XUOHASHI6HH` issued, a few quiz attempts and browser notes; name changed and restored.
- Category "AUDIT Category" created, renamed and deleted. Commission re-saved at its existing value (0 %).
- Nadia's AIOps section order was changed by the click test and restored (see note at top).
A reseed (`docker compose exec api npm run seed`) does not remove these; a fresh stack does.

## 7. Control inventory per role
Generated from `.work/audit/out/clicks-*.json` (each visible control clicked on a fresh page load). "covered in journey" means the
control changes data and was exercised in section 2 instead. Links are not listed individually: the crawler followed **every** link on
every page per role (visitor 42, student 29, DEL instructor 68, Nadia 49, admin 51 URLs) and **all returned 200** (or the intended 404
page / login redirect); the only console errors were the redundant `403 /me/courses/:slug` probes (P2-1) and the deliberate 404.

### Visitor (signed out)

| Page | Control | Result | Evidence |
|---|---|---|---|
| / | Switch light or dark theme | works | theme/class |
| / | Search | works | nav→/courses?q=; dom Δ-65264 |
| /courses | Switch light or dark theme | works | theme/class |
| /courses | All topics | no visible effect – already selected (default) – expected |  |
| /courses | AI Foundations | works | nav→/courses?category=ai-foundations&level=&price=; dom Δ-116673 |
| /courses | AI for DevOps | works | nav→/courses?category=ai-for-devops&level=&price=; dom Δ-140069 |
| /courses | CI/CD & GitOps | works | nav→/courses?category=cicd-gitops&level=&price=; dom Δ-140137 |
| /courses | MCP & Agents | works | nav→/courses?category=mcp-agents&level=&price=; dom Δ-140161 |
| /courses | Cloud AI (AWS & Azure) | works | nav→/courses?category=cloud-ai&level=&price=; dom Δ-138943 |
| /courses | Automation (n8n) | works | nav→/courses?category=automation-n8n&level=&price=; dom Δ-137925 |
| /courses | All levels | no visible effect – default – expected |  |
| /courses | Beginner | works | nav→/courses?category=&level=beginner&price=; dom Δ-91642 |
| /courses | Intermediate | works | nav→/courses?category=&level=intermediate&price=; dom Δ-94300 |
| /courses | Advanced | works | nav→/courses?category=&level=advanced&price=; dom Δ-139060 |
| /courses | Any price | no visible effect – default – expected |  |
| /courses | Free | works | nav→/courses?category=&level=&price=free; dom Δ-116784 |
| /courses | Paid | works | nav→/courses?category=&level=&price=paid; dom Δ-45283 |
| /courses | Most popular Highest rated Newest Price: low to high Price:  | works | nav→/courses?sort=rating; dom Δ-205 |
| /courses/aiops-monitoring-and-incident-respon | Switch light or dark theme | works | theme/class |
| /courses/aiops-monitoring-and-incident-respon | 4.5 (2 ratings) | works | nav→/courses/aiops-monitoring-and-incident-response#reviews |
| /courses/aiops-monitoring-and-incident-respon | Expand all sections | works | dom Δ2062 |
| /courses/aiops-monitoring-and-incident-respon | Foundations 2 lectures, 1 min | works | dom Δ-2381 |
| /courses/aiops-monitoring-and-incident-respon | Preview | works | opened dialog/menu; dom Δ6821 |
| /courses/aiops-monitoring-and-incident-respon | The assistant 2 lectures, 1 min | works | dom Δ2062 |
| /courses/aiops-monitoring-and-incident-respon | Preview this course | works | opened dialog/menu; dom Δ6821 |
| /courses/aiops-monitoring-and-incident-respon | Add to cart | covered in journey |  |
| /courses/aiops-monitoring-and-incident-respon | Buy now | covered in journey |  |
| /courses/ai-foundations-for-devops-engineers | Switch light or dark theme | works | theme/class |
| /courses/ai-foundations-for-devops-engineers | 4.5 (2 ratings) | works | nav→/courses/ai-foundations-for-devops-engineers#reviews |
| /courses/ai-foundations-for-devops-engineers | Expand all sections | works | dom Δ2041 |
| /courses/ai-foundations-for-devops-engineers | How language models think 3 lectures, 2 min | works | dom Δ-3485 |
| /courses/ai-foundations-for-devops-engineers | Preview | works | opened dialog/menu; dom Δ8620 |
| /courses/ai-foundations-for-devops-engineers | Working safely with AI 2 lectures, 3 min | works | dom Δ2041 |
| /courses/ai-foundations-for-devops-engineers | Preview this course | works | opened dialog/menu; dom Δ8592 |
| /courses/ai-foundations-for-devops-engineers | Add free course to cart | covered in journey |  |
| /courses/ai-foundations-for-devops-engineers | Enrol now | covered in journey |  |
| /teach | Switch light or dark theme | works | theme/class |
| /login | Switch light or dark theme | works | theme/class |
| /login | Show password | works | dom Δ146 |
| /login | Log in | covered in journey |  |
| /register | Switch light or dark theme | works | theme/class |
| /register | Show password | works | dom Δ146 |
| /register | Create account | covered in journey |  |
| /certificates/verify | Switch light or dark theme | works | theme/class |
| /certificates/verify | Verify | works | nav→/certificates/verify?code=; dom Δ25 |
| /instructors/0a5b7b08-5459-4630-a936-2befc741 | Switch light or dark theme | works | theme/class |

### Student (student@del.example)

| Page | Control | Result | Evidence |
|---|---|---|---|
| /my-learning | Switch light or dark theme | works | theme/class |
| /my-learning | SS | works | opened dialog/menu; dom Δ2947 |
| /my-learning | All courses | no visible effect – already selected – expected |  |
| /my-learning | In progress | no visible effect – same list (all in progress) – expected |  |
| /my-learning | Completed | works | dom Δ-14513 |
| /cart | Switch light or dark theme | works | theme/class |
| /cart | SS | works | opened dialog/menu; dom Δ2947 |
| /orders | Switch light or dark theme | works | theme/class |
| /orders | SS | works | opened dialog/menu; dom Δ2947 |
| /account | Switch light or dark theme | works | theme/class |
| /account | SS | works | opened dialog/menu; dom Δ2947 |
| /account | Save name | disabled (correct state) |  |
| /account | Change password | covered in journey |  |
| /learn/‹free›/‹lecture› | Switch light or dark theme | works | theme/class |
| /learn/‹free›/‹lecture› | Hide course content | works | dom Δ-5923 |
| /learn/‹free›/‹lecture› | Play video | works | dom Δ-582 |
| /learn/‹free›/‹lecture› | Play | works | dom Δ-582 |
| /learn/‹free›/‹lecture› | Back 10 seconds | works | dom Δ-582 |
| /learn/‹free›/‹lecture› | Forward 10 seconds | works | dom Δ144 |
| /learn/‹free›/‹lecture› | Mute | works | dom Δ-31 |
| /learn/‹free›/‹lecture› | Playback speed 1x | works | opened dialog/menu; dom Δ1062 |
| /learn/‹free›/‹lecture› | Captions | works | dom Δ-10 |
| /learn/‹free›/‹lecture› | Full screen | works | dom Δ-7 |
| /learn/‹free›/‹lecture› | Previous | disabled (correct state) |  |
| /learn/‹free›/‹lecture› | Next | works | nav→/learn/ai-foundations-for-devops-engineers/3d9987e1-0d0d-4fe9-8bdd |
| /learn/‹free›/‹lecture› | Overview | no visible effect – already selected – expected |  |
| /learn/‹free›/‹lecture› | Resources | works | dom Δ-1550 |
| /learn/‹free›/‹lecture› | Notes | works | dom Δ-1322 |
| /learn/‹free›/‹lecture› | Section 1: How language models think 0 / 3 done, 2 min | works | dom Δ-3423 |
| /learn/‹free›/‹lecture› | Mark “Welcome: what you will build” complete | works | dom Δ-289 |
| /learn/‹free›/‹lecture› | Mark “Tokens and context windows” complete | works | dom Δ278 |
| /learn/‹free›/‹lecture› | Mark “Reading: a glossary you will keep” complete | works | dom Δ278 |
| /learn/‹free›/‹lecture› | Section 2: Working safely with AI 0 / 2 done, 3 min | works | dom Δ1982 |
| /courses/build-mcp-servers-and-ai-agents | Switch light or dark theme | works | theme/class |
| /courses/build-mcp-servers-and-ai-agents | SS | works | opened dialog/menu; dom Δ2947 |
| /courses/build-mcp-servers-and-ai-agents | 4.5 (2 ratings) | works | nav→/courses/build-mcp-servers-and-ai-agents#reviews |
| /courses/build-mcp-servers-and-ai-agents | Expand all sections | works | dom Δ2078 |
| /courses/build-mcp-servers-and-ai-agents | MCP in one picture 2 lectures, 1 min | works | dom Δ-2373 |
| /courses/build-mcp-servers-and-ai-agents | Preview | works | opened dialog/menu; dom Δ6801 |
| /courses/build-mcp-servers-and-ai-agents | Build it 2 lectures, 1 min | works | dom Δ2078 |
| /courses/build-mcp-servers-and-ai-agents | Preview this course | works | opened dialog/menu; dom Δ6801 |
| /courses/build-mcp-servers-and-ai-agents | Add to cart | covered in journey |  |
| /courses/build-mcp-servers-and-ai-agents | Buy now | covered in journey |  |
| /studio | Switch light or dark theme | works | theme/class |
| /studio | SS | works | opened dialog/menu; dom Δ2947 |
| /studio | Send application | covered in journey |  |
| /teach | Switch light or dark theme | works | theme/class |
| /teach | SS | works | opened dialog/menu; dom Δ2947 |
| /teach | Send application | covered in journey |  |

### DEL platform instructor (courses@del.example)

| Page | Control | Result | Evidence |
|---|---|---|---|
| /studio | Switch light or dark theme | works | theme/class |
| /studio/courses | Switch light or dark theme | works | theme/class |
| /studio/courses | New course | works | opened dialog/menu; dom Δ1763 |
| /studio/sales | Switch light or dark theme | works | theme/class |
| /studio/sales | 7 days | works | dom Δ-3570 |
| /studio/sales | 30 days | no visible effect – default – expected |  |
| /studio/sales | 90 days | works | dom Δ8729 |
| /studio/sales | 12 months | works | dom Δ-5899 |
| /studio/payouts | Switch light or dark theme | works | theme/class |
| /studio/profile | Switch light or dark theme | works | theme/class |
| /studio/profile | Save profile | covered in journey |  |

### Independent instructor (nadia@instructor.example)

| Page | Control | Result | Evidence |
|---|---|---|---|
| /studio | Switch light or dark theme | works | theme/class |
| /studio/courses | Switch light or dark theme | works | theme/class |
| /studio/courses | New course | works | opened dialog/menu; dom Δ1763 |
| /studio/courses/‹aiops›?step=details | Switch light or dark theme | works | theme/class |
| /studio/courses/‹aiops›?step=details | Remove what learners will learn 1 | covered in journey |  |
| /studio/courses/‹aiops›?step=details | Remove what learners will learn 2 | covered in journey |  |
| /studio/courses/‹aiops›?step=details | Remove what learners will learn 3 | covered in journey |  |
| /studio/courses/‹aiops›?step=details | Add another | works | dom Δ590 |
| /studio/courses/‹aiops›?step=details | Remove requirements 1 | disabled (correct state) |  |
| /studio/courses/‹aiops›?step=details | Choose a category AI Foundations AI for DevOps CI/CD & GitOp | no visible effect |  |
| /studio/courses/‹aiops›?step=details | Beginner Intermediate Advanced | no visible effect |  |
| /studio/courses/‹aiops›?step=details | English French Spanish German Portuguese Italian Dutch Arabi | no visible effect |  |
| /studio/courses/‹aiops›?step=details | Save | covered in journey |  |
| /studio/courses/‹aiops›?step=details | Save and continue | covered in journey |  |
| /studio/courses/‹aiops›?step=media | Switch light or dark theme | works | theme/class |
| /studio/courses/‹aiops›?step=media | Choose file | no visible effect – opens OS file picker (tested via journey upload – works) |  |
| /studio/courses/‹aiops›?step=media | Save and continue | covered in journey |  |
| /studio/courses/‹aiops›?step=curriculum | Switch light or dark theme | works | theme/class |
| /studio/courses/‹aiops›?step=curriculum | Move section up | disabled (correct state) |  |
| /studio/courses/‹aiops›?step=curriculum | Move section down | works |  |
| /studio/courses/‹aiops›?step=curriculum | Delete section | covered in journey |  |
| /studio/courses/‹aiops›?step=curriculum | What AIOps really means Preview Ready | works | dom Δ3404 |
| /studio/courses/‹aiops›?step=curriculum | Move “What AIOps really means” up | disabled (correct state) |  |
| /studio/courses/‹aiops›?step=curriculum | Move “What AIOps really means” down | works |  |
| /studio/courses/‹aiops›?step=curriculum | Signals: metrics, logs, traces Preview Ready | works | dom Δ3404 |
| /studio/courses/‹aiops›?step=curriculum | Move “Signals: metrics, logs, traces” up | works |  |
| /studio/courses/‹aiops›?step=curriculum | Move “Signals: metrics, logs, traces” down | disabled (correct state) |  |
| /studio/courses/‹aiops›?step=curriculum | Lecture type | no visible effect |  |
| /studio/courses/‹aiops›?step=curriculum | Add lecture | covered in journey |  |
| /studio/courses/‹aiops›?step=curriculum | Explaining an alert Ready | works | dom Δ3419 |
| /studio/courses/‹aiops›?step=curriculum | Move “Explaining an alert” up | disabled (correct state) |  |
| /studio/courses/‹aiops›?step=curriculum | Move “Explaining an alert” down | works |  |
| /studio/courses/‹aiops›?step=curriculum | Human in the loop Ready | works | dom Δ3419 |
| /studio/courses/‹aiops›?step=curriculum | Move “Human in the loop” up | works |  |
| /studio/courses/‹aiops›?step=curriculum | Move “Human in the loop” down | disabled (correct state) |  |
| /studio/courses/‹aiops›?step=curriculum | Add section | covered in journey |  |
| /studio/courses/‹aiops›?step=curriculum | Save and continue | covered in journey |  |
| /studio/courses/‹aiops›?step=pricing | Switch light or dark theme | works | theme/class |
| /studio/courses/‹aiops›?step=pricing | Free | no visible effect – tested: works (value only changes input) |  |
| /studio/courses/‹aiops›?step=pricing | $19.99 | works | dom Δ3 |
| /studio/courses/‹aiops›?step=pricing | $29.99 | works | dom Δ3 |
| /studio/courses/‹aiops›?step=pricing | $49.99 | works | dom Δ3 |
| /studio/courses/‹aiops›?step=pricing | $79.99 | works | dom Δ3 |
| /studio/courses/‹aiops›?step=pricing | $99.99 | works | dom Δ3 |
| /studio/courses/‹aiops›?step=pricing | $129.99 | works | dom Δ5 |
| /studio/courses/‹aiops›?step=pricing | Save | covered in journey |  |
| /studio/courses/‹aiops›?step=pricing | Save and continue | covered in journey |  |
| /studio/courses/‹aiops›?step=submit | Switch light or dark theme | works | theme/class |
| /studio/courses/‹aiops›?step=submit | Submit for review | disabled (correct state) |  |
| /studio/sales | Switch light or dark theme | works | theme/class |
| /studio/sales | 7 days | works | dom Δ-3570 |
| /studio/sales | 30 days | no visible effect – default – expected |  |
| /studio/sales | 90 days | works | dom Δ8729 |
| /studio/sales | 12 months | works | dom Δ-5899 |
| /studio/students | Switch light or dark theme | works | theme/class |
| /studio/students | Filter by course | works | dom Δ-3153 |
| /studio/reviews | Switch light or dark theme | works | theme/class |
| /studio/reviews | All | no visible effect – default – expected |  |
| /studio/reviews | Needs a reply | covered in journey |  |
| /studio/reviews | Reply publicly | covered in journey |  |
| /studio/payouts | Switch light or dark theme | works | theme/class |
| /studio/payouts | Set up payouts with Stripe | ERROR | POST onboarding-link → 503 (Stripe not configured); error toast shown |
| /studio/profile | Switch light or dark theme | works | theme/class |
| /studio/profile | Save profile | covered in journey |  |

### Super admin (admin@del.example)

| Page | Control | Result | Evidence |
|---|---|---|---|
| /admin | Switch light or dark theme | works | theme/class |
| /admin/review | Switch light or dark theme | works | theme/class |
| /admin/courses | Switch light or dark theme | works | theme/class |
| /admin/courses | Status | works |  |
| /admin/courses | Unpublish | covered in journey |  |
| /admin/instructors | Switch light or dark theme | works | theme/class |
| /admin/instructors | Applications (0) | no visible effect – default tab, empty – expected |  |
| /admin/instructors | All instructors | works | dom Δ1610 |
| /admin/users | Switch light or dark theme | works | theme/class |
| /admin/users | student | sr-only checkbox (label clickable); role change = journey |  |
| /admin/users | instructor | sr-only checkbox (label clickable); role change = journey |  |
| /admin/users | admin | sr-only checkbox (label clickable); role change = journey |  |
| /admin/users | super admin | sr-only checkbox (label clickable); role change = journey |  |
| /admin/users | Suspend | covered in journey |  |
| /admin/orders | Switch light or dark theme | works | theme/class |
| /admin/categories | Switch light or dark theme | works | theme/class |
| /admin/categories | Delete AI Foundations | covered in journey |  |
| /admin/categories | Delete AI for DevOps | covered in journey |  |
| /admin/categories | Delete CI/CD & GitOps | covered in journey |  |
| /admin/categories | Delete MCP & Agents | covered in journey |  |
| /admin/categories | Delete Cloud AI (AWS & Azure) | covered in journey |  |
| /admin/categories | Delete Automation (n8n) | covered in journey |  |
| /admin/categories | Add | no visible effect – empty name → silent no-op (P2) |  |
| /admin/settings | Switch light or dark theme | works | theme/class |
| /admin/settings | Save commission | covered in journey |  |
| /admin/audit | Switch light or dark theme | works | theme/class |
| /admin/audit | Details | works | dom Δ84 |
