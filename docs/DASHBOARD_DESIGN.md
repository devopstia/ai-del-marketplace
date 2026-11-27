# Dashboard design system (Option A · Enterprise Analytics)

Owner, 2026-11-27: chose **Option A · Enterprise Analytics** from three prototypes
(`docs/research/dashboards/options-2026-11-27.html`). Every dashboard (Student, Instructor, DEL Studio, Admin, Super
Admin) uses these components and rules; **no dashboard builds its own figures, charts or empty boxes**. Phase 1
(2026-11-27): components + the Instructor / DEL Studio dashboard (`/studio`). Phases 2–3 (Student, Admin and Super
Admin) follow after the owner reviews phase 1 (AGENTS.md rule 12: front end in small steps).

## Look
- Numbers first, dense and ordered, like a financial dashboard: a joined **KPI strip** at the top, then the main
  **time chart** beside ranked lists, then the full-width **table**, then supporting panels in two even columns.
- DEL tokens only (`apps/web/src/app/globals.css`): surfaces `bg-surface` on `bg-paper`, `border-line`, text
  `text-ink`/`text-ink-2`/`text-muted`; series colours **violet = primary (gross)**, **cyan = secondary (net)**; good
  change `text-mint`, bad `text-rose`; stars `text-star`. Light and dark are both first-class (rule 16).
- Panels: `rounded-tile`, 1px line, no shadows, no nested panels, no accent bars. Columns in a row end together
  (`items-stretch`); a short panel never leaves a hole next to a tall one.
- Figures: Schibsted Grotesk extra-bold, tabular numbers, `whitespace-nowrap`; labels in sentence case.
- Sizes: 390 / 768 / 1440 / 1920 with no sideways page scroll; wide tables scroll inside their own box.

## Components (`apps/web/src/components/dashboard/`)
| Component | Use |
|---|---|
| `KpiStrip` (`Kpi`, `Change`) | 2–6 headline figures in one band; each may compare with the previous period: ▲/▼ %, "new" (nothing before), "—" (nothing either time), `inverse` for figures where a fall is good (fees, refunds) |
| `RangePicker` (`RangeValue`, `rangeLabel`) | Today, 7 days, 30 days, 90 days, This month, This year, Custom (two dates + Apply). Keep the value in the URL (`?range=30d`, `?range=custom&from=…&to=…`) so a view can be shared and survives reloads |
| `TimeChart` | One area series (A) + one line series (B) on one scale; groups days → weeks (> 45 days) → months (> 140); hover or ←/→ on the focused chart shows exact values; draws at real pixel size (ResizeObserver); summary for screen readers |
| `BarList` | Ranked label + bar + value (value in its own column) |
| `DataTable` (`Column`) | Sortable (click/Enter on a header), searchable, `aria-sort`; scrolls sideways inside itself on phones |
| `ActivityFeed` | Newest events: dot by kind (purchase, enrolment, review, certificate, refund, course), one line + detail + time |
| `Panel` | Title row with an optional link or actions; the only container a dashboard uses |
| `EmptyNote`, `ErrorNote`, `PanelSkeleton` | The four states must look different: **loading** (shimmer the size of the content), **zero** (the figure 0 / $0.00 is shown as a value), **no data** (one dashed line with a reason and, if useful, one action; never a big empty box), **error** (rose line with "Try again") |

## Data rules
- Real records only. Never sample, placeholder or estimated figures in a dashboard; a figure that can't be computed is
  left out, not invented.
- Money comes from the order-line snapshots taken at purchase (`order_lines.priceCents`, `feeCents`,
  `instructorShareCents`, `refundedAt`), never today's course price. Gross = every paid line; refunds = price of
  refunded lines; fees = Stripe's fee on every line (kept by Stripe after a refund); **net = gross − fees − refunds**.
- Ownership decides the headline (reporting only; the split itself never changes here):
  - `platform` (DEL Studio, DEL's own courses) and `del_agreement` (an instructor whose share DEL keeps): **DEL net
    revenue**. A DEL course with no separate instructor share must never read as "$0 earnings".
  - `revenue_share` (independent instructors, Official DEL instructors included: their own share and Stripe account):
    **Your earnings** (instructor share of lines not refunded), plus pending and paid payouts.
- Learners are named by first name only; never emails on a dashboard.

## Endpoints
- `GET /api/instructor/dashboard?range=today|7d|30d|90d|month|year|custom[&from=YYYY-MM-DD&to=YYYY-MM-DD]`
  (`apps/api/src/instructor/dashboard.service.ts`, helpers + tests `dashboard.ts`/`dashboard.spec.ts`, e2e in
  `test/app.e2e-spec.ts` "dashboard: …"). One account (the instructor, or DEL in DEL Studio). Returns `ownership`,
  `range`, `current` and `previous` (gross, fees, refunds, net, instructor share, sales, enrolments, active students),
  a daily `series` (every day, zeros included), `payouts` (revenue share only), `catalogue` (published, drafts,
  rating, completion), `students` (total, active, average progress, completion rate, quiz average, certificates),
  `courses` (per-course figures for the range), `reviews` (latest 4) and `activity` (latest 8 events). UTC days;
  previous period = the same number of days just before; custom ranges are capped at 731 days.
- Definitions: **active students** = learners whose lesson progress changed in the range; **average progress** = mean of
  completed lessons ÷ lessons per enrolled learner; **completion rate** = certificates ÷ current enrolments (a certificate
  is issued only when every lesson is complete); **quiz average** = mean score of quiz attempts in the range. The
  account's own viewing is excluded everywhere.
- Not computed yet (left out of the UI): watch time per period, revenue in other currencies (USD only today), per-day
  active learners.

## Pages
| Page | Status |
|---|---|
| `/studio` Instructor / DEL Studio | Phase 1, Option A (KPI strip; revenue chart + catalogue figures beside revenue by course and activity; course table; students + reviews) |
| `/student` Student | Phase 2, pending the owner's review of phase 1 |
| `/admin` Admin and Super Admin | Phase 3, pending |
