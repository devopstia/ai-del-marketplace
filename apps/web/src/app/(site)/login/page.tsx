import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      sub="Log in to pick up where you left off."
      aside={
        <>
          <p className="font-display text-2xl font-bold leading-snug">Every lesson ends with a lab you run on your own computer or cloud account.</p>
          <p className="mt-5 text-sm text-white/70">Your progress, quiz results and certificates are saved to your account.</p>
        </>
      }
    >
      <Suspense><AuthForm mode="login" /></Suspense>
    </AuthShell>
  );
}
