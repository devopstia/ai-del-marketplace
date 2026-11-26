import Link from "next/link";

/** Shared layout for the written policies: a title, the date, then numbered sections. */
export function Policy({ title, intro, updated, sections }: { title: string; intro: string; updated: string; sections: [string, React.ReactNode][] }) {
  return (
    <div className="container-x max-w-3xl pb-16 pt-8">
      <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      <p className="mt-4 text-lg text-ink-2">{intro}</p>
      <div className="mt-8 space-y-7" data-testid="policy-text">
        {sections.map(([h, body], i) => (
          <section key={h} aria-labelledby={`s${i}`}>
            <h2 id={`s${i}`} className="font-display text-xl font-bold">{i + 1}. {h}</h2>
            <div className="mt-2 space-y-2 text-ink-2 [&_a]:font-semibold [&_a]:text-violet [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc">{body}</div>
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-line pt-5 text-sm text-muted">
        Questions? Write to <a href="mailto:support@devopseasylearning.com" className="link">support@devopseasylearning.com</a> or use the <Link href="/contact" className="link">Contact page</Link>. See also{" "}
        <Link href="/policies/terms" className="link">Terms of use</Link>, <Link href="/policies/privacy" className="link">Privacy policy</Link> and <Link href="/policies/access-and-refunds" className="link">Access and refunds</Link>.
      </p>
    </div>
  );
}
