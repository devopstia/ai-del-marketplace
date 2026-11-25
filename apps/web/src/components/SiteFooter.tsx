import Link from "next/link";
import { LoopMark } from "./Logo";
import { getCategories, getCourses } from "@/lib/catalog";

/** Footer links never lead to an empty list: categories and "Free courses" appear only when they have courses. */
export async function SiteFooter() {
  const [cats, free] = await Promise.all([getCategories(), getCourses({ price: "free", pageSize: 1 })]);
  const learn: [string, string][] = [
    ["Browse courses", "/courses"],
    ...cats.filter((c) => (c.courseCount ?? 0) > 0).slice(0, 4).map((c) => [c.name, `/courses?category=${c.slug}`] as [string, string]),
    ...(free.ok && free.total > 0 ? [["Free courses", "/courses?price=free"] as [string, string]] : []),
  ];
  const cols: [string, [string, string][]][] = [
    ["Learn", learn],
    ["Teach", [["Become an instructor", "/teach"], ["Instructor studio", "/studio"], ["Payouts with Stripe", "/teach#payouts"]]],
    ["Your account", [["My learning", "/my-learning"], ["Orders and receipts", "/orders"], ["Verify a certificate", "/certificates/verify"]]],
  ];
  return (
    <footer className="mt-20 border-t border-line bg-surface md:mt-24">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-3 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-14">
        <div className="max-w-xs sm:col-span-3 md:col-span-1">
          <div className="flex items-center gap-2.5">
            <LoopMark className="h-6 w-12" />
            <span className="font-display text-[1.05rem] font-bold tracking-tight">DevOps Easy Learning</span>
          </div>
          <p className="mt-4 text-sm text-muted">Hands-on AI and DevOps courses from engineers who run these systems in production. Every lesson ships with a lab you can run yourself.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            <ul className="mt-3 space-y-2">
              {links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-sm text-muted hover:text-ink">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getUTCFullYear()} DevOps Easy Learning. Payments processed securely by Stripe.</span>
          <span>Prices in USD. Lifetime access to every course you buy.</span>
        </div>
      </div>
    </footer>
  );
}
