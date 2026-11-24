import Link from "next/link";
import { LoopMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <LoopMark className="mx-auto h-12 w-24 opacity-70" />
        <h1 className="mt-6 font-display text-4xl font-extrabold">This page isn’t here</h1>
        <p className="mt-3 text-ink-2">The link may be old, or the course may have been unpublished.</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/courses" className="btn btn-primary">Browse courses</Link><Link href="/" className="btn btn-outline">Home</Link></div>
      </div>
    </div>
  );
}
