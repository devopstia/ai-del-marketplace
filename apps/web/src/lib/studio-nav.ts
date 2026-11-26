import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign, BookOpen, ChartNoAxesColumnIncreasing, ClipboardCheck, Clapperboard, CreditCard, FolderTree, Gauge, GraduationCap,
  Image as ImageIcon, KeyRound, Landmark, LayoutDashboard, LifeBuoy, Mail, MessageSquareText, MonitorPlay, Receipt, RotateCcw, Route,
  ScrollText, Settings, ShieldCheck, Tag, UserPlus, UserRound, Users, Wallet,
} from "lucide-react";
import type { Me } from "./types";
import { canDo, studiosFor } from "./studios";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number; testId?: string };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * The studio menus, in one place: the studio layouts draw their sidebars from these and the quick search (⌘K) lists
 * the same pages, so it never offers a page the sidebar doesn't. The API still checks every request.
 */
export function studentNav(me: Me | null, opts: { careerPaths?: boolean } = {}): NavGroup[] {
  const instructor = !!me?.roles.includes("instructor");
  return [
    { items: [{ href: "/student", label: "Dashboard", icon: LayoutDashboard, exact: true, testId: "nav-student-dashboard" }] },
    { label: "Learning", items: [
      { href: "/student/courses", label: "My courses", icon: BookOpen, testId: "nav-my-courses" },
      { href: "/student/progress", label: "Learning progress", icon: ChartNoAxesColumnIncreasing },
      // Only while a career path is published or followed (docs/CAREER_PATHS.md; rule 4: no menu to an empty feature).
      ...(opts.careerPaths ? [{ href: "/student/paths", label: "Career paths", icon: Route, testId: "nav-career-paths" }] : []),
      { href: "/student/reviews", label: "Course reviews", icon: MessageSquareText },
    ] },
    { label: "Account", items: [
      { href: "/student/purchases", label: "Purchase history", icon: Receipt },
      { href: "/student/account", label: "Account settings", icon: UserRound },
      ...(!instructor ? [{ href: "/student/teach", label: "Become an instructor", icon: GraduationCap }] : []),
    ] },
    { label: "Help", items: [
      { href: "/help", label: "Platform videos", icon: MonitorPlay, testId: "nav-platform-videos" },
      { href: "/support", label: "Help and support", icon: LifeBuoy },
      { href: "/contact", label: "Contact DEL", icon: Mail },
    ] },
  ];
}

export const instructorNav: NavGroup[] = [
  { items: [{ href: "/studio", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { label: "Teach", items: [
    { href: "/studio/courses", label: "Courses", icon: BookOpen },
    { href: "/studio/students", label: "Students", icon: Users },
    { href: "/studio/insights", label: "Insights", icon: ChartNoAxesColumnIncreasing },
    { href: "/studio/enrollments", label: "Manual enrollments", icon: UserPlus },
    { href: "/studio/reviews", label: "Reviews", icon: MessageSquareText },
  ] },
  { label: "Business", items: [
    { href: "/studio/sales", label: "Sales", icon: BadgeDollarSign },
    { href: "/studio/promotions", label: "Promotions", icon: Tag },
    { href: "/studio/payouts", label: "Payments & payouts", icon: Wallet },
  ] },
  { label: "Account", items: [
    { href: "/studio/profile", label: "Profile", icon: UserRound },
  ] },
  { label: "Help", items: [
    { href: "/help", label: "Platform videos", icon: MonitorPlay, testId: "nav-platform-videos" },
    { href: "/support", label: "Help and support", icon: LifeBuoy },
  ] },
];

type AdminItem = NavItem & { perm?: string; superOnly?: boolean };
const adminGroups: { label?: string; items: AdminItem[] }[] = [
  { items: [{ href: "/admin", label: "Overview", icon: Gauge, exact: true }] },
  { label: "Marketplace", items: [
    { href: "/admin/review", label: "Review queue", icon: ClipboardCheck, perm: "courses.review" },
    { href: "/admin/courses", label: "Courses", icon: BookOpen, perm: "courses.review" },
    { href: "/admin/course-reviews", label: "Course reviews", icon: MessageSquareText, perm: "reviews.moderate" },
    { href: "/admin/paths", label: "Career paths", icon: Route, perm: "content.manage" },
  ] },
  { label: "People", items: [
    { href: "/admin/users", label: "Users and roles", icon: Users, perm: "users.view" },
    { href: "/admin/sign-in", label: "Sign-in methods", icon: KeyRound, superOnly: true },
    { href: "/admin/instructors", label: "Instructor applications", icon: GraduationCap, perm: "users.view" },
    { href: "/admin/enrollments", label: "Manual enrollments", icon: UserPlus, perm: "enrollments.manage" },
  ] },
  { label: "Money", items: [
    { href: "/admin/orders", label: "Orders", icon: Receipt, perm: "orders.view" },
    { href: "/admin/finance", label: "Money", icon: Landmark, perm: "finance.view" },
    { href: "/admin/refunds", label: "Refunds", icon: RotateCcw, perm: "finance.view" },
    { href: "/admin/promotions", label: "Promotions", icon: Tag, perm: "promotions.view" },
  ] },
  { label: "Support", items: [
    { href: "/admin/support", label: "Support requests", icon: LifeBuoy, perm: "support.manage" },
    { href: "/admin/contact", label: "Contact messages", icon: Mail, perm: "support.manage" },
    { href: "/admin/help", label: "Manage platform videos", icon: Clapperboard, perm: "content.manage" },
    { href: "/help", label: "Platform videos", icon: MonitorPlay, testId: "nav-platform-videos" },
  ] },
  { label: "Platform", items: [
    { href: "/admin/categories", label: "Categories", icon: FolderTree, perm: "content.manage" },
    { href: "/admin/covers", label: "Cover templates", icon: ImageIcon, perm: "content.manage" },
    { href: "/admin/protection", label: "Video protection", icon: ShieldCheck, perm: "content.manage" },
    { href: "/admin/payments", label: "Payments & Stripe", icon: CreditCard, superOnly: true },
    { href: "/admin/settings", label: "Settings", icon: Settings, superOnly: true },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText, perm: "audit.view" },
  ] },
];

/** The admin menu this account may open (permission per page; super-admin-only pages). Empty for non-admins. */
export function adminNav(me: Me | null): NavGroup[] {
  if (!me || !(me.roles.includes("admin") || me.roles.includes("super_admin"))) return [];
  const sup = me.roles.includes("super_admin");
  return adminGroups
    .map((g) => ({ label: g.label, items: g.items.filter((n) => (n.superOnly ? sup : !n.perm || canDo(me, n.perm))).map(({ perm: _p, superOnly: _s, ...n }) => n) }))
    .filter((g) => g.items.length);
}

export interface StudioPage { href: string; label: string; icon: LucideIcon; studio: string; section?: string }

/**
 * Every studio page this account can open, for the quick search: Student Studio always (signed in), the Instructor
 * (or DEL) Studio when the studio layout would let them in, the admin pages their permissions allow. Shared help
 * pages (/help, /support, /contact) are left to the Help group.
 */
export function studioPagesFor(me: Me | null): StudioPage[] {
  if (!me) return [];
  const studios = studiosFor(me);
  const label = (k: string) => studios.find((s) => s.key === k)?.label ?? "";
  const out: StudioPage[] = [];
  const add = (groups: NavGroup[], studio: string) => {
    for (const g of groups) for (const n of g.items) {
      if (!/^\/(student|studio|admin)(\/|$)/.test(n.href) || out.some((o) => o.href === n.href)) continue;
      out.push({ href: n.href, label: n.label, icon: n.icon, studio, section: g.label });
    }
  };
  add(studentNav(me), label("student"));
  // Same rule as the studio layout: acting as DEL, or an instructor whose application isn't pending.
  if (me.actingAs) add(instructorNav, label("del") || "DEL Studio");
  else if (studios.some((s) => s.key === "instructor")) add(instructorNav, label("instructor"));
  add(adminNav(me), label("admin"));
  return out;
}
