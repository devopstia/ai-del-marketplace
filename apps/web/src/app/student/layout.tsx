"use client";
import { BookOpen, ChartNoAxesColumnIncreasing, GraduationCap, LayoutDashboard, LifeBuoy, Mail, MessageSquareText, Receipt, UserRound } from "lucide-react";
import { AppShell, type NavGroup } from "@/components/shell/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/Empty";
import { VerifyEmailBanner } from "@/components/student/VerifyEmailBanner";

/** Student Studio (owner 2026-11-25): every account has it, whatever other roles it holds. */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, has } = useAuth();
  if (loading || !me) return <div className="p-10"><Skeleton className="h-96" /></div>;
  const nav: NavGroup[] = [
    { items: [{ href: "/student", label: "Dashboard", icon: LayoutDashboard, exact: true, testId: "nav-student-dashboard" }] },
    { label: "Learning", items: [
      { href: "/student/courses", label: "My courses", icon: BookOpen, testId: "nav-my-courses" },
      { href: "/student/progress", label: "Learning progress", icon: ChartNoAxesColumnIncreasing },
      { href: "/student/reviews", label: "Course reviews", icon: MessageSquareText },
    ] },
    { label: "Account", items: [
      { href: "/student/purchases", label: "Purchase history", icon: Receipt },
      { href: "/student/account", label: "Account settings", icon: UserRound },
      ...(!has("instructor") ? [{ href: "/student/teach", label: "Become an instructor", icon: GraduationCap }] : []),
    ] },
    { label: "Help", items: [
      { href: "/support", label: "Help and support", icon: LifeBuoy },
      { href: "/contact", label: "Contact DEL", icon: Mail },
    ] },
  ];
  return <AppShell studio="student" nav={nav} banner={<VerifyEmailBanner />}>{children}</AppShell>;
}
