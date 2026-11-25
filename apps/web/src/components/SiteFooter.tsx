import Link from "next/link";
import { LoopMark } from "./Logo";
import { DEL_PROGRAM, programLink } from "@/lib/del-program";
import { SocialLinks } from "./SocialLinks";

const cols: [string, [string, string][]][] = [
  ["Learn", [["Browse courses", "/courses"], ["AI for DevOps", "/courses?category=ai-for-devops"], ["MCP & Agents", "/courses?category=mcp-agents"], ["Free courses", "/courses?price=free"], ["Full training program ↗", programLink(DEL_PROGRAM.aboutUrl, "footer")], ["DevOps Easy Learning ↗", programLink("https://www.devopseasylearning.com/", "footer")]]],
  ["Teach", [["Become an instructor", "/teach"], ["Instructor studio", "/studio"], ["Payouts with Stripe", "/teach#payouts"]]],
  ["Your account", [["Student Studio", "/student"], ["My courses", "/student/courses"], ["Purchase history", "/student/purchases"], ["Contact us", "/contact"], ["Verify a certificate", "/certificates/verify"], ["Platform videos", "/help"], ["Help and support", "/support"], ["Install the app", "/install"]]],
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <LoopMark className="h-7 w-14" />
            <span className="font-display text-lg font-extrabold tracking-tight">DevOps Easy Learning</span>
          </div>
          <p className="mt-4 text-sm text-muted">Hands-on AI and DevOps courses from engineers who run these systems in production. Every lesson ships with a lab you can run yourself.</p>
          <SocialLinks className="-ml-2 mt-4" />
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
            <ul className="mt-3 space-y-2">
              {links.map(([label, href]) => (
                <li key={href}>{href.startsWith("http") ? <a href={href} target="_blank" rel="noopener" className="text-sm text-muted hover:text-ink">{label}</a> : <Link href={href} className="text-sm text-muted hover:text-ink">{label}</Link>}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <span>© {new Date().getUTCFullYear()} DevOps Easy Learning. Payments processed securely by Stripe.</span>
          <span>Prices in USD. Each purchase includes 12 months of access. <Link href="/policies/access-and-refunds" className="underline-offset-2 hover:underline">Access and refunds</Link></span>
        </div>
      </div>
    </footer>
  );
}
