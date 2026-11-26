import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getRefundPolicy } from "@/lib/refund-policy-server";
import { pct } from "@/lib/refund-policy-shared";

// The numbers come from the refund policy in force (Super Admin › Refunds › Policy), so the page is always current.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({ title: "Access and refunds", description: "How long you can use a course you buy on DevOps Easy Learning, how renewal works, and when you can get a refund.", path: "/policies/access-and-refunds" });

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "");

const ROWS = (days: string, limit: string, auto: string): [string, string][] => [
  ["How long you can use a course", "12 months from the day you buy it, not lifetime."],
  ["When access ends", "The course moves to Expired in My learning. Videos and lab files lock, but your progress, notes and certificate stay."],
  ["Renewing", "Buy the course again at its current price (sales apply). Renewing in the last 30 days adds 12 months after your current end date; after it ends, 12 months start from the renewal. We never charge you automatically."],
  ["Reminders", "We email you 30, 7 and 1 day before your access ends, and when it ends."],
  ["Refunds", `Within ${days} of buying, if you have watched ${limit} or less of the course’s paid video. Both must be true. ${auto}`],
  [`How we measure ${limit}`, "Only the seconds of paid video you actually played, once each, on any device. Watching the same part again, skipping ahead or playing faster doesn’t add. Free preview lessons don’t count. Lessons added later can only lower your share; lessons removed later never raise it. Downloads and quizzes don’t count toward the limit."],
  ["The deadline", "Counted to the minute from your payment. A request made at the deadline is still in time."],
  ["If our records are incomplete", "If we can’t confirm how much you watched, a person reviews your request instead of it being declined automatically."],
  ["Free courses", "No end date and nothing to refund."],
];

export default async function AccessAndRefundsPolicy() {
  const p = await getRefundPolicy();
  const days = p ? `${p.windowDays} days` : "the refund period";
  const limit = p ? pct(p.maxWatchedPercent) : "the watch limit";
  const auto = p?.autoApprove ? `Eligible requests are refunded straight away (up to ${p.selfServicePerYear} a year; after that a person approves them).` : "A member of our team approves eligible requests.";
  return (
    <div className="container-x max-w-4xl pb-16 pt-8">
      <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-tight">Access and refunds</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">Every course you buy gives you <span className="font-bold text-ink">12 months of access</span>. Here is exactly what that means, and when you can get your money back.</p>

      <dl className="mt-8 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="policy">
        {ROWS(days, limit, auto).map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-6">
            <dt className="font-bold">{k}</dt>
            <dd className="text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10 grid gap-6 md:grid-cols-2" aria-labelledby="how">
        <div>
          <h2 id="how" className="font-display text-xl font-bold">How a refund request is decided</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-2">
            <li>Open the receipt under <Link href="/student/purchases" className="link">Student Studio › Purchase history</Link> and choose <span className="font-bold text-ink">Request a refund</span>.</li>
            <li>We check the purchase date and the video you’ve watched, from our playback records.</li>
            <li>{p?.autoApprove ? `If both rules are met, the refund is issued straight away (up to ${p.selfServicePerYear} a year; after that a person approves it).` : "If both rules are met, a member of our team approves the refund."} We tell you it’s complete only when our payment provider confirms it.</li>
            <li>If not, you see the reason at once and get an email with the dates and numbers we used. You can ask for a human review from the receipt.</li>
            <li>You can check where you stand at any time, without asking: Student Studio › Learning progress shows each course’s deadline, days left and the share watched.</li>
          </ol>
        </div>
        <div className="rounded-tile border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Your rights come first</h2>
          <p className="mt-2 text-ink-2">This policy never removes a refund the law gives you, and it doesn’t apply to billing mistakes or payments made in error. If something went wrong (for example the player recorded viewing you didn’t do), ask for a review or <Link href="/support/new?category=payments_refunds" className="link">contact support</Link>. A person looks at every review.</p>
        </div>
      </section>
      {p && p.history.length ? (
        <section className="mt-10" aria-labelledby="versions">
          <h2 id="versions" className="font-display text-xl font-bold">Policy versions</h2>
          <p className="mt-1 text-sm text-ink-2">Each purchase keeps the version in force when it was paid. If a later version is more generous, you get the more generous rule; a stricter version never applies to an earlier purchase.</p>
          <ul className="mt-3 divide-y divide-line rounded-tile border border-line bg-surface text-sm" data-testid="policy-versions">
            {p.history.map((h) => (
              <li key={h.version} className="flex flex-wrap justify-between gap-x-6 gap-y-1 px-5 py-3">
                <span className="font-bold">Version {h.version}{h.version === p.version ? <span className="ml-2 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-mint">In force</span> : null}</span>
                <span className="text-ink-2">{h.windowDays} days · {pct(h.maxWatchedPercent)} watched</span>
                <span className="text-muted">{h.version === 1 ? "From launch" : `From ${day(h.effectiveFrom)}`}{h.effectiveUntil ? ` to ${day(h.effectiveUntil)}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-10 text-sm text-muted">Applies to purchases from 25 November 2026. Students who already had a course on that date have 12 months of access from that date.</p>
    </div>
  );
}
