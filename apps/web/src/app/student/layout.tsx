"use client";
import { AppShell } from "@/components/shell/AppShell";
import { studentNav } from "@/lib/studio-nav";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/Empty";
import { VerifyEmailBanner } from "@/components/student/VerifyEmailBanner";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";

/** Student Studio (owner 2026-11-25): every account has it, whatever other roles it holds. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  // Career paths appear in the menu only while one is published or followed (docs/CAREER_PATHS.md).
  const paths = useApi(me ? "/me/paths/summary" : null, (r) => Number(obj(r).available ?? 0) > 0 || Number(obj(r).following ?? 0) > 0);
  if (loading || !me) return <div className="p-10"><Skeleton className="h-96" /></div>;
  return <AppShell studio="student" nav={studentNav(me, { careerPaths: !!paths.data })} banner={<VerifyEmailBanner />}>{children}</AppShell>;
}
