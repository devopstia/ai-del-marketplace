import { hash, initials } from "@/lib/format";

const tones = [
  ["var(--violet-soft)", "var(--violet)"],
  ["var(--cyan-soft)", "var(--cyan-ink)"],
  ["var(--mint-soft)", "var(--mint)"],
  ["var(--amber-soft)", "var(--amber)"],
];

export function Avatar({ name, src, size = 40, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [bg, fg] = tones[hash(name) % tones.length]!;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${className}`} style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}
