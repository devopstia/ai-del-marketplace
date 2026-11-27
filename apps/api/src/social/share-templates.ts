/**
 * Sharing banners (owner 2026-11-28, docs/SOCIAL_SHARING.md): the 1200×630 image WhatsApp, Facebook, LinkedIn, X and
 * Telegram show when someone shares the site or a course.
 *
 * A banner = one FAMILY (the layout the owner picked from the five designs) + one TOPIC TEMPLATE (the technology's
 * accent colours, symbol and name). Every topic template exists in every family, so a course keeps its topic look when
 * the family changes. Families:
 *   - `pro`         design 3 "Cloud and DevOps professional" (light sky-blue, two white panels): the DEFAULT;
 *   - `marketplace` design 4 "Premium learning marketplace" (violet, stacked real course cards, certificate seal);
 *   - `enterprise`  design 1 "Modern enterprise technology" (deep ink, blueprint grid, circuits, topic chips): the
 *                   night-blueprint course covers' family.
 * All symbols are original drawings: never AWS, Microsoft, HashiCorp, CNCF or other third-party logos.
 */

export const FAMILIES = ['pro', 'marketplace', 'enterprise'] as const;
export type Family = (typeof FAMILIES)[number];
export const DEFAULT_FAMILY: Family = 'pro';
export const FAMILY_NAMES: Record<Family, string> = {
  pro: 'Cloud and DevOps professional',
  marketplace: 'Premium learning marketplace',
  enterprise: 'Modern enterprise technology',
};

/** Symbols: cover motifs reused from covers/cover-render.ts plus five drawn for sharing banners in share-render.ts. */
export const SHARE_SYMBOLS = ['neural-net', 'cloud-chip', 'cloud-nodes', 'editor', 'flow-ai', 'loop', 'tf-blocks', 'k8s-wheel', 'shield-lock', 'brackets', 'spark'] as const;
export type ShareSymbol = (typeof SHARE_SYMBOLS)[number];

export interface ShareTemplate {
  key: string;
  /** Shown in the pickers and as the topic panel's name on `pro` banners. */
  name: string;
  symbol: ShareSymbol;
  /** Main and second accent (#rrggbb). */
  a: string;
  b: string;
  /** Category slugs this template is the default for (first match wins, in list order). */
  topics: string[];
}

export const SHARE_TEMPLATES: ShareTemplate[] = [
  { key: 'aws', name: 'AWS', symbol: 'cloud-chip', a: '#ff9900', b: '#ffb84d', topics: ['ai-cloud-aws', 'aws'] },
  { key: 'azure', name: 'Azure', symbol: 'cloud-nodes', a: '#2f8ff0', b: '#6fb6ff', topics: ['ai-cloud-azure', 'azure'] },
  { key: 'terraform', name: 'Terraform', symbol: 'tf-blocks', a: '#8a5cf6', b: '#3db1ec', topics: ['terraform', 'infrastructure-as-code', 'iac'] },
  { key: 'kubernetes', name: 'Kubernetes', symbol: 'k8s-wheel', a: '#3a7bf0', b: '#58c3f2', topics: ['kubernetes', 'containers'] },
  { key: 'automation', name: 'Automation', symbol: 'flow-ai', a: '#ff6d5a', b: '#ff9f8f', topics: ['automation-n8n', 'automation'] },
  { key: 'software-dev', name: 'Software development', symbol: 'brackets', a: '#1f9cf0', b: '#5cc0ff', topics: ['developer-tools', 'vscode', 'programming', 'web-development'] },
  { key: 'cybersecurity', name: 'Security', symbol: 'shield-lock', a: '#14a37a', b: '#3fcf92', topics: ['security', 'devsecops', 'cybersecurity'] },
  { key: 'ai', name: 'AI', symbol: 'neural-net', a: '#8b7bff', b: '#3db1ec', topics: ['ai-fundamentals', 'ai-foundations', 'ai-for-devops', 'mcp-agents', 'mlops', 'llmops', 'prompt-engineering', 'cloud-ai', 'data'] },
  { key: 'devops', name: 'DevOps', symbol: 'loop', a: '#4f3fb0', b: '#3db1ec', topics: ['devops', 'cicd-gitops', 'linux', 'observability', 'sre', 'cloud', 'architecture'] },
  { key: 'general', name: 'DevOps Easy Learning', symbol: 'spark', a: '#4f3fb0', b: '#1e9bd7', topics: ['general'] },
];
export const FALLBACK_SHARE_TEMPLATE = 'general';
export const SHARE_TEMPLATE_KEYS = SHARE_TEMPLATES.map((t) => t.key);

export const templateByKey = (key: string | null | undefined) => SHARE_TEMPLATES.find((t) => t.key === key);

/** The template a course in this category gets by default, skipping disabled ones; `general` is never disabled. */
export function defaultTemplateFor(categorySlug: string | null | undefined, disabled: readonly string[] = []): ShareTemplate {
  const ok = (t: ShareTemplate) => !disabled.includes(t.key) || t.key === FALLBACK_SHARE_TEMPLATE;
  return (categorySlug && SHARE_TEMPLATES.find((t) => ok(t) && t.topics.includes(categorySlug))) || templateByKey(FALLBACK_SHARE_TEMPLATE)!;
}
