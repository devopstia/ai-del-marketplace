/**
 * The DEL course cover collection (owner brief 2026-11-25). Every template is a combination of one layout, one brand palette
 * and one topic motif, drawn by cover-render.ts with the site's own font. These are the built-in templates; they are seeded
 * into the `cover_templates` table, where a super admin can rename, recolour, re-tag, reorder, activate or deactivate them and
 * add new ones made from the same layouts, palettes and motifs.
 */

export const LAYOUTS = ['statement', 'split', 'band', 'frame', 'spotlight', 'column',
  // The DEL course-catalog family (owner 2026-11-27, "Mix A + C · Night blueprint"): deep ink, course-colour glow,
  // blueprint grid fading in toward an original technology symbol, title left. See docs/COURSE_PLATFORM_REFERENCE.md.
  'night-blueprint',
  // Its approved alternative (owner 2026-11-27, Family B "Light editorial"): paper ground, the course colour as a block on
  // the right third holding the symbol in an ink circle, ink title left.
  'light-editorial'] as const;
export type Layout = (typeof LAYOUTS)[number];

export const MOTIFS = [
  'loop', 'pipeline', 'neural', 'cloud', 'hexgrid', 'terminal', 'shield', 'graph', 'orbit', 'matrix',
  // AI
  'chip', 'circuit', 'chat', 'embedding', 'attention', 'agent',
  // IT
  'server', 'database', 'network', 'gitbranch', 'api', 'container',
  // Generic: abstract designs that suit any course
  'waves', 'blueprint', 'stripes', 'shapes', 'arcs', 'dotgrid', 'blocks', 'minimal',
  // Technology symbols for the night-blueprint family: ORIGINAL drawings, never third-party logos (owner 2026-11-27).
  'cloud-chip', 'cloud-nodes', 'neural-net', 'editor', 'flow-ai',
] as const;
export type Motif = (typeof MOTIFS)[number];

export interface Palette {
  /** Two background stops (diagonal gradient). */
  bg: [string, string];
  /** Title colour. */
  ink: string;
  /** Main and second accent: motif, label, DEL mark. */
  a: string;
  b: string;
  /** Dark or light ground: decides label and mark colours. */
  tone: 'dark' | 'light';
}

export const PALETTES = {
  midnight: { bg: ['#141833', '#231c63'], ink: '#f2f1ff', a: '#9d8fff', b: '#58c3f2', tone: 'dark' },
  ocean: { bg: ['#0a2033', '#0f3b57'], ink: '#eef8ff', a: '#58c3f2', b: '#8ee0c4', tone: 'dark' },
  aurora: { bg: ['#130f30', '#33165a'], ink: '#f7f0ff', a: '#b89cff', b: '#ff9ec2', tone: 'dark' },
  forest: { bg: ['#0a1d18', '#0f3a2c'], ink: '#ecfff6', a: '#3fcf92', b: '#58c3f2', tone: 'dark' },
  ember: { bg: ['#1c1123', '#40192f'], ink: '#fff3ee', a: '#ff9e7a', b: '#f2b53c', tone: 'dark' },
  steel: { bg: ['#0f1626', '#1e2a40'], ink: '#eef3ff', a: '#93c5fd', b: '#9d8fff', tone: 'dark' },
  ice: { bg: ['#eaf4fb', '#d8e8f6'], ink: '#141833', a: '#4f3fb0', b: '#1279b8', tone: 'light' },
  lilac: { bg: ['#f5f3ff', '#e6e1fb'], ink: '#141833', a: '#4f3fb0', b: '#c23a6e', tone: 'light' },
  sand: { bg: ['#fbf6ec', '#f1e6cf'], ink: '#24180a', a: '#8a5a06', b: '#4f3fb0', tone: 'light' },
  cobalt: { bg: ['#0b1a4a', '#1a3a9c'], ink: '#f2f6ff', a: '#8fb4ff', b: '#58c3f2', tone: 'dark' },
  graphite: { bg: ['#111216', '#25262e'], ink: '#f4f4f6', a: '#b7adff', b: '#3fcf92', tone: 'dark' },
  teal: { bg: ['#05282a', '#0b4a4b'], ink: '#effffd', a: '#5eead4', b: '#f2b53c', tone: 'dark' },
  white: { bg: ['#ffffff', '#eef0f6'], ink: '#141833', a: '#141833', b: '#4f3fb0', tone: 'light' },
  rose: { bg: ['#fff4f6', '#fbe3e9'], ink: '#2a0c16', a: '#ad2c45', b: '#4f3fb0', tone: 'light' },
  // Technology accents for the night-blueprint family: one accent per technology on the same deep ink ground.
  'aws-orange': { bg: ['#0b1030', '#171b48'], ink: '#ffffff', a: '#ff9900', b: '#ffb84d', tone: 'dark' },
  'azure-blue': { bg: ['#0b1030', '#171b48'], ink: '#ffffff', a: '#2f8ff0', b: '#6fb6ff', tone: 'dark' },
  'ai-violet': { bg: ['#0b1030', '#171b48'], ink: '#ffffff', a: '#8b7bff', b: '#3db1ec', tone: 'dark' },
  'code-blue': { bg: ['#0b1030', '#171b48'], ink: '#ffffff', a: '#1f9cf0', b: '#5cc0ff', tone: 'dark' },
  'n8n-coral': { bg: ['#0b1030', '#171b48'], ink: '#ffffff', a: '#ff6d5a', b: '#ff9f8f', tone: 'dark' },
} as const satisfies Record<string, Palette>;
export type PaletteKey = keyof typeof PALETTES;

export interface TemplateDef {
  key: string;
  name: string;
  layout: Layout;
  palette: PaletteKey;
  motif: Motif;
  /** Topics it suits; the picker suggests these first and existing courses are matched by them. */
  topics: string[];
  /** Seed order (lower = suggested first for its topics); default: its position in the list × 10. */
  sort?: number;
}

/**
 * Category slugs the night-blueprint templates are suggested for. Adjust here when the catalog's categories are created
 * (courses/COURSE_CATALOG.md); a course in one of these categories gets the matching cover automatically.
 */
export const BLUEPRINT_TOPICS = {
  aws: ['ai-cloud-aws', 'aws'],
  azure: ['ai-cloud-azure', 'azure'],
  ai: ['ai-fundamentals', 'ai-foundations'],
  vscode: ['developer-tools', 'vscode'],
  n8n: ['automation-n8n'],
} as const;

export const BUILT_IN_TEMPLATES: TemplateDef[] = [
  // ---- The DEL catalog family (night blueprint); sorted first so they are suggested before older templates ----
  { key: 'blueprint-aws', name: 'Night blueprint · AWS', layout: 'night-blueprint', palette: 'aws-orange', motif: 'cloud-chip', topics: [...BLUEPRINT_TOPICS.aws], sort: 1 },
  { key: 'blueprint-azure', name: 'Night blueprint · Azure', layout: 'night-blueprint', palette: 'azure-blue', motif: 'cloud-nodes', topics: [...BLUEPRINT_TOPICS.azure], sort: 2 },
  { key: 'blueprint-ai', name: 'Night blueprint · AI', layout: 'night-blueprint', palette: 'ai-violet', motif: 'neural-net', topics: [...BLUEPRINT_TOPICS.ai], sort: 3 },
  { key: 'blueprint-vscode', name: 'Night blueprint · VS Code', layout: 'night-blueprint', palette: 'code-blue', motif: 'editor', topics: [...BLUEPRINT_TOPICS.vscode], sort: 4 },
  { key: 'blueprint-n8n', name: 'Night blueprint · n8n', layout: 'night-blueprint', palette: 'n8n-coral', motif: 'flow-ai', topics: [...BLUEPRINT_TOPICS.n8n], sort: 5 },
  // ---- The approved alternative family (light editorial): offered right after the blueprint ones in the cover picker ----
  { key: 'editorial-aws', name: 'Light editorial · AWS', layout: 'light-editorial', palette: 'aws-orange', motif: 'cloud-chip', topics: [...BLUEPRINT_TOPICS.aws], sort: 6 },
  { key: 'editorial-azure', name: 'Light editorial · Azure', layout: 'light-editorial', palette: 'azure-blue', motif: 'cloud-nodes', topics: [...BLUEPRINT_TOPICS.azure], sort: 7 },
  { key: 'editorial-ai', name: 'Light editorial · AI', layout: 'light-editorial', palette: 'ai-violet', motif: 'neural-net', topics: [...BLUEPRINT_TOPICS.ai], sort: 8 },
  { key: 'editorial-vscode', name: 'Light editorial · VS Code', layout: 'light-editorial', palette: 'code-blue', motif: 'editor', topics: [...BLUEPRINT_TOPICS.vscode], sort: 9 },
  { key: 'editorial-n8n', name: 'Light editorial · n8n', layout: 'light-editorial', palette: 'n8n-coral', motif: 'flow-ai', topics: [...BLUEPRINT_TOPICS.n8n], sort: 10 },
  { key: 'loop-midnight', name: 'Loop', layout: 'statement', palette: 'midnight', motif: 'loop', topics: ['devops', 'ai-for-devops', 'general'] },
  { key: 'pipeline-ocean', name: 'Pipeline', layout: 'band', palette: 'ocean', motif: 'pipeline', topics: ['cicd-gitops', 'devops'] },
  { key: 'neural-aurora', name: 'Neural', layout: 'split', palette: 'aurora', motif: 'neural', topics: ['ai-foundations', 'ai-for-devops', 'mcp-agents'] },
  { key: 'hex-steel', name: 'Cluster', layout: 'statement', palette: 'steel', motif: 'hexgrid', topics: ['kubernetes', 'containers', 'devops'] },
  { key: 'cloud-ice', name: 'Cloud layers', layout: 'band', palette: 'ice', motif: 'cloud', topics: ['cloud-ai', 'cloud'] },
  { key: 'terminal-forest', name: 'Terminal', layout: 'split', palette: 'forest', motif: 'terminal', topics: ['programming', 'automation-n8n', 'linux'] },
  { key: 'shield-ember', name: 'Shield', layout: 'frame', palette: 'ember', motif: 'shield', topics: ['security', 'devsecops'] },
  { key: 'graph-ocean', name: 'Signals', layout: 'column', palette: 'ocean', motif: 'graph', topics: ['observability', 'sre', 'data'] },
  { key: 'orbit-midnight', name: 'Orbit', layout: 'spotlight', palette: 'midnight', motif: 'orbit', topics: ['architecture', 'mcp-agents', 'general'] },
  { key: 'neural-lilac', name: 'Neural light', layout: 'band', palette: 'lilac', motif: 'neural', topics: ['ai-foundations', 'ai-for-devops'] },
  { key: 'loop-steel', name: 'Loop frame', layout: 'frame', palette: 'steel', motif: 'loop', topics: ['devops', 'ai-for-devops'] },
  { key: 'pipeline-aurora', name: 'Workflow', layout: 'column', palette: 'aurora', motif: 'pipeline', topics: ['automation-n8n', 'mcp-agents', 'cicd-gitops'] },
  { key: 'hex-ice', name: 'Cluster light', layout: 'split', palette: 'ice', motif: 'hexgrid', topics: ['kubernetes', 'containers'] },
  { key: 'terminal-midnight', name: 'Shell', layout: 'statement', palette: 'midnight', motif: 'terminal', topics: ['programming', 'linux', 'mcp-agents'] },
  { key: 'cloud-ocean', name: 'Cloud', layout: 'split', palette: 'ocean', motif: 'cloud', topics: ['cloud-ai', 'cloud'] },
  { key: 'shield-forest', name: 'Guardrails', layout: 'statement', palette: 'forest', motif: 'shield', topics: ['security', 'devsecops', 'ai-for-devops'] },
  { key: 'graph-sand', name: 'Metrics light', layout: 'band', palette: 'sand', motif: 'graph', topics: ['observability', 'data', 'sre'] },
  { key: 'matrix-ember', name: 'Data matrix', layout: 'spotlight', palette: 'ember', motif: 'matrix', topics: ['data', 'ai-foundations', 'mlops'] },
  // ---- AI ----
  { key: 'chip-midnight', name: 'AI chip', layout: 'statement', palette: 'midnight', motif: 'chip', topics: ['ai-foundations', 'mlops', 'ai-for-devops'] },
  { key: 'chat-aurora', name: 'LLM chat', layout: 'split', palette: 'aurora', motif: 'chat', topics: ['ai-foundations', 'prompting', 'mcp-agents'] },
  { key: 'embedding-ocean', name: 'Embeddings', layout: 'band', palette: 'ocean', motif: 'embedding', topics: ['cloud-ai', 'rag', 'data'] },
  { key: 'attention-steel', name: 'Attention', layout: 'frame', palette: 'steel', motif: 'attention', topics: ['ai-foundations', 'mlops'] },
  { key: 'agent-forest', name: 'AI agent', layout: 'split', palette: 'forest', motif: 'agent', topics: ['mcp-agents', 'automation-n8n', 'ai-for-devops'] },
  { key: 'circuit-ember', name: 'Circuit', layout: 'column', palette: 'ember', motif: 'circuit', topics: ['mlops', 'ai-for-devops', 'programming'] },
  { key: 'chat-lilac', name: 'Prompt light', layout: 'band', palette: 'lilac', motif: 'chat', topics: ['ai-foundations', 'prompting'] },
  { key: 'embedding-ice', name: 'Vectors light', layout: 'split', palette: 'ice', motif: 'embedding', topics: ['cloud-ai', 'rag'] },
  { key: 'agent-midnight', name: 'Agent hub', layout: 'spotlight', palette: 'midnight', motif: 'agent', topics: ['mcp-agents', 'ai-for-devops'] },
  // ---- IT ----
  { key: 'server-steel', name: 'Server rack', layout: 'split', palette: 'steel', motif: 'server', topics: ['linux', 'infrastructure', 'devops'] },
  { key: 'database-ocean', name: 'Databases', layout: 'statement', palette: 'ocean', motif: 'database', topics: ['data', 'databases', 'cloud'] },
  { key: 'network-midnight', name: 'Network', layout: 'band', palette: 'midnight', motif: 'network', topics: ['networking', 'kubernetes', 'cloud'] },
  { key: 'gitbranch-forest', name: 'Branches', layout: 'column', palette: 'forest', motif: 'gitbranch', topics: ['cicd-gitops', 'programming'] },
  { key: 'api-aurora', name: 'API', layout: 'frame', palette: 'aurora', motif: 'api', topics: ['programming', 'mcp-agents', 'automation-n8n'] },
  { key: 'container-ocean', name: 'Containers', layout: 'split', palette: 'ocean', motif: 'container', topics: ['containers', 'kubernetes', 'devops'] },
  { key: 'circuit-ice', name: 'Circuit light', layout: 'band', palette: 'ice', motif: 'circuit', topics: ['infrastructure', 'programming'] },
  { key: 'network-sand', name: 'Network light', layout: 'split', palette: 'sand', motif: 'network', topics: ['networking', 'infrastructure'] },
  { key: 'database-lilac', name: 'Data light', layout: 'statement', palette: 'lilac', motif: 'database', topics: ['data', 'databases'] },
  // ---- Generic: fit any course ----
  { key: 'waves-midnight', name: 'Waves', layout: 'statement', palette: 'midnight', motif: 'waves', topics: ['general'] },
  { key: 'waves-ice', name: 'Waves light', layout: 'band', palette: 'ice', motif: 'waves', topics: ['general'] },
  { key: 'blueprint-cobalt', name: 'Blueprint', layout: 'split', palette: 'cobalt', motif: 'blueprint', topics: ['general', 'architecture'] },
  { key: 'blueprint-steel', name: 'Blueprint frame', layout: 'frame', palette: 'steel', motif: 'blueprint', topics: ['general', 'architecture'] },
  { key: 'stripes-ember', name: 'Stripes', layout: 'column', palette: 'ember', motif: 'stripes', topics: ['general'] },
  { key: 'stripes-white', name: 'Stripes light', layout: 'band', palette: 'white', motif: 'stripes', topics: ['general'] },
  { key: 'shapes-aurora', name: 'Shapes', layout: 'statement', palette: 'aurora', motif: 'shapes', topics: ['general'] },
  { key: 'shapes-sand', name: 'Shapes light', layout: 'split', palette: 'sand', motif: 'shapes', topics: ['general'] },
  { key: 'arcs-teal', name: 'Arcs', layout: 'statement', palette: 'teal', motif: 'arcs', topics: ['general'] },
  { key: 'arcs-graphite', name: 'Arcs graphite', layout: 'split', palette: 'graphite', motif: 'arcs', topics: ['general'] },
  { key: 'dotgrid-ocean', name: 'Dot grid', layout: 'frame', palette: 'ocean', motif: 'dotgrid', topics: ['general'] },
  { key: 'dotgrid-rose', name: 'Dot grid light', layout: 'band', palette: 'rose', motif: 'dotgrid', topics: ['general'] },
  { key: 'blocks-cobalt', name: 'Blocks', layout: 'column', palette: 'cobalt', motif: 'blocks', topics: ['general'] },
  { key: 'blocks-graphite', name: 'Blocks graphite', layout: 'band', palette: 'graphite', motif: 'blocks', topics: ['general'] },
  { key: 'minimal-graphite', name: 'Minimal', layout: 'frame', palette: 'graphite', motif: 'minimal', topics: ['general'] },
  { key: 'minimal-white', name: 'Minimal light', layout: 'frame', palette: 'white', motif: 'minimal', topics: ['general'] },
];

/** Used when a course has no template yet or its template was deactivated. */
export const FALLBACK_TEMPLATE_KEY = 'loop-midnight';

/** How the picker and the admin page group templates. */
export type TemplateGroup = 'generic' | 'ai' | 'it' | 'devops';
const GROUPS: Record<Motif, TemplateGroup> = {
  waves: 'generic', blueprint: 'generic', stripes: 'generic', shapes: 'generic', arcs: 'generic', dotgrid: 'generic', blocks: 'generic', minimal: 'generic',
  neural: 'ai', chip: 'ai', chat: 'ai', embedding: 'ai', attention: 'ai', agent: 'ai', circuit: 'ai', matrix: 'ai',
  server: 'it', database: 'it', network: 'it', api: 'it', container: 'it', terminal: 'it', hexgrid: 'it', cloud: 'it', shield: 'it',
  loop: 'devops', pipeline: 'devops', gitbranch: 'devops', graph: 'devops', orbit: 'devops',
  'cloud-chip': 'ai', 'cloud-nodes': 'ai', 'neural-net': 'ai', editor: 'it', 'flow-ai': 'devops',
};
export const groupOf = (m: Motif): TemplateGroup => GROUPS[m];
