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
          <p className="font-display text-2xl font-bold leading-snug">“The labs are the course. I deployed the RAG stack to my own AWS account on day two.”</p>
          <p className="mt-5 text-sm text-white/70">Priya Raman, platform engineer</p>
        </>
      }
    >
      <Suspense><AuthForm mode="login" /></Suspense>
    </AuthShell>
  );
}
