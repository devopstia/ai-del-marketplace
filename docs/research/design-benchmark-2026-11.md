# Design benchmark: e-learning platforms, visual and UX layer (2026-11)

Prepared 2026-11-24 for DevOps Easy Learning (DEL). This complements `docs/research/competitor-benchmark-2026-11.md`, which covers
features, pricing and revenue share; none of that is repeated here.

**Method.** Live pages were fetched as text (WebFetch) on 2026-11-24, plus official help centres, design-system docs, design-team posts,
Baymard Institute, Nielsen Norman Group (NN/g), the FTC, and peer-reviewed research. **Limits, stated plainly:**
- Text fetches show structure, copy and metadata but **not** pixel sizes, exact colours or rendered typography. No measurements
  below were taken from screenshots, and no screenshots were made.
- `udemy.com`, `about.udemy.com`, `teach.udemy.com` and `design.udemy.com` returned **HTTP 403** to automated fetches. Udemy
  observations therefore come from Udemy's help centre, search-result snippets, and lawsuit and complaint documents. Anything about
  Udemy's live layout from general knowledge is marked **[unverified]**.
- Font and colour claims from unofficial "design extraction" sites are marked **[unverified]**.
- Frontend Masters renamed itself **Master.dev** on 15 June 2026 ([announcement](https://frontendmasters.com/blog/today-frontend-masters-becomes-master-dev/)).
  Its pages are cited under the new domain.

---

## 1. Homepage and hero

| Platform | Above the fold (observed) | Credibility devices | Weak spots |
|---|---|---|---|
| **Coursera** (signed out) | Header with audience switch (Individuals / Businesses / Universities / Governments), a short headline "Learn without limits", then a **3-slide promo carousel** (Black Friday Plus at $239/yr, AI Series, Teams 40% off) ([coursera.org](https://www.coursera.org/)) | Logo strip "Learn from 350+ leading universities and companies" (Google, IBM, Stanford, OpenAI, Anthropic…); an outcome stat ("91% of learners achieved a positive career outcome"); named testimonials with headshots; FAQ | The promo carousel appears **twice** on the page, and the hero is mostly discount banners. The intent selector ("What brings you to Coursera today?") is buried at section 12 of 17 |
| **LinkedIn Learning** (signed out) | Headline "Develop skills that move your career forward", two CTAs ("Start my free month" / "Buy for my team"), one image ([linkedin.com/learning](https://www.linkedin.com/learning/)) | "78% of Fortune 100" claim, six client logos, concrete catalogue stats (26,800 courses, 3,900+ experts), testimonials naming employers | Rails of near-identical "Trending" cards behind tabs |
| **Maven** | Small kicker + headline "Learn from real-world experts on Maven". **No hero image and no hero CTA.** Content starts immediately: a ranked "Trending this week" list ([maven.com](https://maven.com/)) | Instructor **headshots and employer credentials** on every card ("ex-Google", eBay); real sign-up counts on free lessons ("628 signed up"); ratings shown only where they exist | Many horizontal card rows |
| **KodeKloud** (closest DevOps peer) | Countdown banner for Black Friday; headline "Build. Break Fix. Learn."; three CTAs; "No Credit Card / Instant Labs / Start Free"; "1M+ Enrolled" ([kodekloud.com](https://kodekloud.com/)) | Named trainers with roles, "4.8 out of 5" from about 900 reviews, enterprise logo strip, Discord 50,000+ | **On the fetch date the countdown read zero and said the sale had ended, but the banner was still showing.** The page has 13 sections and the hero has three competing CTAs |
| **Master.dev** | "Master Full Stack. Build with AI" ([search summary](https://master.dev/)) | Instructor photo **plus employer** on every course card (Netflix, Microsoft, Vercel) ([master.dev/courses](https://master.dev/courses/)) | Very long catalogue page |
| **egghead** | One plain-language headline, "Bite-Sized Screencasts for Web Developers that Hate Long Boring Videos", then a grid of tool logos and a long mixed "Feed" list ([egghead.io](https://egghead.io/)) | Named instructors on every item; a numbered newsletter series shows steady publishing | No ratings or learner counts at all |
| **Udemy** | Udemy calls its logged-out homepage its "front door… for many new learners it's their first impression of Udemy" ([teach.udemy.com](https://teach.udemy.com/homepage-unification/), snippet) | Large course rails with ratings and counts [unverified] | Strike-through prices and a homepage countdown are the subject of a class action alleging it "continues to display 'ends in 0s'" after expiry ([classaction.org](https://classaction.org/news/inherently-misleading-lawsuit-alleges-udemy-advertises-videos-at-false-discounts-to-generate-sales), [complaint PDF](https://www.classaction.org/media/williams-v-udemy-inc.pdf)); these are allegations only |

**Signed-in variants.** Udemy Business widened its "continue learning" section so learners can resume where they left off
([Udemy blog](https://blog.udemy.com/a-more-personalized-learning-experience-september-product-updates/)). Coursera's April 2025
career discovery asks a short quiz (current role, target role), then shows **one** highlighted "top recommendation" with a "Why was
this recommended for me" explanation ([Coursera blog](https://blog.coursera.org/from-catalog-to-compass)). In both, the
signed-in home starts with the learner's next action, not with marketing.

**Patterns that read as professional:**
- The headline is short and literal (Coursera's "Learn without limits", egghead's plain sentence).
- Real faces with **verifiable employers** beat abstract art.
- The first thing below the hero is **content**: Maven puts a ranked list there.
- Evidence takes the form of specific numbers ("628 signed up", "26,800 courses").

**Hero carousels.** NN/g finds that people "often immediately scroll past these large images and miss all of the content within
them", that animated content drew attention only about 27% of the time, and that a static hero "may be less likely to distract"
([NN/g carousels](https://www.nngroup.com/articles/designing-effective-carousels/)). Coursera's hero carousel is the weakest part of
its page. DEL's approved hero slider (commit 9b0170e) should follow NN/g's rules if it stays: ≤5 frames, no auto-advance on mobile,
clear frame indicators, and key content repeated elsewhere on the page.

---

## 2. Discovery, catalogue and search

- **Coursera course cards and results** carry partner logo, rating, level and duration [unverified, cards not in the text capture].
  Coursera is moving discovery from the catalogue to role-based paths: 60 roles, plus salary and job data localised for 39
  countries ([Coursera blog](https://blog.coursera.org/from-catalog-to-compass)).
- **Master.dev**: card rows grouped by topic, each with "View more". There are about 60 icon topic filters, and the URL carries a
  sort (`so=date`, `so=popularity`). Each card shows thumbnail, title, instructor photo, name and affiliation. Version numbers
  ("v3", "v4") in titles signal freshness ([master.dev/courses](https://master.dev/courses/)). Learning paths are promoted at the top
  ("Not sure where to start? Check out our Learning Paths!").
- **LinkedIn Learning cards**: type label, title, **run time** ("1h 17m") and **viewer count**, each rail followed by plain text
  topic links ([linkedin.com/learning](https://www.linkedin.com/learning/)).
- **egghead**: one card pattern reused for courses, tools and feed items, plus a long vertical feed list ([egghead.io](https://egghead.io/)).
- **Filters (Baymard).**
  - Users apply **5–6 filters on average**, some up to 10.
  - About 15% of sites don't allow several values within one filter type.
  - Users expect AND logic *across* filter types and OR logic *within* one type, and checkboxes signal multi-select.
  - On mobile, single-select filters without a summary of active filters force extra round trips.
  - Source: [Baymard](https://baymard.com/blog/allow-applying-of-multiple-filter-values).
- **Cards vs lists (NN/g).** Cards suit heterogeneous browsing. They "are not appropriate when users search for a specific item" or
  compare homogeneous items, and a list or table works better there ([NN/g cards](https://www.nngroup.com/articles/cards-component/)).
  A results page of similar courses is homogeneous. A **list row** (thumbnail, title, instructor, duration, level, rating, price)
  compares better than a 4-up grid.

---

## 3. Course detail page

**Coursera** ([machine-learning page](https://www.coursera.org/learn/machine-learning)):
- **Above the fold**: title with programme context ("part of the Machine Learning Specialization"), partner logos, lead instructor
  with a "Top Instructor" badge, "4.9 (33,040 reviews)", "1,274,517 already enrolled", a "Enroll for free / Starts Nov 24" CTA, and
  a financial-aid link.
- **Fact strip**: "3 modules · Beginner level · Flexible schedule · 3 weeks at 10 hours a week".
- **Anchor tabs**: About · Outcomes · Modules · Testimonials · Reviews.
- **Skills**: "Skills you'll gain" and "Tools you'll learn" as tag lists, plus a "Details to know" block (certificate,
  assignments, languages, "98% Most learners liked this course").
- **Modules**: week rows with hours and an expandable "What's included" (videos, readings, labs).
- **Reviews**: aggregate score, star-distribution bars, three dated reviews, then "View more".

**Master.dev** ([javascript-hard-parts-v3](https://master.dev/courses/javascript-hard-parts-v3/)):
- **Above the fold**: title, one-line scope, thumbnail with a "Course Preview" button, rating, and **one named testimonial**.
- **Stats**: "54 lessons · 9.7 hours · 4.9 · Certificate", then six learning outcomes.
- **Instructor block** ("Your (Awesome) Instructor"): photo, current role, LinkedIn and website links, credential cards.
- **Curriculum**: eight modules with durations (total 9 h 43 m) and an explicit **prerequisite** link.
- **Player and certificate**: it sells the player ("note-taking beside transcripts", quizzes, flashcards) and shows a certificate
  sample. There is no visible price, no countdown and no urgency.

**Maven** ([startup-engineering](https://maven.com/maven-engineering/startup-engineering)):
- **Sequence**: Hosted by (avatars + one-line credentials) → overview → **"Who this course is for"** (three personas) → key
  outcomes → "See what people are saying" (five testimonials with name, title, employer) → "Meet your instructor" (full bios with
  LinkedIn) → "Course schedule" → FAQ (refund until end of week 1).

**Udemy** (help centre only, live page 403):
- **Bio**: the instructor bio shows on both the profile and the course landing page
  ([Udemy help](https://sgsau.zendesk.com/hc/en-us/articles/900003253046)).
- **Urgency**: a 2020 Deceptive Patterns report records a discounted price that reverted "as soon as I clicked buy now or log in"
  ([deceptive.design](https://deceptive.design/articles/udemy-advertising-unobtainable-price)).
- **From general knowledge, [unverified]**: a dark title band with a sticky right-hand purchase card (price, strike-through, "x
  hours left at this price", "Add to cart", "Buy now", 30-day guarantee, "This course includes" list), "What you'll learn" in two
  columns, and an accordion curriculum showing lecture counts and durations.

**Baymard on product pages.**
- Only 48% of desktop and 38% of mobile sites reach "decent" or better product-page UX.
- 67% show no total cost estimate near the buy section, and 44% don't show the return policy on the product page.
- 89% don't answer negative reviews.
- Several small issues together lose sales more often than one severe issue.
- Source: [Baymard](https://baymard.com/blog/current-state-ecommerce-product-page-ux).
- In course terms: show final price with tax handling, the refund policy, and instructor replies to critical reviews right on the
  page.

---

## 4. Video player and learning view

- **Udemy**:
  - Curriculum and Notes open from icons at the top right in the new player.
  - Clicking a note's timestamp seeks the video; others see *where* notes were made but not their text.
  - Subtitles sit on a CC button, separate from Transcript.
  - Sources: [Udemy help, player](https://support.udemy.com/hc/en-us/sections/206457187-Course-player),
    [transcripts](https://business-support.udemy.com/hc/en-us/articles/360009110254-Transcripts-to-reinforce-and-supplement-learning),
    [shortcuts](https://business-support.udemy.com/hc/en-us/articles/360045846354-How-to-use-keyboard-shortcuts).
- **Master.dev** markets "note-taking beside transcripts", progress tracking and quizzes or flashcards as first-class player
  features ([course page](https://master.dev/courses/javascript-hard-parts-v3/)).
- **Side-panel convergence.**
  - Maven Analytics' Nov 2025 player has a right-hand menu (search, discussions, notes, bookmarks, resources)
    ([help](https://help.mavenanalytics.io/en/articles/12713854-navigating-the-course-player)).
  - CFI opens AI chat in a sidebar ([CFI](https://help.corporatefinanceinstitute.com/article/1237-course-player-update-march-2025)).
  - DataCamp puts its AI Coach beside the Transcript tab ([DataCamp](https://support.datacamp.com/hc/en-us/articles/38381206241175-What-is-the-AI-Coach-in-Video-lessons)).
  - The pattern is **one collapsible right rail with tabs**, not several floating panels.
- **Usability and accessibility.**
  - NN/g saw viewers repeatedly hover the controls to check time remaining ([NN/g video usability](https://nngroup.com/articles/video-usability)).
  - Adrian Roselli's review found mobile and fullscreen controls that faded and dropped keyboard focus
    ([review](https://adrianroselli.com/2023/09/browser-video-players-review.html)).
  - In DEL terms: keep elapsed and remaining time visible, keep controls in the focus order, and test fullscreen on 390 px.
- **DEL's existing rule** (captions off by default, CC toggle, no permanent transcript panel) matches the Udemy split of CC and
  Transcript and needs no change.

---

## 5. Student dashboard ("My learning")

- **Teachable's student dashboard** ([Teachable help](https://intercom.help/teachableknowledgebase/en/articles/11691026-student-dashboard)):
  - "Jump back in": up to 4 in-progress courses, highest progress first.
  - "My library": up to 4 items.
  - "Completed courses": shown only after one completion.
  - "Explore additional products": up to 2 items.
  - **Sections appear only when relevant**, so the page never shows empty headers.
- **Udemy Business** enlarged "continue learning" ([Udemy blog](https://blog.udemy.com/a-more-personalized-learning-experience-september-product-updates/)).
- **Coursera** shows one top recommendation with an explanation ([Coursera blog](https://blog.coursera.org/from-catalog-to-compass)).
- **Pattern**: one dominant "resume" item with the exact next lesson and progress, a short library list, and at most one
  recommendation. Streak counters and badge walls appear in none of the primary sources reviewed.
- **Empty states (NN/g)**: well-designed empty states "increase user confidence, improve system learnability, and help users get
  started with key tasks quickly" ([NN/g](https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/)).
  A new student with nothing in progress should see one clear next step (start the free preview of AI for DevOps), not empty boxes.

---

## 6. Instructor portal and dashboard

- **Udemy Performance**:
  - **Overview**: total and monthly revenue, enrolments (overall or per course), and a rolling-period average rating weighted by
    recency and by how much of the course the student had watched.
  - **Other pages**: Students, Reviews, Engagement, and Traffic & conversion (with source caveats). A Udemy Business tab filters
    each metric. Mobile gets revenue and enrolments per course.
  - Sources: [Udemy help](https://support.udemy.com/hc/articles/360007889294), [traffic](https://support.udemy.com/hc/en-us/articles/360007889414-Performance-Traffic-Conversion-Page),
    [teach.udemy.com](https://teach.udemy.com/publishing/using-your-dashboard/).
- **Kajabi** redesigned its dashboard in early 2025 around "real-time key business metrics on the home screen", then added a
  customisable dashboard and 10+ reports ([Kajabi updates](https://www.kajabi.com/updates?80816aa3_page=4)).
- **Thinkific** rebuilt its creator UI on a standard design system ([Thinkific 2018](https://www.thinkific.com/blog/thinkific-update-august-2018))
  and now adds AI summaries across dashboards ([updates](https://www.thinkific.com/updates/)).
- **Maven** course creation is coached around a weekly syllabus ([Maven help](https://help.maven.com/en/articles/5597459-syllabus)).
- **Pattern**:
  - The home shows a few headline numbers with comparison, then drill-down pages by topic.
  - Revenue, students, reviews and traffic are **separate pages**, not one overloaded screen.
  - This matches DEL rule 6.

---

## 7. Checkout and cart

**Baymard on abandonment.** The average documented rate is **70.22%** (mean of 50 studies). Excluding "just browsing", the reasons
are ([Baymard](https://baymard.com/lists/cart-abandonment-rate)):

| Reason | Share |
|---|---|
| Extra costs too high | 40% |
| Didn't trust the site with card details | 19% |
| Account creation required | 18% |
| Checkout too long or complicated | 17% |
| Site errors | 17% |
| Couldn't see the total cost up front | 12% |
| Not enough payment methods | 9% |

**Form length.** The average checkout has **11.3 form fields**, while "most sites need only 8"
([Baymard](https://baymard.com/blog/checkout-flow-average-form-fields)).

**Guest checkout.**
- 47–62% of sites fail to make guest checkout the most prominent option; the figure varies by benchmark year
  ([Baymard](https://baymard.com/blog/make-guest-checkout-prominent), [state of checkout](https://baymard.com/blog/current-state-of-checkout-ux)).
- Baymard says it is retesting its checkout research, with publication expected in Q2 2027.
- For digital goods an account is needed for access. The equivalent fix is **delayed account creation**: email first, password
  after payment ([Baymard](https://baymard.com/research-articles/delayed-account-creation)).

**In DEL terms:**
- Show tax-inclusive totals early, and a single-course "Buy now" that skips the cart.
- Keep the fields to email, card, and country for tax.
- Display recognised payment marks with refund terms next to the pay button.
- Never surprise anyone with fees.

---

## 8. Admin and operations consoles

- **Stripe's own Dashboard guidelines** ([Stripe Apps design](https://docs.stripe.com/stripe-apps/design)):
  - The Dashboard is organised into **Home** (overview that "routes them to core workflows"), **List pages** (activity across
    objects) and **Details pages** (one payment, customer or invoice).
  - Custom styling is "intentionally limited… to maintain platform consistency" and an accessible contrast bar.
  - Brand colour is allowed only in a small app indicator.
  - Contextual side-by-side views are the default; a blocking **FocusView** is reserved for start-to-finish tasks.
- **Third-party analyses** (not Stripe-authored):
  - Home surfaces about five key figures with sparklines, optimised for "decision speed rather than showing everything"
    ([925studios](https://www.925studios.co/blog/stripe-dashboard-design-breakdown)).
  - A counterpoint: Stripe's whitespace suits sparse per-object data, not dense monitoring
    ([codercops](https://blog.codercops.com/blog/designing-for-developers)).
- **NN/g on dashboards**: they are for fast consumption. Use **length and 2D position** (bars, lines) for quantities, keep bold colour
  for the one number that matters, and remember that emphasising everything emphasises nothing
  ([NN/g preattentive](https://www.nngroup.com/articles/dashboards-preattentive/)).
- **DEL admin model**: Home (5–6 KPIs with period comparison plus an "needs attention" queue: payouts, reports, refunds, failed
  webhooks) → List pages (users, courses, orders, payouts, audit log) as filterable tables → Details pages with a timeline. A single
  neutral palette, with colour used only for status.

---

## 9. Instructor public profile

- **Udemy**: header stats "Total learners" and "Reviews", then "About me", then a course list. The learner count deduplicates
  students across courses. Udemy redesigned profiles to add social links and an integrated course list
  ([Udemy help](https://support.udemy.com/hc/articles/360007994313), [example profile](https://www.udemy.com/user/faisal-memon-3/),
  [teach.udemy.com](https://teach.udemy.com/?p=34571)). The same "About me" text is reused on course pages.
- **Coursera** instructor block: "Top Instructor" badge, course count, instructor rating with count, "View all 4 instructors"
  ([Coursera](https://www.coursera.org/learn/machine-learning)).
- **Maven and Master.dev**: the credential line names **current or former employers**, with links to LinkedIn and a personal site
  ([Maven](https://maven.com/maven-engineering/startup-engineering), [Master.dev](https://master.dev/courses/javascript-hard-parts-v3/)).
- **KodeKloud** presents named trainers with titles on its homepage ([kodekloud.com](https://kodekloud.com/)).
- **DEL template**:
  1. Real photo, name, one-line role and employer.
  2. Verified-link row (LinkedIn, GitHub, site).
  3. Three honest stats: learners, rating with count, courses. Hide a stat while it is zero.
  4. A short bio written in the first person.
  5. Courses as a list.
  6. Optionally, recent reviews with instructor replies.

---

## 10. Presenting a small catalogue credibly

The single-course and few-course sites studied never look empty, because **one course is presented with depth instead of
breadth**:

- **Josh Comeau, CSS for JS Devs** ([css-for-js.dev](https://css-for-js.dev/)):
  - Headline "Stop wrestling with CSS." → a problem-framing essay → about 15 employer logos → long named testimonials.
  - "Hi, I'm Josh!" personal bio → curriculum with totals (200 lessons, 40 h) and 10 modules, each with a one-line description and
    three bullets → tiers.
  - Then about 80 short testimonials, about 25 FAQs, and a 30-day refund.
  - A public free module serves as proof.
- **Epic React, Kent C. Dodds** ([epicreact.dev](https://www.epicreact.dev/)):
  - "Updated for React 19" freshness badge → instructor face plus a "taught 30,000+" claim → teaching philosophy.
  - **Seven workshops, each with section and lesson counts**, presented as a progression from fundamentals to advanced.
  - A free 20-lesson tutorial, one Pro tier, a 30-day guarantee, and about 25 FAQs.
- **Master.dev course page**: concrete stats, a prerequisite link, a certificate sample and a player showcase fill the page
  without filler ([master.dev](https://master.dev/courses/javascript-hard-parts-v3/)).
- **Maven**: "Who this course is for" plus "Meet your instructor" plus the schedule make one cohort page complete
  ([maven.com](https://maven.com/maven-engineering/startup-engineering)).

**Transferable for "AI for DevOps"** (14 sections, previews from 4 of them):
1. Treat the 14 sections as a **visible learning path**, a numbered progression showing lesson counts and hours, the way Epic
   React lists its seven workshops.
2. Put the **free preview lessons** front and centre as proof.
3. Add a **"Who this is for / not for"** block.
4. Use **real, named** learner quotes; launch with none rather than invented ones.
5. Give **"Last updated" and version context** (tools covered, as of 2026-11).
6. Add a deep FAQ: refunds, prerequisites, labs, certificates, team purchase.
7. Add an "Instructors on DEL" band that shows *real* instructor profiles. Until there is a second instructor, a "Teach on DEL"
   invitation reads better than a sparse grid.
8. Don't build a multi-row catalogue rail for a single course: a lone card in a 4-up grid creates exactly the empty region the
   owner dislikes.

---

## 11. "Product team" vs "AI-generated template": testable traits

The research base:
- **Simple and familiar wins.** Tuch et al. (IJHCS 2012, Google/YouTube UX research) showed 119 real-site screenshots for 17–50 ms.
  Low visual complexity and high prototypicality ("simple and familiar") rated most appealing. Unfamiliar layouts were judged
  uglier "even if it's simple" ([Google Research blog](https://research.google/blog/users-love-simple-and-familiar-designs-why-websites-need-to-make-a-great-first-impression/),
  [paper](https://research.google/pubs/pub38315/)).
- **Aesthetics drives credibility.** On mobile, perceived aesthetics predicts perceived credibility more strongly than perceived
  usability (Oyibo & Vassileva, via [search summary](https://nngroup.com/articles/first-impressions-human-automaticity/) [unverified primary]).
- **Restraint.** NN/g's first-impressions guidance says to limit accent colours and fonts
  ([NN/g](https://nngroup.com/articles/first-impressions-human-automaticity/)).
- **Why the AI look exists.** Practitioner writing (not research) attributes it to models defaulting to the "statistical centre"
  of training data:
  - Inter everywhere.
  - Tailwind indigo-500 and the `#667eea → #764ba2` purple gradient.
  - Agents building only what is easy.
  - Sources: [DEV](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p),
    [925studios](https://www.925studios.co/blog/ai-slop-design-tells), [superdesign](https://superdesign.dev/blog/why-ai-design-looks-generic).
- **How products enforce it.** Pluralsight's Pando uses a custom variable font (PS Commons), DM Mono for code, and themed tokens
  with dark as the default ([Pando docs](https://pando-storybook.pluralsight.com/explanation/faq),
  [quick start](https://design.pluralsight.com/docs/learn/get-started/quick-start)). Stripe deliberately restricts colour per element
  ([Stripe](https://docs.stripe.com/stripe-apps/design)). Material sets an 8dp layout grid with type on 4dp
  ([Material spacing](https://material.io/design/layout/spacing-methods.html)).

Testable traits (each can be checked on a DEL screenshot):

| # | Product-team trait | AI-template tell |
|---|---|---|
| 1 | One accent colour used for actions and links only, with neutrals doing the rest (Coursera's single blue on every CTA and link [unverified: third-party extraction](https://www.shadcn.io/design/coursera)) | Several gradients, glows and a different accent per section |
| 2 | Real photos of named instructors with employers (Maven, Master.dev) | Abstract blobs, 3D shapes, stock "laptop" imagery |
| 3 | Concrete numbers: "54 lessons · 9.7 hours", "628 signed up" | Vague claims ("Unlock your potential", "Join thousands") |
| 4 | A type scale of about 5–6 sizes, with one display size used once per page | A heading the size of the viewport in every section |
| 5 | Spacing on a 4/8 px grid, with section rhythm varying by content | Identical 96–128 px gaps around every block |
| 6 | Layout fitted to the content: lists for comparable items, a table for data, cards only for mixed content (NN/g) | The same three- or four-up icon-card grid repeated in every section |
| 7 | Content starts just below a short hero (Maven) | Hero → feature cards → feature cards → CTA band, with nothing real |
| 8 | Trust that can be verified: named testimonials with role and company, partner logos, dated reviews | Anonymous five-star quotes, "Trusted by 10,000+" with no source |
| 9 | Empty states that point to the next step, and sections hidden until they have data (Teachable) | Placeholder rows, "Coming soon" tiles, zero-value stat cards |
| 10 | Microcopy specific to the domain ("Starts Nov 24", "3 weeks at 10 hours a week") | Generic verbs ("Get started", "Explore") on every button |
| 11 | Motion only for feedback and state changes | Fade-up on scroll for every block, floating gradients |
| 12 | Version and freshness signals ("v3", "Updated for React 19") | No date anywhere |

---

## 12. Weaknesses a newcomer can avoid

1. **Fake urgency and reference prices.**
   - The FTC's *Bringing Dark Patterns to Light* (2022) calls out countdown timers that "just go away or reset" and baseless
     scarcity claims ([FTC PDF](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf),
     [summary](https://www.deceptive.design/articles/the-ftc-zeroes-in-on-fake-countdown-clocks-and-pre-checked-boxes)).
   - The UK CMA warns that untrue urgency and price-reduction claims are misleading
     ([CMA](https://competitionandmarkets.blog.gov.uk/2023/03/31/urgency-and-price-reduction-claims-are-your-online-tactics-legal/)).
   - Udemy faces a class action over this (allegations) ([classaction.org](https://classaction.org/news/inherently-misleading-lawsuit-alleges-udemy-advertises-videos-at-false-discounts-to-generate-sales)).
   - KodeKloud was showing an expired zero-countdown banner on 2026-11-24 ([kodekloud.com](https://kodekloud.com/)).
2. **Promo-led heroes and duplicated carousels.** Coursera's hero is mostly discount tiles, and the promo carousel repeats lower down
   ([coursera.org](https://www.coursera.org/)). NN/g's carousel evidence is in section 1.
3. **Too many homepage sections and competing CTAs.** KodeKloud has 13 sections and three hero CTAs; Coursera has 17 sections.
   This raises visual complexity, which Tuch et al. tie to lower appeal.
4. **Sitewide promo bars on course pages.** Coursera ("Ends soon: Get Coursera Plus…") and edX ("save up to 20%… promo code")
   ([edX](https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science)) put them above the
   course itself.
5. **Ambiguous social proof.** Udemy course listings show *ratings* counts next to stars while profiles show *learners*, which
   confuses even instructors ([Udemy community](https://community.udemy.com/t5/First-time-course-creation/Number-of-students/m-p/125465)).
6. **Unanswered negative reviews.** 89% of sites don't reply to them ([Baymard](https://baymard.com/blog/current-state-ecommerce-product-page-ux)).
7. **Checkout friction.** Hidden costs, forced accounts and 11+ fields (section 7).
8. **Players that are inaccessible on mobile and fullscreen.** Controls drop focus ([Roselli](https://adrianroselli.com/2023/09/browser-video-players-review.html)).
9. **Single-select filters and filters that disappear** after one choice ([Baymard](https://baymard.com/blog/allow-applying-of-multiple-filter-values)).

---

## 13. Design principles for DEL (actionable, evidence-tied)

1. **Simple and familiar beats novel.** Use conventional placements (logo left, search and nav, sticky buy box on the right of
   course detail) and spend originality on content, not layout. *Evidence: Tuch et al. 2012.*
2. **One accent colour.** Keep the existing DEL brand colour for primary actions and links only. Use semantic green, amber and red
   only for status, with no gradients or glows. *Evidence: NN/g first impressions; Stripe limits colour per element.*
3. **Few type sizes.** Use about 6 steps (for example 12/14/16/20/28/40 px at desktop). Allow one display size per page, and size
   section headings to the content, not the viewport. *Evidence: Pando and Material token systems; owner rule 14.*
4. **8 px spacing rhythm** (4 px for fine alignment). Section spacing scales with importance rather than one huge constant gap,
   which removes empty bands. *Evidence: Material spacing methods.*
5. **Match the layout to the content.** Lists or tables for comparable courses, orders and payouts; cards only for mixed content;
   avoid repeated identical card grids. *Evidence: NN/g cards; owner's dislike of rectangle grids.*
6. **Real people, verifiable credentials.** Every instructor appears with photo, role, employer and links; never use stock or
   abstract imagery for people. *Evidence: Maven, Master.dev, Coursera instructor blocks.*
7. **Concrete numbers, honestly shown.** Lessons, hours, last-updated date, and rating *with* count. Hide any metric that is zero
   or not meaningful yet, and never invent counts. *Evidence: Master.dev and Coursera stat strips; owner rule 4.*
8. **No fake urgency, ever.** Any sale shows a real end date, the timer matches it, and the banner disappears when it ends. Prefer
   no timers at all. *Evidence: FTC 2022, CMA 2023, Udemy class action.*
9. **Depth over breadth for one course.** Present AI for DevOps as a numbered 14-section path with hours, free previews first,
   "Who it's for / not for", prerequisites, refund policy and FAQ. *Evidence: Epic React, CSS for JS, Master.dev, Maven.*
10. **Static hero, content right below it.** If the approved slider stays: ≤5 frames, visible indicators, pause on interaction, no
    auto-advance on mobile, key messages repeated elsewhere. *Evidence: NN/g carousels; Maven's content-first home.*
11. **Course detail buy box shows the whole cost and the policy**: final price, refund terms, what's included, one primary CTA.
    *Evidence: Baymard (67% and 44% failures; 12% abandon over unclear totals).*
12. **Short checkout**: Buy now without a cart for single courses, email before password, 8 fields or fewer, trust marks next to
    pay. *Evidence: Baymard 70.22% abandonment, 18% forced account, 19% card distrust.*
13. **Player: one collapsible right rail** (Curriculum · Notes · AI assistant · Transcript tabs). Captions off by default with a CC
    toggle, time always visible, and keyboard-reachable controls in fullscreen and on 390 px. *Evidence: Udemy, Maven Analytics,
    DataCamp, NN/g, Roselli; DEL rule 11.*
14. **Dashboards lead with the next action.** Student: one "resume" item plus a short library, sections hidden until relevant.
    Instructor: a few KPIs with comparison, then separate Revenue, Students, Reviews and Traffic pages. Admin: Stripe's Home → List
    → Details model with an attention queue. *Evidence: Teachable, Udemy Performance, Stripe, NN/g preattentive.*
15. **Empty states are designed screens**: one sentence, one action, no fake rows. *Evidence: NN/g empty states.*

---

## Open items, not verified in this pass
- Udemy's live course page, cart and checkout layout (403 to automated fetch). Check manually in a browser at 390, 1440 and
  1920 px.
- Exact typefaces and colour values for Coursera, Udemy and LinkedIn Learning (only third-party extractions were found).
- edX course-detail body: the fetch returned only site chrome.
- Skillshare homepage: the URL returned 404 to the fetch.
- Pluralsight's learning-view layout, and Teachable's and Thinkific's current creator home screens (no primary 2026 source found).
