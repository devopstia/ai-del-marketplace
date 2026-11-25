/** <input type="datetime-local"> works in the viewer's local time; the API stores UTC instants. */
export function toLocalInput(d: Date | string): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const fromLocalInput = (s: string): string | null => {
  if (!s) return null;
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};
export const inDays = (n: number, from = new Date()) => new Date(from.getTime() + n * 86400_000);
export const fmtWhen = (d: string) => new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
export const statusLabel: Record<string, string> = { scheduled: "Scheduled", active: "Running", ended: "Ended", canceled: "Cancelled" };
export const statusClass: Record<string, string> = {
  scheduled: "bg-cyan-soft text-cyan-ink",
  active: "bg-rose-soft text-rose",
  ended: "bg-surface-2 text-muted",
  canceled: "bg-surface-2 text-muted",
};
