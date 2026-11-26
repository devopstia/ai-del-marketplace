import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { ArrowRight, BadgeDollarSign, CheckCircle2, ShieldCheck, Upload } from "lucide-react";
import { ApplyToTeach } from "@/components/ApplyToTeach";
import { getTerms } from "@/lib/catalog";
import { moneyExact } from "@/lib/format";
import { EarningsCalculator } from "@/components/EarningsCalculator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({ title: "Teach on DevOps Easy Learning", description: "Publish your AI or DevOps course on DevOps Easy Learning and get paid through Stripe for every sale. Apply online.", path: "/teach" });

const steps = [
  ["Apply", "Tell us what you run in production and what you want to teach. An admin approves new instructors."],
  ["Build your course", "Our studio walks you through details, media, curriculum, quizzes and pricing. Videos upload straight to private storage."],
  ["Submit for review", "We check every course before it goes live: audio, accuracy, and that the labs actually run."],
  ["Get paid", "Connect a Stripe account once. Your share of each sale is transferred to it automatically after the refund period."],
];

export default async function TeachPage() {
  const terms = await getTerms();
  const share = terms?.instructorSharePercent ?? 80;
  const minCents = terms?.minCents ?? 499;
  const maxCents = terms?.maxCents ?? 99999;
  return (
    <>
      <section className="border-b border-line">
        <div className="container-x grid gap-12 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <h1 className="font-display text-[clamp(2.3rem,5vw,3.8rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">Teach what you run in production.</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">DevOps Easy Learning is a marketplace for hands-on AI and DevOps courses. You set the price, own your content, and reach engineers who want the real thing.</p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                [Upload, "Private video hosting", "Signed, expiring playback links. No public video URLs."],
                [ShieldCheck, "Reviewed catalogue", "Learners trust what they buy because every course is checked."],
                [BadgeDollarSign, "Stripe payouts", "Automatic transfers to your own Stripe account."],
              ].map(([I, t, d]) => {
                const Icon = I as typeof Upload;
                return (
                  <li key={t as string}>
                    <Icon className="size-6 text-violet" />
                    <p className="mt-3 font-display font-bold">{t as string}</p>
                    <p className="mt-1 text-sm text-ink-2">{d as string}</p>
                  </li>
                );
              })}
            </ul>
          </div>
          <div id="apply" className="scroll-mt-24 space-y-6">
            <ApplyToTeach />
            <section aria-labelledby="quality" className="rounded-panel border border-line bg-surface p-7">
              <h2 id="quality" className="font-display text-lg font-bold">What a reviewer checks before your course goes live</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-2">
                {["Clear audio and readable screens in every video", "Accurate, current content for the tools you teach", "Labs and downloads that run as described", "A description and curriculum that match what the videos teach"].map((t) => (
                  <li key={t} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />{t}</li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted">If something needs work, you get a note explaining what to change. Changes to a live course are reviewed the same way.</p>
            </section>
          </div>
        </div>
      </section>
      <section id="how" className="container-x scroll-mt-20 pt-16">
        <h2 className="font-display text-3xl font-extrabold">How it works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="border-t-2 border-ink pt-5">
              <span className="font-display text-4xl font-extrabold text-violet tabular-nums">{i + 1}</span>
              <h3 className="mt-3 font-display text-lg font-bold">{t}</h3>
              <p className="mt-2 text-ink-2">{d}</p>
              {i === 0 ? <a href="#apply" className="link mt-3 inline-flex items-center gap-1 text-sm">Start your application<ArrowRight className="size-4" /></a> : null}
            </li>
          ))}
        </ol>
      </section>
      <section id="payouts" className="container-x scroll-mt-20 pt-16" aria-labelledby="payouts-h">
        <div className="panel grid gap-10 p-7 md:grid-cols-2 md:p-10">
          <div>
            <h2 id="payouts-h" className="font-display text-2xl font-extrabold">You keep {share}% of every sale</h2>
            <p className="mt-3 text-ink-2">
              Your share is {share}% of what the learner paid after Stripe’s processing fee. Sales tax is never part of the split.
              The platform keeps the rest to run checkout, hosting, reviews and support.
            </p>
            <ul className="mt-5 space-y-3 text-ink-2">
              <li><b className="text-ink">Your price:</b> free, or any price from {moneyExact(minCents)} to {moneyExact(maxCents)} in US dollars. You can change it later.</li>
              <li><b className="text-ink">When you’re paid:</b> 16 days after each sale, once the learner’s 14-day refund period has ended, your share is transferred to your own Stripe account. Stripe then pays it out to your bank.</li>
              <li><b className="text-ink">Refunds:</b> learners can get a refund within 14 days if they’ve watched 25% of the course or less. A refunded sale pays you nothing and costs you nothing.</li>
              <li><b className="text-ink">Chargebacks:</b> the platform handles disputes with the bank. If one is lost, that sale’s share is taken back.</li>
            </ul>
            <p className="mt-5 text-sm text-muted">Every sale shows its price, fee and your share in your studio.</p>
          </div>
          <div className="self-start">
            <h3 className="mb-3 font-display font-bold text-ink">What you’d earn</h3>
            <EarningsCalculator sharePercent={share} minCents={minCents} maxCents={maxCents} />
          </div>
        </div>
      </section>
      <section className="container-x pb-6 pt-16" aria-labelledby="ready-h">
        <div className="flex flex-col gap-5 border-t-2 border-ink pt-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="ready-h" className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-tight">Ready to teach what you run?</h2>
            <p className="mt-2 max-w-xl text-ink-2">Apply in about two minutes. An admin reviews your application, then the studio walks you through your first course.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="#apply" className="btn btn-primary">Start your application</a>
            <Link href="/courses" className="btn btn-outline">See what’s on DEL</Link>
          </div>
        </div>
      </section>
    </>
  );
}
