import Link from "next/link";

/** Ranked list: label, a bar to scale and the value in its own column (so the longest bar never pushes it off). */
export function BarList({ items, format }: { items: { key: string; label: string; value: number; href?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-3" data-testid="bar-list">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
          <span className="truncate">{i.href ? <Link href={i.href} className="hover:text-violet">{i.label}</Link> : i.label}</span>
          <span className="row-span-2 self-center text-right tabular-nums">{format(i.value)}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-violet" style={{ width: `${i.value ? Math.max(3, (i.value / max) * 100) : 0}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}
