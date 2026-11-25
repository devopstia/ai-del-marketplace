import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import type { DealsSummary } from "@/lib/catalog";
import { SaleEnds } from "./SaleEnds";

/** One slim line above the header while a marketplace promotion runs; it disappears by itself when the promotion ends. */
export function SaleBanner({ deals }: { deals: DealsSummary | null }) {
  const p = deals?.promotions[0];
  if (!p) return null;
  const where = p.scope === "all" ? "every course" : "selected courses";
  return (
    <div className="bg-stage text-white">
      <Link href="/deals" className="container-x flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 py-2 text-center text-sm hover:underline" data-testid="sale-banner">
        <Tag className="size-4 shrink-0 text-[#ff9ec2]" aria-hidden="true" />
        <span><b className="font-display">{p.name}:</b> {p.percentOff}% off {where}</span>
        <span className="text-white/70">·</span>
        <SaleEnds endsAt={p.endsAt} className="font-bold text-[#ff9ec2]" />
        <span className="inline-flex items-center gap-1 font-bold">See deals<ArrowRight className="size-4" aria-hidden="true" /></span>
      </Link>
    </div>
  );
}
