"use client";
import { BadgeDollarSign, BookOpen, LayoutDashboard, MessageSquareText, UserRound, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { ApplyToTeach } from "@/components/ApplyToTeach";
import { SiteHeader } from "@/components/SiteHeader";
import { Skeleton } from "@/components/Empty";

const nav = [
  { href: "/studio", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/studio/courses", label: "Courses", icon: BookOpen },
  { href: "/studio/sales", label: "Sales", icon: BadgeDollarSign },
  { href: "/studio/students", label: "Students", icon: Users },
  { href: "/studio/reviews", label: "Reviews", icon: MessageSquareText },
  { href: "/studio/payouts", label: "Payouts", icon: Wallet },
  { href: "/studio/profile", label: "Profile", icon: UserRound },
];

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, has } = useAuth();
  if (loading) return <div className="p-10"><Skeleton className="h-96" /></div>;
  if (!me || !has("instructor") || me.instructorStatus === "pending") {
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
  return <AppShell area="Instructor studio" nav={nav}>{children}</AppShell>;
}
