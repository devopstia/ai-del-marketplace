import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <AuthShell title="Choose a new password" sub="Pick something long that you don’t use anywhere else."
      aside={<><p className="font-display text-2xl font-bold leading-snug">A short sentence makes a strong password.</p><p className="mt-5 text-sm text-white/70">For example: three unrelated words and a number. A password manager can make and remember one for you.</p></>}>
      <Suspense><ResetForm /></Suspense>
    </AuthShell>
  );
}
