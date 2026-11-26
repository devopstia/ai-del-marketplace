import type { CourseDetail } from "@/lib/types";
import { refundRule, type RefundPolicy } from "@/lib/refund-policy-shared";

/**
 * "Questions before you buy": answers come from the platform's published policies and this course's own data,
 * so every answer is true for this course. Items without a true answer for the course are left out.
 */
export function courseFaqItems(c: CourseDetail, policy: RefundPolicy | null): [string, string][] {
  const free = c.priceCents === 0;
  const items: [string, string][] = [
    free
      ? ["Is it really free?", "Yes. Create a free account and enrol; there is nothing to pay and no card needed."]
      : ["Can I get a refund?", `Yes, ${refundRule(policy, true)}, and before a certificate is issued. Your Student Studio shows your deadline and how much you’ve watched; request it from your order page and the money goes back to your card.`],
    ["How long can I watch it?", "12 months from the day you buy it, with no subscription. You get the updates the instructor publishes during that time. Renewing afterwards is optional and never charged automatically, and your progress is kept."],
    ["Do I get a certificate?", "Yes. When you finish every lesson you get a certificate with a code anyone can verify on this site."],
  ];
  if (c.resourceCount > 0) items.push(["What do I need for the labs?", c.requirements.length ? `The labs run on your own computer or cloud account with the downloadable files. You’ll need: ${c.requirements.join("; ")}.` : "The labs run on your own computer or cloud account with the downloadable files."]);
  if (c.hasCaptions) items.push(["Are there captions?", "Yes, English captions on the lessons. They are off by default; turn them on with the CC button in the player."]);
  return items;
}

/** The same questions and answers go to search engines as FAQPage data (course page), so the two always match. */
export function CourseFaq({ c, policy }: { c: CourseDetail; policy: RefundPolicy | null }) {
  const items = courseFaqItems(c, policy);
  return (
    <section className="mt-12" aria-labelledby="faq-h">
      <h2 id="faq-h" className="font-display text-2xl font-extrabold">Questions before you buy</h2>
      <div className="mt-4 divide-y divide-line border-y border-line">
        {items.map(([q, a]) => (
          <details key={q} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold text-ink marker:hidden">
              {q}
              <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 pr-8 text-ink-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
