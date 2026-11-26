import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ForcedChangeForm } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Choose your own password", robots: { index: false } };

/** Reached after signing in with a temporary password from DevOps Easy Learning (docs/SUPER_ADMIN.md). */
export default function ChangePasswordPage() {
  return (
    <AuthShell title="Choose your own password" sub="You signed in with a temporary password. Pick a new one to continue."
      aside={<><p className="font-display text-2xl font-bold leading-snug">Only you should know your password.</p><p className="mt-5 text-sm text-white/70">DevOps Easy Learning never asks for your password by email or phone.</p></>}>
      <ForcedChangeForm />
    </AuthShell>
  );
}
