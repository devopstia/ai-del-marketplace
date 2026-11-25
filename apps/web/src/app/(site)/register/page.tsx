import { Suspense } from "react";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      sub="Free to join. Pay only for the courses you choose."
      aside={
        <>
          <p className="font-display text-2xl font-bold">With a free account you can</p>
          <ul className="mt-6 space-y-4 text-white/85">
            {["Watch free previews of every course", "Keep a cart and buy in one checkout", "Track progress and resume any lecture", "Earn a verifiable certificate when you finish"].map((t) => (
              <li key={t} className="flex gap-3"><Check className="mt-0.5 size-5 shrink-0 text-[#58c3f2]" />{t}</li>
            ))}
          </ul>
        </>
      }
    >
      <Suspense><AuthForm mode="register" /></Suspense>
    </AuthShell>
  );
}
