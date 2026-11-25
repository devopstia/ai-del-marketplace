import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthShell title="Reset your password" sub="We’ll email you a link to choose a new one."
      aside={<><p className="font-display text-2xl font-bold leading-snug">Your account stays protected.</p><p className="mt-5 text-sm text-white/70">After a reset you’re signed out everywhere, and Google Authenticator is still asked when you log in.</p></>}>
      <ForgotForm />
    </AuthShell>
  );
}
