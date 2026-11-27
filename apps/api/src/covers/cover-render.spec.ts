import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrast, coverPng, coverSvg, fitTitle, readableAccent, splitTitle } from './cover-render';
import { BLUEPRINT_TOPICS, BUILT_IN_TEMPLATES, LAYOUTS, MOTIFS, PALETTES } from './cover-templates';

describe('cover renderer', () => {
  it('fits titles within the line limit, shrinking before it ever cuts', () => {
    const short = fitTitle('Bash', 600, 3, 92, 46);
    expect(short).toMatchObject({ size: 92, lines: ['Bash'] });
    const long = fitTitle('AI for DevOps: from the vocabulary of AI to agents in production', 600, 4, 88, 46);
    expect(long.lines.length).toBeLessThanOrEqual(4);
    expect(long.lines.join(' ')).toBe('AI for DevOps: from the vocabulary of AI to agents in production');
  });

  it('shortens a title that cannot fit, and breaks a single word wider than the box', () => {
    const huge = fitTitle('word '.repeat(80).trim(), 600, 3, 88, 44);
    expect(huge.lines).toHaveLength(3);
    expect(huge.lines[2]!.endsWith('…')).toBe(true);
    const word = fitTitle('Supercalifragilisticexpialidocious-infrastructure-as-code-and-more', 600, 2, 80, 42);
    expect(word.lines.length).toBeLessThanOrEqual(2);
    expect(word.size).toBeGreaterThanOrEqual(28);
  });

  it('escapes the title in the drawing', () => {
    const svg = coverSvg({ layout: 'split', palette: PALETTES.midnight, motif: 'loop' }, { title: '<script>&"', topic: 'A & B' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;&amp;&quot;');
  });

  it('every built-in template renders a 1280x720 PNG, and keys are unique', () => {
    expect(new Set(BUILT_IN_TEMPLATES.map((t) => t.key)).size).toBe(BUILT_IN_TEMPLATES.length);
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThanOrEqual(52);
    for (const t of BUILT_IN_TEMPLATES) {
      expect(LAYOUTS).toContain(t.layout);
      expect(MOTIFS).toContain(t.motif);
      const png = coverPng({ layout: t.layout, palette: PALETTES[t.palette], motif: t.motif }, { title: 'Kubernetes Networking', topic: 'Kubernetes' });
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(1280);
      expect(png.readUInt32BE(20)).toBe(720);
    }
  });
});

describe('night-blueprint family (owner 2026-11-27)', () => {
  const CASES: [string, string, string][] = [
    ['blueprint-aws', 'AI for DevOps on AWS: From Fundamentals to Production', 'AWS · Amazon Bedrock'],
    ['blueprint-azure', 'AI for DevOps on Azure: From Fundamentals to Production', 'Microsoft Azure · Foundry'],
    ['blueprint-ai', 'Introduction to AI for DevOps', 'Artificial Intelligence'],
    ['blueprint-vscode', 'VS Code Masterclass for DevOps and AI', 'Visual Studio Code'],
    ['blueprint-n8n', 'AI-Powered DevOps Automation with n8n', 'n8n · Automation'],
  ];
  const out = process.env.COVER_SAMPLES_DIR;

  it('splits "Title: Subtitle" and keeps other titles whole', () => {
    expect(splitTitle('AI for DevOps on AWS: From Fundamentals to Production')).toEqual({ main: 'AI for DevOps on AWS', sub: 'From Fundamentals to Production' });
    expect(splitTitle('Terraform Basics')).toEqual({ main: 'Terraform Basics', sub: null });
    expect(splitTitle('A: b')).toEqual({ main: 'A: b', sub: null });
  });

  it.each(CASES)('%s renders long and short titles at 1280x720 with no third-party logo', (key, title, topic) => {
    const t = BUILT_IN_TEMPLATES.find((x) => x.key === key)!;
    expect(t.layout).toBe('night-blueprint');
    const variants: [string, string][] = [['', title], ['-short', 'Bash'], ['-long', `${title} with Kubernetes, Terraform, GitHub Actions and Argo CD in production`]];
    for (const [suffix, tt] of variants) {
      const spec = { layout: t.layout, palette: PALETTES[t.palette], motif: t.motif };
      const svg = coverSvg(spec, { title: tt, topic });
      expect(svg).not.toMatch(/<image|href=/); // drawn shapes only: no embedded logo files
      const png = coverPng(spec, { title: tt, topic });
      expect(png.readUInt32BE(16)).toBe(1280);
      expect(png.readUInt32BE(20)).toBe(720);
      if (out) {
        writeFileSync(join(out, `${key}${suffix}.png`), png);
        if (!suffix) writeFileSync(join(out, `${key}-320.png`), coverPng(spec, { title: tt, topic }, 320));
      }
    }
  });

  it('a course in a mapped category is suggested its night-blueprint template first', () => {
    const sorted = BUILT_IN_TEMPLATES.map((t, i) => ({ t, sort: t.sort ?? (i + 1) * 10 })).sort((a, b) => a.sort - b.sort);
    const expected: [string, string][] = [['automation-n8n', 'blueprint-n8n'], [BLUEPRINT_TOPICS.aws[0], 'blueprint-aws'], [BLUEPRINT_TOPICS.azure[0], 'blueprint-azure'], [BLUEPRINT_TOPICS.ai[0], 'blueprint-ai'], [BLUEPRINT_TOPICS.vscode[0], 'blueprint-vscode']];
    for (const [slug, key] of expected) expect(sorted.find(({ t }) => t.topics.includes(slug))?.t.key).toBe(key);
  });
});

describe('light-editorial family, the approved alternative (owner 2026-11-27)', () => {
  const CASES: [string, string, string][] = [
    ['editorial-aws', 'AI for DevOps on AWS: From Fundamentals to Production', 'AWS · Amazon Bedrock'],
    ['editorial-azure', 'AI for DevOps on Azure: From Fundamentals to Production', 'Microsoft Azure · Foundry'],
    ['editorial-ai', 'Introduction to AI for DevOps', 'Artificial Intelligence'],
    ['editorial-vscode', 'VS Code Masterclass for DevOps and AI', 'Visual Studio Code'],
    ['editorial-n8n', 'AI-Powered DevOps Automation with n8n', 'n8n · Automation'],
  ];
  const out = process.env.COVER_SAMPLES_DIR;

  it.each(CASES)('%s renders long and short titles at 1280x720 with no third-party logo', (key, title, topic) => {
    const t = BUILT_IN_TEMPLATES.find((x) => x.key === key)!;
    expect(t.layout).toBe('light-editorial');
    const variants: [string, string][] = [['', title], ['-short', 'Bash'], ['-long', `${title} with Kubernetes, Terraform, GitHub Actions and Argo CD in production`]];
    for (const [suffix, tt] of variants) {
      const spec = { layout: t.layout, palette: PALETTES[t.palette], motif: t.motif };
      const svg = coverSvg(spec, { title: tt, topic });
      expect(svg).not.toMatch(/<image|href=/);
      const png = coverPng(spec, { title: tt, topic });
      expect(png.readUInt32BE(16)).toBe(1280);
      expect(png.readUInt32BE(20)).toBe(720);
      if (out) {
        writeFileSync(join(out, `${key}${suffix}.png`), png);
        if (!suffix) writeFileSync(join(out, `${key}-320.png`), coverPng(spec, { title: tt, topic }, 320));
      }
    }
  });

  it('every text colour on the paper reaches 4.5:1 (the topic label is the accent, darkened where needed)', () => {
    for (const [key] of CASES) {
      const t = BUILT_IN_TEMPLATES.find((x) => x.key === key)!;
      const label = readableAccent(PALETTES[t.palette].a);
      expect(contrast(label, '#f7f8fc')).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast('#0f1330', '#f7f8fc')).toBeGreaterThanOrEqual(4.5); // title and DEL name
    expect(readableAccent('#ff9900')).not.toBe('#ff9900'); // AWS orange is too light for small text on paper
  });

  it('the blueprint family stays suggested first; editorial comes next as the alternative', () => {
    const sorted = BUILT_IN_TEMPLATES.map((t, i) => ({ t, sort: t.sort ?? (i + 1) * 10 })).sort((a, b) => a.sort - b.sort);
    for (const slug of ['automation-n8n', BLUEPRINT_TOPICS.aws[0], BLUEPRINT_TOPICS.azure[0], BLUEPRINT_TOPICS.ai[0], BLUEPRINT_TOPICS.vscode[0]]) {
      const keys = sorted.filter(({ t }) => t.topics.includes(slug)).map(({ t }) => t.key);
      expect(keys[0]).toMatch(/^blueprint-/);
      expect(keys[1]).toMatch(/^editorial-/);
    }
  });
});
