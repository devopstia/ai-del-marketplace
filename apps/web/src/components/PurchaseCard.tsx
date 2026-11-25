"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Award, Captions, Download, FileText, Infinity as InfinityIcon, ListChecks, Loader2, MonitorPlay, PlayCircle, RotateCcw, ShoppingCart, Smartphone } from "lucide-react";
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
    // The course payload already carries the viewer block when the server saw the session: no extra probes.
    if (!me || course.enrolled || course.viewerSignedIn) return;
    let alive = true;
    api(`/me/courses/${course.slug}`).then(() => alive && setEnrolled(true)).catch(() => {});
    api("/cart").then((c) => alive && setInCart(list(c, "items").some((i) => {
      const o = obj(i);
      return o.courseId === course.id || obj(o.course).id === course.id || obj(o.course).slug === course.slug;
    }))).catch(() => {});
    return () => { alive = false; };
  }, [me, course.enrolled, course.viewerSignedIn, course.id, course.slug]);

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
  const quizzes = course.sections.reduce((a, s) => a + s.lectures.filter((l) => l.hasQuiz).length, 0);
  const lectures = course.sections.flatMap((s) => s.lectures);
  const videoSec = lectures.filter((l) => l.type === "video").reduce((a, l) => a + l.durationSec, 0);
  const readings = lectures.filter((l) => l.type === "article").length;
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-float" data-testid="purchase-card">
      <div className="relative">
        <CourseCover slug={course.slug} title={course.title} category={course.category?.name} thumbnailUrl={course.thumbnailUrl} className="!rounded-none" />
        {firstPreviewId ? (
          <PreviewButton lectureId={firstPreviewId} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 font-bold text-white transition-colors hover:bg-black/55">
            <span className="grid size-16 place-items-center rounded-full bg-white text-[#141833] shadow-float"><PlayCircle className="size-8" /></span>
            <span className="rounded-full bg-black/75 px-3 py-1 text-sm">Preview this course</span>
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
            {!free ? <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted"><RotateCcw className="size-3.5" aria-hidden="true" />14-day refund while you’ve watched under 25%</p> : null}
          </>
        )}
        <h3 className="mt-6 font-display text-sm font-bold text-ink">This course includes</h3>
        <ul className="mt-2.5 space-y-2 text-sm text-ink-2">
          {videoSec ? <li className="flex items-center gap-2.5"><MonitorPlay className="size-4 text-muted" />{hours(videoSec)} of on-demand video</li> : null}
          {readings ? <li className="flex items-center gap-2.5"><FileText className="size-4 text-muted" />{readings} {readings === 1 ? "reading" : "readings"}</li> : null}
          {course.hasCaptions ? <li className="flex items-center gap-2.5"><Captions className="size-4 text-muted" />English captions (off until you turn them on)</li> : null}
          {quizzes ? <li className="flex items-center gap-2.5"><ListChecks className="size-4 text-muted" />{quizzes} short {quizzes === 1 ? "quiz" : "quizzes"} with explanations</li> : null}
          {course.resourceCount > 0 ? <li className="flex items-center gap-2.5"><Download className="size-4 text-muted" />Downloadable lab files</li> : null}
          <li className="flex items-center gap-2.5"><Smartphone className="size-4 text-muted" />Watch on desktop or mobile</li>
          <li className="flex items-center gap-2.5"><InfinityIcon className="size-4 text-muted" />Full lifetime access</li>
          <li className="flex items-center gap-2.5"><Award className="size-4 text-muted" />Certificate of completion</li>
        </ul>
      </div>
    </div>
  );
}
