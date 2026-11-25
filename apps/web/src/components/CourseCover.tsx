import { hash } from "@/lib/format";
import { LOOP_FULL } from "./Logo";

/**
 * Course covers. When the instructor uploaded a thumbnail we show it; otherwise we typeset an
 * "edition" cover so the catalogue reads as one designed series instead of grey placeholders.
 */
const grounds = [
  { bg: "#1a1650", a: "#7c6cf2", b: "#3fb6ea" },
  { bg: "#0d2b40", a: "#3fb6ea", b: "#8ee0c4" },
  { bg: "#251246", a: "#b48cff", b: "#ff9ec2" },
  { bg: "#132136", a: "#5ad0a0", b: "#3fb6ea" },
  { bg: "#2b1838", a: "#f2b53c", b: "#9d8fff" },
  { bg: "#0f1b3d", a: "#58c3f2", b: "#9d8fff" },
];

function Pattern({ seed, a, b }: { seed: number; a: string; b: string }) {
  const kind = seed % 4;
  if (kind === 0) {
    // Concentric loops: the DEL mark echoing outward
    return (
      <g fill="none" strokeLinecap="round">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={LOOP_FULL} stroke={i % 2 ? b : a} strokeOpacity={0.75 - i * 0.12} strokeWidth={2.4}
            transform={`translate(${250 - i * 28} ${40 - i * 14}) scale(${1.8 + i * 0.45})`} />
        ))}
      </g>
    );
  }
  if (kind === 1) {
    // Pipeline stages: stepped bars
    return (
      <g>
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={210 + i * 22} y={150 - ((i * 37 + seed) % 110)} width={12} height={40 + ((i * 53 + seed) % 120)} rx={6}
            fill={i % 3 === 0 ? b : a} opacity={0.35 + ((i * 17) % 50) / 100} />
        ))}
      </g>
    );
  }
  if (kind === 2) {
    // Node graph: agents and their connections
    const pts = Array.from({ length: 7 }).map((_, i) => [250 + ((seed >> (i * 2)) % 130), 30 + ((seed >> (i * 3)) % 150)] as const);
    return (
      <g>
        {pts.slice(1).map(([x, y], i) => (
          <line key={i} x1={pts[i]![0]} y1={pts[i]![1]} x2={x} y2={y} stroke={a} strokeOpacity={0.55} strokeWidth={2} />
        ))}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 0 ? 11 : 6} fill={i === 0 ? b : a} />
        ))}
      </g>
    );
  }
  // Dot field fading toward the title
  return (
    <g>
      {Array.from({ length: 70 }).map((_, i) => {
        const col = i % 10;
        const row = Math.floor(i / 10);
        return <circle key={i} cx={232 + col * 17} cy={22 + row * 25} r={2 + ((i * seed) % 5) / 2} fill={(i + seed) % 4 ? a : b} opacity={0.2 + col / 13} />;
      })}
    </g>
  );
}

/** Cover seeds for a grid, read left to right: a cover never repeats the pattern or ground of the one before it or
 *  two before it (the one above in a two-column grid). Unchanged covers keep their usual look. */
export function coverSeeds(slugs: string[]): number[] {
  const out: number[] = [];
  slugs.forEach((slug, i) => {
    let s = hash(slug);
    const clash = (x: number) => [out[i - 1], out[i - 2]].some((o) => o !== undefined && (o % 4 === x % 4 || o % grounds.length === x % grounds.length));
    for (let n = 0; n < 24 && clash(s); n++) s++;
    out.push(s);
  });
  return out;
}

export function CourseCover({
  slug, title, category, thumbnailUrl, size = "md", className = "", seed: seedOverride, showTitle = true,
}: { slug: string; title: string; category?: string | null; thumbnailUrl?: string | null; size?: "sm" | "md" | "lg"; className?: string; seed?: number; showTitle?: boolean }) {
  const seed = seedOverride ?? hash(slug || title);
  const g = grounds[seed % grounds.length]!;
  const titleCls = size === "lg" ? "text-[clamp(1.4rem,3vw,2.1rem)]" : size === "sm" ? "text-[0.78rem]" : "text-[1.02rem]";
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-tile ${className}`} style={{ background: g.bg }}>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <>
          <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
            <Pattern seed={seed} a={g.a} b={g.b} />
          </svg>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.35),transparent_70%)]" />
          <div className={`absolute inset-0 flex flex-col justify-between ${size === "sm" ? "p-2.5" : size === "lg" ? "p-6 sm:p-8" : "p-4"}`}>
            {size !== "sm" && category ? (
              <span className="w-fit rounded-full bg-white/12 px-2 py-0.5 text-[0.7rem] font-bold text-white/85 backdrop-blur-sm">{category}</span>
            ) : <span />}
            {showTitle ? <span className={`max-w-[68%] font-display font-extrabold leading-[1.08] tracking-[-0.02em] text-white ${titleCls} line-clamp-3`}>{title}</span> : null}
          </div>
        </>
      )}
    </div>
  );
}
