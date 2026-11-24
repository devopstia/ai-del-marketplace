"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Award, Download, Infinity as InfinityIcon, Loader2, MonitorPlay, PlayCircle, ShoppingCart, Smartphone } from "lucide-react";
import { api, ApiError, errMsg } from "@/lib/api";
import { list, obj } from "@/lib/normalize";
import { hours, money } from "@/lib/format";
import type { CourseDetail } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";
import { CourseCover } from "./CourseCover";
import { PreviewButton } from "./PreviewContext";

export function PurchaseCard({ course, firstPreviewId }: { course: CourseDetail; firstPreviewId?: string }) {
  const { me, refreshCart } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(!!course.enrolled);
  const [inCart, setInCart] = useState(!!course.inCart);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);

  useEffect(() => {
    if (!me || course.enrolled) return;
    let alive = true;
    api(`/me/courses/${course.slug}`).then(() => alive && setEnrolled(true)).catch(() => {});
    api("/cart").then((c) => alive && setInCart(list(c, "items").some((i) => {
      const o = obj(i);
      return o.courseId === course.id || obj(o.course).id === course.id || obj(o.course).slug === course.slug;
    }))).catch(() => {});
    return () => { alive = false; };
  }, [me, course.enrolled, course.id, course.slug]);

  async function add(): Promise<boolean> {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`);
      return false;
    }
    try {
      await api("/cart", { method: "POST", body: { courseId: course.id } });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) {
        toast("error", errMsg(e));
        return false;
      }
    }
    setInCart(true);
    void refreshCart();
    return true;
  }

  const free = course.priceCents === 0;
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-float" data-testid="purchase-card">
      <div className="relative">
        <CourseCover slug={course.slug} title={course.title} category={course.category?.name} thumbnailUrl={course.thumbnailUrl} className="!rounded-none" />
        {firstPreviewId ? (
          <PreviewButton lectureId={firstPreviewId} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 font-bold text-white transition-colors hover:bg-black/45">
            <span className="grid size-16 place-items-center rounded-full bg-white text-[#141833] shadow-float"><PlayCircle className="size-8" /></span>
            Preview this course
          </PreviewButton>
        ) : null}
      </div>
      <div className="p-5 sm:p-6">
        {enrolled ? (
          <>
            <p className="font-display text-lg font-bold text-ink">You’re enrolled in this course</p>
            <Link href={`/learn/${course.slug}`} className="btn btn-primary mt-4 w-full" data-testid="go-to-course">Go to course</Link>
          </>
        ) : (
          <>
            <p className={`font-display text-[2rem] font-extrabold leading-none ${free ? "text-mint" : "text-ink"}`}>{money(course.priceCents, course.currency)}</p>
            <div className="mt-5 grid gap-2.5">
              {inCart ? (
                <Link href="/cart" className="btn btn-primary w-full"><ShoppingCart className="size-4" />Go to cart</Link>
              ) : (
                <button type="button" className="btn btn-primary w-full" disabled={!!busy} data-testid="add-to-cart"
                  onClick={async () => { setBusy("cart"); if (await add()) toast("ok", "Added to your cart."); setBusy(null); }}>
                  {busy === "cart" ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}{free ? "Add free course to cart" : "Add to cart"}
                </button>
              )}
              <button type="button" className="btn btn-outline w-full" disabled={!!busy} data-testid="buy-now"
                onClick={async () => { setBusy("buy"); if (await add()) router.push("/checkout"); else setBusy(null); }}>
                {busy === "buy" ? <Loader2 className="size-4 animate-spin" /> : null}{free ? "Enrol now" : "Buy now"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">Secure checkout with Stripe. Lifetime access.</p>
          </>
        )}
        <h3 className="mt-6 font-display text-sm font-bold text-ink">This course includes</h3>
        <ul className="mt-2.5 space-y-2 text-sm text-ink-2">
          <li className="flex items-center gap-2.5"><MonitorPlay className="size-4 text-muted" />{hours(course.totalDurationSec)} of on-demand video</li>
          <li className="flex items-center gap-2.5"><Download className="size-4 text-muted" />Downloadable lab files</li>
          <li className="flex items-center gap-2.5"><Smartphone className="size-4 text-muted" />Watch on desktop or mobile</li>
          <li className="flex items-center gap-2.5"><InfinityIcon className="size-4 text-muted" />Full lifetime access</li>
          <li className="flex items-center gap-2.5"><Award className="size-4 text-muted" />Certificate of completion</li>
        </ul>
      </div>
    </div>
  );
}
