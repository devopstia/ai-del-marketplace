import { splitTitle } from '../covers/cover-render';
import type { BannerInput, ShareCard, SharePanel } from './share-render';
import { DEFAULT_FAMILY, type Family, FAMILIES, templateByKey, defaultTemplateFor, type ShareTemplate } from './share-templates';

/**
 * Super Admin › Social Media & Sharing (owner 2026-11-28). Stored as one platform setting (`social_sharing`); every
 * field has a default here, so a fresh database shares well with nothing saved. Only what the site really offers:
 * the texts below describe courses that are live (AI for DevOps on AWS and Azure, n8n, prompt engineering, LLMOps).
 */
export interface SiteText { headline: string; subline: string; cta: string }
export interface SocialSettings {
  /** Default title and description for pages that have none of their own (homepage, catalogue). */
  title: string;
  description: string;
  /** The family of the site banner, and the default family for course banners. */
  family: Family;
  courseFamily: Family;
  /** Site banner texts, one set per family (each family's layout reads best with its own wording). */
  site: Record<Family, SiteText>;
  /** `pro` site banner: the two panels on the right. */
  panels: { template: string; title: string; line: string }[];
  /** `enterprise` site banner: the topic chips. */
  chips: string[];
  /** A validated custom site banner (images/social/upload-site-<hash>.jpg) used instead of the drawn one. */
  siteUploadKey: string | null;
  /** Topic templates instructors and courses may not use (`general` always stays). */
  disabledTemplates: string[];
}

export const DEFAULT_SOCIAL: SocialSettings = {
  title: 'DevOps Easy Learning: AI and DevOps courses',
  // The site's meta description (lib/seo.ts SITE_DESCRIPTION) within 160 characters; no in-browser labs claim.
  description: 'AI and DevOps courses taught by working engineers. Watch on any device and earn a certificate anyone can verify. 12 months of access per course.',
  family: DEFAULT_FAMILY,
  courseFamily: DEFAULT_FAMILY,
  site: {
    pro: { headline: 'AI for DevOps\non AWS & Azure', subline: 'Build, secure and run AI on the cloud your team uses. Real labs, real projects.', cta: 'Explore courses' },
    marketplace: { headline: 'Your journey to\nmastering AI and\nDevOps starts here', subline: 'Free and premium hands-on courses', cta: 'Explore courses' },
    enterprise: { headline: 'Master AI,\nCloud & DevOps', subline: 'Hands-on courses with real labs and certificates', cta: 'Explore courses' },
  },
  panels: [
    { template: 'aws', title: 'AWS', line: 'Bedrock · RAG · Agents' },
    { template: 'azure', title: 'Azure', line: 'Foundry · AI Search' },
  ],
  chips: ['AI agents', 'LLMOps', 'AWS', 'Azure', 'n8n'],
  siteUploadKey: null,
  disabledTemplates: [],
};

/** Saved settings over the defaults; anything malformed falls back to its default. */
export function mergeSettings(raw: unknown): SocialSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<SocialSettings>;
  const fam = (v: unknown, d: Family) => (FAMILIES.includes(v as Family) ? (v as Family) : d);
  const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v : d);
  const site = {} as Record<Family, SiteText>;
  for (const f of FAMILIES) {
    const s = (o.site as Record<string, Partial<SiteText>> | undefined)?.[f] ?? {};
    site[f] = { headline: str(s.headline, DEFAULT_SOCIAL.site[f].headline), subline: typeof s.subline === 'string' ? s.subline : DEFAULT_SOCIAL.site[f].subline, cta: str(s.cta, DEFAULT_SOCIAL.site[f].cta) };
  }
  const panels = Array.isArray(o.panels) && o.panels.length === 2 && o.panels.every((p) => p && templateByKey(p.template) && typeof p.title === 'string' && typeof p.line === 'string') ? o.panels : DEFAULT_SOCIAL.panels;
  return {
    title: str(o.title, DEFAULT_SOCIAL.title),
    description: str(o.description, DEFAULT_SOCIAL.description),
    family: fam(o.family, DEFAULT_SOCIAL.family),
    courseFamily: fam(o.courseFamily, DEFAULT_SOCIAL.courseFamily),
    site,
    panels,
    chips: Array.isArray(o.chips) ? o.chips.filter((c) => typeof c === 'string' && c.trim()).slice(0, 5) : DEFAULT_SOCIAL.chips,
    siteUploadKey: typeof o.siteUploadKey === 'string' ? o.siteUploadKey : null,
    disabledTemplates: Array.isArray(o.disabledTemplates) ? o.disabledTemplates.filter((k) => typeof k === 'string' && templateByKey(k) && k !== 'general') : [],
  };
}

const panelOf = (key: string, title: string, line: string): SharePanel => {
  const t = templateByKey(key) ?? templateByKey('general')!;
  return { symbol: t.symbol, a: t.a, b: t.b, title, line };
};

/** The site banner (homepage, catalogue, topic pages and every page without its own image). */
export function siteBannerInput(s: SocialSettings, family: Family, cards: ShareCard[]): BannerInput {
  const text = s.site[family];
  return {
    family,
    template: templateByKey('devops')!,
    headline: text.headline,
    subline: text.subline,
    cta: text.cta,
    panels: s.panels.map((p) => panelOf(p.template, p.title, p.line)),
    cards: cards.slice(0, 3),
    chips: s.chips,
  };
}

export interface CourseFacts {
  title: string;
  subtitle: string;
  headline?: string | null;
  topic: string | null;
  free: boolean;
  lessons: number;
  durationSec: number;
  /** Real, published courses for the marketplace family's back cards (related first). */
  others: ShareCard[];
  /** Words from the course's own title, objectives and sections (enterprise chips). */
  chips: string[];
}

export function durationLabel(sec: number): string {
  if (sec < 60) return '';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minutes`;
  const h = Math.round((sec / 3600) * 2) / 2;
  return `${String(h).replace(/\.0$/, '')} ${h === 1 ? 'hour' : 'hours'}`;
}

/** A course's banner: its family and template, title (or its custom headline), topic, free badge and real facts. */
export function courseBannerInput(c: CourseFacts, family: Family, t: ShareTemplate): BannerInput {
  const facts = [c.lessons ? `${c.lessons} ${c.lessons === 1 ? 'lesson' : 'lessons'}` : '', durationLabel(c.durationSec)].filter(Boolean).join(' · ') || 'Online course';
  return {
    family,
    template: t,
    headline: (c.headline ?? '').trim() || c.title,
    subline: c.subtitle,
    cta: c.free ? 'Start free course' : 'View course',
    topic: c.topic ?? t.name,
    free: c.free,
    panels: [
      panelOf(t.key, t.key === 'general' ? (c.topic ?? 'Online course') : t.name, facts),
      { symbol: 'certificate', a: '#4f3fb0', b: '#3db1ec', title: 'Certificate', line: 'Verifiable, when you finish' },
    ],
    cards: [{ title: splitTitle(c.title).main, line: c.topic ?? 'Online course', accent: t.a, free: c.free }, ...c.others.slice(0, 2)],
    courseCard: true,
    chips: c.chips,
    symbol: true,
  };
}

/** Technology words the enterprise chips look for, in the course's own text (never invented). */
const VOCAB = ['AI agents', 'MCP', 'RAG', 'LLMOps', 'Prompt engineering', 'Bedrock', 'Foundry', 'AI Search', 'AWS', 'Azure', 'n8n', 'Terraform', 'Kubernetes', 'Docker', 'Helm', 'GitOps', 'CI/CD', 'GitHub Actions', 'Python', 'VS Code', 'Copilot', 'Observability', 'Security', 'Linux', 'Lambda', 'Automation', 'Embeddings', 'Vector search', 'Guardrails', 'Incident triage'];

export function chipsFrom(text: string[], sections: string[]): string[] {
  const all = text.join(' \n ');
  const found = VOCAB.map((w) => ({ w, i: all.search(new RegExp(`(^|[^\\w])${w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^\\w]|$)`, 'i')) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.w);
  const out = [...new Set(found)];
  for (const s of sections) {
    if (out.length >= 3) break;
    const t = s.replace(/^(section|module|part)\s*\d+\s*[:.-]\s*/i, '').trim();
    if (t.length >= 3 && t.length <= 20 && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 5);
}

export { defaultTemplateFor };
