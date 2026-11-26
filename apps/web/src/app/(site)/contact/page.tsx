import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { Mail, MessageCircleQuestion, Phone } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { SocialLinks, SUPPORT_EMAIL } from "@/components/SocialLinks";

export const metadata: Metadata = pageMeta({ title: "Contact us", description: "Write to DevOps Easy Learning support. Attach screenshots if something looks wrong.", path: "/contact" });

export default function ContactPage() {
  return (
    <div className="container-x max-w-6xl pb-10 pt-10 md:pt-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <div>
          <h1 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-extrabold leading-tight">Contact us</h1>
          <p className="mt-3 max-w-md text-lg text-ink-2">Questions about a course, a payment or your account? Write to us. Add a screenshot if something looks wrong: it helps us answer faster.</p>
          <dl className="mt-8 divide-y divide-line border-y border-line">
            <div className="flex gap-4 py-4">
              <dt><Mail className="mt-0.5 size-5 text-violet" aria-label="Email" /></dt>
              <dd><a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-ink hover:text-violet">{SUPPORT_EMAIL}</a><p className="text-sm text-muted">We reply within one working day.</p></dd>
            </div>
            <div className="flex gap-4 py-4">
              <dt><Phone className="mt-0.5 size-5 text-violet" aria-label="Phone" /></dt>
              <dd><p className="font-bold text-ink"><a href="tel:+18323420700" className="hover:text-violet">832-342-0700</a> or <a href="tel:+18328978630" className="hover:text-violet">832-897-8630</a></p><p className="text-sm text-muted">DevOps Easy Learning, United States</p></dd>
            </div>
            <div className="flex gap-4 py-4">
              <dt><MessageCircleQuestion className="mt-0.5 size-5 text-violet" aria-label="Help" /></dt>
              <dd><p className="font-bold text-ink">Already a student?</p><p className="text-sm text-muted">Signed-in learners can also open a <Link href="/support" className="link">support request</Link> and follow it in the Student Studio.</p></dd>
            </div>
          </dl>
          <p className="mt-8 text-sm font-bold text-ink">Follow DevOps Easy Learning</p>
          <SocialLinks className="-ml-2 mt-2" size={20} />
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
