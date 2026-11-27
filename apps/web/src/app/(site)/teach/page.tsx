import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { ArrowRight, BadgeDollarSign, CheckCircle2, ShieldCheck, Upload } from "lucide-react";
import { ApplyToTeach } from "@/components/ApplyToTeach";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({ title: "Teach on DevOps Easy Learning", description: "Publish your AI or DevOps course on DevOps Easy Learning and get paid through Stripe for every sale. Apply online.", path: "/teach" });

const steps = [
  ["Apply", "Tell us what you run in production and what you want to teach. An admin approves new instructors."],
  ["Build your course", "Our studio walks you through details, media, curriculum, quizzes and pricing. Videos upload straight to private storage."],
  ["Submit for review", "We check every course before it goes live: audio, accuracy, and that the labs actually run."],
  ["Get paid", "Connect a Stripe account once. Your share of each sale is transferred to it automatically after the refund period."],
];

export default function TeachPage() {
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
        {/* Owner 2026-11-27: no public money details; the agreement covers share, pricing rules and payouts. */}
        <p className="mt-8 text-ink-2" data-testid="teach-terms-line">Revenue share, pricing rules and payouts are set out in the instructor agreement you receive when your application is approved.</p>
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
