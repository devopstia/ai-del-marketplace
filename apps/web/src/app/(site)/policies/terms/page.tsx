/* eslint-disable react/jsx-key -- section bodies are values of [title, body] pairs; <Policy> renders each with its own key */
import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Policy } from "../_Policy";
import { TERMS_UPDATED } from "@/lib/terms";

export const metadata: Metadata = pageMeta({ title: "Terms of use", description: "The rules for learning, buying and teaching on the DevOps Easy Learning marketplace.", path: "/policies/terms" });

export default function Terms() {
  return (
    <Policy
      title="Terms of use"
      updated={TERMS_UPDATED}
      intro="These terms apply when you use the DevOps Easy Learning marketplace to learn, buy or teach. By creating an account you agree to them."
      sections={[
        ["Your account", <p>One account per person. Keep your password and your Google Authenticator safe; you’re responsible for what happens in your account. Every new account is a student account; teaching needs an approved instructor application.</p>],
        ["Buying a course", <p>A purchase gives you personal access to the course for <b className="text-ink">12 months</b> from the day you buy it, not lifetime. Renewing is a new purchase at the price of the day and is never charged automatically. Prices are shown in US dollars before you pay. Refunds follow the <Link href="/policies/access-and-refunds">Access and refunds policy</Link>: within 14 days and 25% or less of the course watched.</p>],
        ["Using the content", <p>Courses are for your own learning. Don’t share your account, download or record the videos, or republish lessons, files or quizzes. Lab files may be used in your own practice and work. We may suspend access that breaks these rules.</p>],
        ["Reviews and messages", <p>Reviews must be honest and about the course. We remove spam, abuse and personal attacks; honest low ratings stay. Instructors can report a review but can’t remove it.</p>],
        ["Teaching on DEL", <p>Instructors keep the rights to their courses and give DevOps Easy Learning the right to host, sell and promote them on the marketplace. Instructors must own or have permission for everything they upload. Earnings and payouts follow the instructor terms shown in the Instructor Studio (by default 80% of the net amount of each sale, paid through Stripe).</p>],
        ["The DevOps Easy Learning program", <p>The full training program is sold only on <a href="https://www.devopseasylearning.com" target="_blank" rel="noopener noreferrer">devopseasylearning.com</a> and follows that site’s terms.</p>],
        ["Availability", <p>We work to keep the marketplace available and correct, but courses are provided as they are and may change when instructors update them. To the extent the law allows, we aren’t liable for indirect losses from using the site.</p>],
        ["Ending your account", <p>You can ask us to close your account at any time. We may suspend accounts that break these terms, after telling you why, except where the law or safety prevents it.</p>],
        ["Changes", <p>We may update these terms; the date above shows the latest version, and we email you about important changes. Your personal data is handled as described in the <Link href="/policies/privacy">Privacy policy</Link>.</p>],
      ]}
    />
  );
}
