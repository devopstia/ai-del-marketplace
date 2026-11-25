import { obj } from "./normalize";

export interface HelpItem { slug: string; title: string; summary: string; audience: "everyone" | "students" | "instructors"; category: string; sort: number; durationSec: number; coverUrl: string | null; hasCaptions: boolean }
export interface HelpCategory { key: string; name: string; description: string; items: HelpItem[] }
export interface Chapter { t: number; title: string }
export interface HelpVideoDetail extends HelpItem { categoryName: string; chapters: Chapter[]; playback: { url: string; format: "mp4" | "hls"; captionsUrl: string | null }; next: HelpItem[] }

const arr = (x: unknown) => (Array.isArray(x) ? x : []);
export const AUDIENCE_LABEL: Record<HelpItem["audience"], string> = { everyone: "Everyone", students: "Students", instructors: "Instructors" };
/** Which support topic fits a help category (for "Still need help?"). */
export const SUPPORT_TOPIC: Record<string, string> = { "getting-started": "other", learning: "course_content", buying: "payments_refunds", teaching: "instructor", account: "account" };

export function toItem(x: unknown): HelpItem {
  const o = obj(x);
  const aud = o.audience === "students" || o.audience === "instructors" ? o.audience : "everyone";
  return { slug: String(o.slug), title: String(o.title ?? ""), summary: String(o.summary ?? ""), audience: aud, category: String(o.category ?? ""), sort: Number(o.sort ?? 0), durationSec: Number(o.durationSec ?? 0), coverUrl: typeof o.coverUrl === "string" ? o.coverUrl : null, hasCaptions: !!o.hasCaptions };
}
export const toChapters = (x: unknown): Chapter[] => arr(x).map((c) => ({ t: Number(obj(c).t ?? 0), title: String(obj(c).title ?? "") })).filter((c) => c.title);
export function toCategories(r: unknown): { categories: HelpCategory[]; total: number } {
  const o = obj(r);
  return { total: Number(o.total ?? 0), categories: arr(o.categories).map((c) => { const x = obj(c); return { key: String(x.key), name: String(x.name), description: String(x.description ?? ""), items: arr(x.items).map(toItem) }; }) };
}
export function toDetail(r: unknown): HelpVideoDetail {
  const o = obj(r); const p = obj(o.playback);
  return { ...toItem(o), categoryName: String(o.categoryName ?? ""), chapters: toChapters(o.chapters), playback: { url: String(p.url ?? ""), format: p.format === "hls" ? "hls" : "mp4", captionsUrl: typeof p.captionsUrl === "string" ? p.captionsUrl : null }, next: arr(o.next).map(toItem) };
}
