import { Suspense } from "react";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { MfaStep } from "@/components/auth/MfaStep";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default function VerifyPage() {
  return (
    <AuthShell
      title="Two-step sign-in"
      sub="One more step keeps your courses and purchases safe."
      aside={
        <>
          <p className="font-display text-2xl font-bold leading-snug">Your password is only half of it.</p>
          <ul className="mt-6 space-y-4 text-white/85">
            {["A code from your phone changes every 30 seconds", "Someone with your password still can’t get in", "Trust your own device and skip the code for 30 days"].map((t) => (
              <li key={t} className="flex gap-3"><Check className="mt-0.5 size-5 shrink-0 text-[#58c3f2]" />{t}</li>
            ))}
          </ul>
        </>
      }
    >
      <Suspense><MfaStep /></Suspense>
    </AuthShell>
  );
}
