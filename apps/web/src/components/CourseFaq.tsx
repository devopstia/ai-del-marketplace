import type { CourseDetail } from "@/lib/types";

/**
 * "Questions before you buy": answers come from the platform's published policies and this course's own data,
 * so every answer is true for this course. Items without a true answer for the course are left out.
 */
export function CourseFaq({ c }: { c: CourseDetail }) {
  const free = c.priceCents === 0;
  const items: [string, string][] = [
    free
      ? ["Is it really free?", "Yes. Create a free account and enrol; there is nothing to pay and no card needed."]
      : ["Can I get a refund?", "Yes, within 14 days of purchase, if you’ve watched 25% of the course or less and no certificate has been issued. Request it from your order page; the money goes back to your card."],
    ["How long can I watch it?", "12 months from the day you buy it, with no subscription. You get the updates the instructor publishes during that time. Renewing afterwards is optional and never charged automatically, and your progress is kept."],
    ["Do I get a certificate?", "Yes. When you finish every lesson you get a certificate with a code anyone can verify on this site."],
  ];
  if (c.resourceCount > 0) items.push(["What do I need for the labs?", c.requirements.length ? `The labs run on your own computer or cloud account with the downloadable files. You’ll need: ${c.requirements.join("; ")}.` : "The labs run on your own computer or cloud account with the downloadable files."]);
  if (c.hasCaptions) items.push(["Are there captions?", "Yes, English captions on the lessons. They are off by default; turn them on with the CC button in the player."]);
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
