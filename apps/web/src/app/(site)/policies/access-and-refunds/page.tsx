import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ title: "Access and refunds", description: "How long you can use a course you buy on DevOps Easy Learning, how renewal works, and when you can get a refund.", path: "/policies/access-and-refunds" });

const ROWS: [string, string][] = [
  ["How long you can use a course", "12 months from the day you buy it, not lifetime."],
  ["When access ends", "The course moves to Expired in My learning. Videos and lab files lock, but your progress, notes and certificate stay."],
  ["Renewing", "Buy the course again at its current price (sales apply). Renewing in the last 30 days adds 12 months after your current end date; after it ends, 12 months start from the renewal. We never charge you automatically."],
  ["Reminders", "We email you 30, 7 and 1 day before your access ends, and when it ends."],
  ["Refunds", "Within 14 days of buying, if you have watched 25% or less of the course. Both must be true."],
  ["How we measure 25%", "Only the seconds of video you actually played, once each. Watching the same part again, or skipping ahead, doesn’t add. Lessons added or removed later are counted as the course is now."],
  ["Free courses", "No end date and nothing to refund."],
];

export default function AccessAndRefundsPolicy() {
  return (
    <div className="container-x max-w-4xl pb-16 pt-8">
      <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-tight">Access and refunds</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">Every course you buy gives you <span className="font-bold text-ink">12 months of access</span>. Here is exactly what that means, and when you can get your money back.</p>

      <dl className="mt-8 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="policy">
        {ROWS.map(([k, v]) => (
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
            <li>If both rules are met, the refund is issued straight away to your card (up to 3 a year; after that a person approves it).</li>
            <li>If not, you get an email with the numbers we used. You can ask for a human review from the receipt.</li>
          </ol>
        </div>
        <div className="rounded-tile border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Your rights come first</h2>
          <p className="mt-2 text-ink-2">This policy never removes a refund the law gives you, and it doesn’t apply to billing mistakes or payments made in error. If something went wrong (for example the player recorded viewing you didn’t do), ask for a review or <Link href="/support/new?category=payments_refunds" className="link">contact support</Link>. A person looks at every review.</p>
        </div>
      </section>
      <p className="mt-10 text-sm text-muted">Applies to purchases from 25 November 2026. Students who already had a course on that date have 12 months of access from that date.</p>
    </div>
  );
}
