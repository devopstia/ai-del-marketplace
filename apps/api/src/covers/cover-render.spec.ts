import { coverPng, coverSvg, fitTitle } from './cover-render';
import { BUILT_IN_TEMPLATES, LAYOUTS, MOTIFS, PALETTES } from './cover-templates';

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
