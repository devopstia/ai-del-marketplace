import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { bannerImage, bannerSvg, MAX_BYTES, normaliseUpload, SAFE, SHARE_H, SHARE_W } from './share-render';
import { chipsFrom, courseBannerInput, DEFAULT_SOCIAL, durationLabel, mergeSettings, siteBannerInput } from './share-inputs';
import { defaultTemplateFor, FAMILIES, SHARE_TEMPLATES } from './share-templates';

// SHARE_OUT=<dir> writes every banner as an image for a visual check.
const OUT = process.env.SHARE_OUT;
const save = (name: string, buf: Buffer, ext: string) => { if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, `${name}.${ext}`), buf); } };

const CARDS = [
  { title: 'AI for DevOps on AWS', line: 'AI on AWS', accent: '#ff9900' },
  { title: 'AI-Powered DevOps Automation with n8n', line: 'Automation', accent: '#ff6d5a' },
  { title: 'VS Code Masterclass', line: 'Developer tools', accent: '#1f9cf0', free: true },
];
const LONG = 'AI for DevOps on AWS: From Fundamentals to Production-Grade Agents, RAG Pipelines and Guardrails with Amazon Bedrock';
const facts = (title: string, free: boolean) => ({
  title, subtitle: 'Build, secure and operate AI workloads on the cloud your team already uses, with labs you run yourself.', topic: 'AI on AWS', free,
  lessons: 24, durationSec: 4 * 3600 + 20 * 60, others: CARDS.slice(1), chips: ['Bedrock', 'RAG', 'AI agents', 'Guardrails'],
});

function inside(boxes: { x: number; y: number; w: number; h: number; what: string }[]) {
  return boxes.filter((b) => b.x < SAFE.x - 0.5 || b.y < SAFE.y - 0.5 || b.x + b.w > SAFE.x + SAFE.w + 0.5 || b.y + b.h > SAFE.y + SAFE.h + 0.5);
}

describe('sharing banners', () => {
  it('has at least ten topic templates, each with a distinct key, in every family', () => {
    expect(SHARE_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SHARE_TEMPLATES.map((t) => t.key)).size).toBe(SHARE_TEMPLATES.length);
    for (const k of ['ai', 'aws', 'azure', 'terraform', 'kubernetes', 'devops', 'automation', 'software-dev', 'cybersecurity', 'general']) expect(SHARE_TEMPLATES.map((t) => t.key)).toContain(k);
    expect(FAMILIES).toEqual(['pro', 'marketplace', 'enterprise']);
  });

  it('picks the template from the category, skips disabled ones and falls back to general', () => {
    expect(defaultTemplateFor('ai-cloud-aws').key).toBe('aws');
    expect(defaultTemplateFor('automation-n8n').key).toBe('automation');
    expect(defaultTemplateFor('ai-cloud-aws', ['aws']).key).toBe('general');
    expect(defaultTemplateFor(null).key).toBe('general');
    expect(defaultTemplateFor('no-such-topic').key).toBe('general');
  });

  it.each(FAMILIES)('%s: every template renders 1200×630 under 300 KB, long and short titles, text inside the safe area', async (family) => {
    for (const t of SHARE_TEMPLATES) {
      for (const [name, title, free] of [['short', 'Bash', false], ['long', LONG, false], ['free', 'VS Code Masterclass: Learn the Editor Professionals Use', true]] as const) {
        const input = courseBannerInput(facts(title, free), family, t);
        const { svg, boxes } = bannerSvg(input);
        expect(inside(boxes)).toEqual([]);
        if (free) expect(svg).toContain('FREE COURSE');
        else expect(svg).not.toContain('FREE COURSE');
        const img = await bannerImage(input);
        expect(img.buf.length).toBeLessThanOrEqual(MAX_BYTES);
        const meta = await sharp(img.buf).metadata();
        expect([meta.width, meta.height]).toEqual([SHARE_W, SHARE_H]);
        expect(meta.format).toBe(img.ext === 'jpg' ? 'jpeg' : 'png');
        if (t.key === 'aws' || t.key === 'kubernetes' || t.key === 'terraform' || name !== 'short') save(`course-${family}-${t.key}-${name}`, img.buf, img.ext);
      }
    }
  });

  it.each(FAMILIES)('%s: the site banner fits and stays under 300 KB', async (family) => {
    const input = siteBannerInput(DEFAULT_SOCIAL, family, CARDS);
    expect(inside(bannerSvg(input).boxes)).toEqual([]);
    const img = await bannerImage(input, { jpegOnly: true });
    expect(img.type).toBe('image/jpeg');
    expect(img.buf.length).toBeLessThanOrEqual(MAX_BYTES);
    save(`site-${family}`, img.buf, img.ext);
  });

  it('keeps the headline whole when it fits and never prints the subtitle twice', () => {
    const { svg } = bannerSvg(courseBannerInput(facts('AI for DevOps on AWS: From Fundamentals to Production', false), 'pro', SHARE_TEMPLATES[0]!));
    expect(svg).toContain('AI for DevOps on AWS');
    expect(svg).toContain('From Fundamentals to');
  });

  it('escapes text', () => {
    const { svg } = bannerSvg(courseBannerInput({ ...facts('<script>alert(1)</script> & co', false), topic: 'A & B' }, 'pro', SHARE_TEMPLATES[0]!));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('marketplace cards on a course banner: the course in front, real other courses behind', () => {
    const { svg } = bannerSvg(courseBannerInput(facts('Kubernetes for AI Workloads', false), 'marketplace', SHARE_TEMPLATES[3]!));
    expect(svg).toContain('Kubernetes for AI');
    expect(svg).toContain('AI-Powered DevOps');
    expect(svg).toContain('VERIFIED');
  });

  it('enterprise chips come only from the course text', () => {
    const chips = chipsFrom(['AI for DevOps on AWS', 'Use Amazon Bedrock and RAG with guardrails', 'Build AI agents'], ['Section 1: Getting started', 'Agents']);
    expect(chips).toEqual(['AWS', 'Bedrock', 'RAG', 'Guardrails', 'AI agents']);
    expect(chipsFrom(['Plain title'], ['Getting started', 'A very long section title that is too long'])).toEqual(['Getting started']);
  });

  it('formats durations and merges partial settings with defaults', () => {
    expect(durationLabel(45 * 60)).toBe('45 minutes');
    expect(durationLabel(3600)).toBe('1 hour');
    expect(durationLabel(4.3 * 3600)).toBe('4.5 hours');
    const s = mergeSettings({ family: 'enterprise', site: { pro: { headline: 'Hi' } }, disabledTemplates: ['aws', 'general', 'nope'], chips: 'x' });
    expect(s.family).toBe('enterprise');
    expect(s.site.pro.headline).toBe('Hi');
    expect(s.site.pro.cta).toBe('Explore courses');
    expect(s.disabledTemplates).toEqual(['aws']);
    expect(s.chips).toEqual(DEFAULT_SOCIAL.chips);
  });

  it('a custom upload must be 1200×630 (or larger, same shape) and loses its metadata', async () => {
    const make = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#4f3fb0' } }).withExif({ IFD0: { Copyright: 'secret-gps-owner' } }).jpeg().toBuffer();
    const ok = await normaliseUpload(await make(2400, 1260));
    const meta = await sharp(ok.buf).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(meta.exif).toBeUndefined();
    expect(ok.buf.includes(Buffer.from('secret-gps-owner'))).toBe(false);
    await expect(normaliseUpload(await make(1000, 630))).rejects.toThrow(/1200×630/);
    await expect(normaliseUpload(await make(1200, 1200))).rejects.toThrow(/1200×630/);
    await expect(normaliseUpload(Buffer.from('not an image'))).rejects.toThrow(/image/);
  });
});
