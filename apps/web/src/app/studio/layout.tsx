"use client";
import { UserPlus, MonitorPlay, BadgeDollarSign, BookOpen, LifeBuoy, Tag, LayoutDashboard, MessageSquareText, UserRound, Users, Wallet } from "lucide-react";
import { AppShell, type NavGroup } from "@/components/shell/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { ApplyToTeach } from "@/components/ApplyToTeach";
import { SiteHeader } from "@/components/SiteHeader";
import { Skeleton } from "@/components/Empty";

const nav: NavGroup[] = [
  { items: [{ href: "/studio", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { label: "Teach", items: [
    { href: "/studio/courses", label: "Courses", icon: BookOpen },
    { href: "/studio/students", label: "Students", icon: Users },
    { href: "/studio/enrollments", label: "Manual enrollments", icon: UserPlus },
    { href: "/studio/reviews", label: "Reviews", icon: MessageSquareText },
  ] },
  { label: "Business", items: [
    { href: "/studio/sales", label: "Sales", icon: BadgeDollarSign },
    { href: "/studio/promotions", label: "Promotions", icon: Tag },
    { href: "/studio/payouts", label: "Payouts", icon: Wallet },
  ] },
  { label: "Account", items: [
    { href: "/studio/profile", label: "Profile", icon: UserRound },
  ] },
  { label: "Help", items: [
    { href: "/help", label: "Platform videos", icon: MonitorPlay, testId: "nav-platform-videos" },
    { href: "/support", label: "Help and support", icon: LifeBuoy },
  ] },
];

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, has } = useAuth();
  if (loading) return <div className="p-10"><Skeleton className="h-96" /></div>;
  const acting = !!me?.actingAs;
  if (!me || (!acting && (!has("instructor") || me.instructorStatus === "pending"))) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="container-x grid max-w-5xl gap-10 py-14 md:grid-cols-[1fr_1.1fr]">
          <div>
            <h1 className="font-display text-[2.4rem] font-extrabold leading-tight">Instructor studio</h1>
            <p className="mt-3 text-lg text-ink-2">The studio is where approved instructors build courses, upload video, and track sales and payouts. Apply once; an admin reviews your application.</p>
          </div>
          <ApplyToTeach />
        </main>
      </>
    );
  }
  return (
    <AppShell studio={acting ? "del" : "instructor"} nav={nav}>
      {acting ? (
        <p className="-mt-2 mb-6 rounded-tile border border-line bg-cyan-soft px-4 py-2.5 text-sm text-ink" role="status" data-testid="acting-banner">
          You’re working as <b>{me.actingAs!.name}</b>. Courses, sales and students here are DEL’s; every change is recorded under your name.
        </p>
      ) : null}
      {children}
    </AppShell>
  );
}
