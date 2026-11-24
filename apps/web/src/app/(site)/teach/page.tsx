import type { Metadata } from "next";
import { BadgeDollarSign, ShieldCheck, Upload } from "lucide-react";
import { ApplyToTeach } from "@/components/ApplyToTeach";
import { LOOP_FULL } from "@/components/Logo";

export const metadata: Metadata = { title: "Teach on DevOps Easy Learning" };

const steps = [
  ["Apply", "Tell us what you run in production and what you want to teach. An admin approves new instructors."],
  ["Build your course", "Our studio walks you through details, media, curriculum, quizzes and pricing. Videos upload straight to private storage."],
  ["Submit for review", "We check every course before it goes live: audio, accuracy, and that the labs actually run."],
  ["Get paid", "Connect a Stripe account once. Your share of each sale is transferred automatically."],
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
          <div id="apply" className="space-y-6">
            <ApplyToTeach />
            <figure className="relative overflow-hidden rounded-panel bg-stage p-7 text-white">
              <svg viewBox="0 0 120 60" className="absolute -right-10 -top-6 w-72 opacity-25" fill="none" aria-hidden="true"><path d={LOOP_FULL} stroke="#58c3f2" strokeWidth="2" /></svg>
              <blockquote className="relative font-display text-xl font-semibold leading-snug">“I recorded my incident-response course in three weekends. The review notes made it better, and payouts land in my Stripe account without me chasing anyone.”</blockquote>
              <figcaption className="relative mt-5 text-sm text-white/70">Nadia Rahman, SRE and automation engineer</figcaption>
            </figure>
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
            </li>
          ))}
        </ol>
      </section>
      <section id="payouts" className="container-x scroll-mt-20 pt-16">
        <div className="panel grid gap-6 p-7 md:grid-cols-[1fr_1.4fr] md:p-10">
          <h2 className="font-display text-2xl font-extrabold">How payouts work</h2>
          <div className="space-y-3 text-ink-2">
            <p>Learners pay through Stripe Checkout. The platform keeps a commission set by the admin (currently shown in your studio), and your share of each course in the order is transferred to your connected Stripe account.</p>
            <p>If a learner is refunded, the matching transfer is reversed. You can see every sale and its transfer status in your studio.</p>
          </div>
        </div>
      </section>
    </>
  );
}
