"use client";
import { AppShell } from "@/components/shell/AppShell";
import { studentNav } from "@/lib/studio-nav";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/Empty";
import { VerifyEmailBanner } from "@/components/student/VerifyEmailBanner";

/** Student Studio (owner 2026-11-25): every account has it, whatever other roles it holds. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading || !me) return <div className="p-10"><Skeleton className="h-96" /></div>;
  return <AppShell studio="student" nav={studentNav(me)} banner={<VerifyEmailBanner />}>{children}</AppShell>;
}
