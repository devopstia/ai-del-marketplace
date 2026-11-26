/* eslint-disable react/jsx-key -- section bodies are values of [title, body] pairs; <Policy> renders each with its own key */
import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Policy } from "../_Policy";
import { TERMS_UPDATED } from "@/lib/terms";

export const metadata: Metadata = pageMeta({ title: "Privacy policy", description: "What personal data DevOps Easy Learning collects, why, who processes it and how to reach us about it.", path: "/policies/privacy" });

export default function PrivacyPolicy() {
  return (
    <Policy
      title="Privacy policy"
      updated={TERMS_UPDATED}
      intro="DevOps Easy Learning runs this marketplace. We collect only what we need to give you your courses, keep your account safe, take payments and answer you. We don’t sell personal data and the site has no advertising or tracking scripts."
      sections={[
        ["What we collect", <>
          <ul>
            <li><b className="text-ink">Account:</b> your name, email address, password (stored only as a one-way hash), and the Google Authenticator setup that protects your sign-in (stored encrypted).</li>
            <li><b className="text-ink">Social sign-in:</b> if you use Google, GitHub, Facebook or LinkedIn, we receive that account’s identifier, name, email address and picture. We don’t receive your password there or post anything for you.</li>
            <li><b className="text-ink">Learning:</b> the courses you take, your progress, the parts of each video you played, quiz answers, certificates and reviews you write.</li>
            <li><b className="text-ink">Purchases:</b> what you bought, prices, refunds and access dates. Card details go to Stripe; we never see or store your card number.</li>
            <li><b className="text-ink">Messages:</b> what you send through the Contact page or Help and support, including any screenshots.</li>
            <li><b className="text-ink">Security records:</b> sign-in attempts, IP address and browser for protection against fraud and account takeover.</li>
          </ul>
        </>],
        ["Why we use it", <p>To run your account and courses, take payments and give refunds, issue certificates, pay instructors their share, answer support requests, send the emails your account needs (receipts, access reminders, security notices), and keep the platform secure. Instructors see the names of learners in their own courses and their reviews, never their payment details.</p>],
        ["Cookies and storage", <p>We use a sign-in cookie and a security (CSRF) cookie that the site needs to work. Your browser also keeps your theme choice and, before you sign in, the courses in your cart. There are no advertising or analytics cookies.</p>],
        ["Who processes data for us", <ul>
          <li>Amazon Web Services: hosting, file storage and email delivery (United States).</li>
          <li>Stripe: card payments, refunds and instructor payouts.</li>
          <li>Google, GitHub, Facebook, LinkedIn: only if you choose to sign in with them.</li>
          <li>Video delivery and AI features may use specialised providers; they receive only what is needed to play a video or answer a question about course content.</li>
        </ul>],
        ["How long we keep it", <p>Account and learning records are kept while your account exists. Purchase and payout records are kept as long as tax and accounting rules require. Security records are kept for a limited period. When a course’s access ends, your progress stays so you can continue if you renew.</p>],
        ["Your choices and rights", <p>You can see and change your account details in Student Studio › Account settings and link or remove sign-in methods there. To get a copy of your data, correct it, or delete your account, write to us; we answer within 30 days. Some records (for example invoices) may have to be kept by law.</p>],
        ["Security", <p>Passwords are hashed with Argon2id, every sign-in needs a Google Authenticator code, sessions use secure cookies, videos are delivered through short-lived signed links, and privileged actions are recorded in an audit log.</p>],
        ["Changes", <p>If we change this policy we update the date above, and we email you about important changes. The <Link href="/policies/terms">Terms of use</Link> explain the rules for using the marketplace.</p>],
      ]}
    />
  );
}
