import jsQR from 'jsqr';
import { PAGE, type CertificateData, type Paper, formatLength, renderCertificatePdf, renderCertificatePng, renderCertificateSvg, shortUrl } from './certificate-render';

const base: CertificateData = {
  code: 'DEL-7KQ2M9XP4T', name: 'Amara Okafor', course: 'AI-Powered DevOps Automation with n8n',
  issuedAt: new Date('2026-11-27T10:00:00Z'), durationSec: 13956, url: 'https://ai-devopseasylearning.com/certificates/DEL-7KQ2M9XP4T',
};
const long: CertificateData = {
  ...base, code: 'DEL-W3HNQ8ZL2R', name: 'Maximiliana Alexandra Fitzgerald-Okonkwo',
  course: 'AI for DevOps: from the vocabulary of AI to agents in production on AWS, Azure and Kubernetes clusters',
  url: 'https://ai-devopseasylearning.com/certificates/DEL-W3HNQ8ZL2R',
};
const short: CertificateData = { ...base, name: 'Li Wei', course: 'Bash', durationSec: 0 };

describe('certificate renderer (Academic)', () => {
  const papers: Paper[] = ['letter', 'a4'];

  it.each(papers.flatMap((p) => [[p, base], [p, long], [p, short]] as [Paper, CertificateData][]))('%s: every element stays inside the frame', (paper, d) => {
    const r = renderCertificateSvg(d, paper);
    const { w, h } = PAGE[paper];
    expect(r.page).toEqual({ w, h });
    const frame = { x0: 42, x1: w - 42, y0: 42, y1: h - 42 };
    for (const b of r.boxes) {
      expect([b.what, b.x0 >= frame.x0, b.x1 <= frame.x1, b.y0 >= frame.y0, b.y1 <= frame.y1]).toEqual([b.what, true, true, true, true]);
    }
    // The main block never collides with the footer.
    const lowestMain = Math.max(...r.boxes.filter((b) => ['title', 'pre', 'name', 'stmt', 'course', 'meta'].includes(b.what)).map((b) => b.y1));
    const footerTop = Math.min(...r.boxes.filter((b) => ['seal', 'qr', 'sig-lead', 'ver-label'].includes(b.what)).map((b) => b.y0));
    expect(lowestMain).toBeLessThan(footerTop);
  });

  it('draws the name and title as paths (no font needed to view it) and never a handwritten signature', () => {
    const { svg } = renderCertificateSvg(base);
    expect(svg).not.toMatch(/<text/);
    expect(svg).toContain('aria-label="Certificate of Completion: Amara Okafor');
    const long2 = renderCertificateSvg(long);
    expect(long2.boxes.filter((b) => b.what === 'name').length).toBeLessThanOrEqual(2);
    expect(long2.boxes.filter((b) => b.what === 'course').length).toBe(2);
  });

  it('renders a 300 dpi PNG whose QR code opens the verification page', () => {
    const { svg } = renderCertificateSvg(base);
    const { width, height, pixels } = renderCertificatePng(svg, 'letter');
    expect([width, height]).toEqual([3300, 2550]);
    const found = jsQR(new Uint8ClampedArray(pixels), width, height);
    expect(found?.data).toBe(base.url);
  });

  it('A4 is 3508 px wide at 300 dpi', () => {
    const { width, height } = renderCertificatePng(renderCertificateSvg(base, 'a4').svg, 'a4');
    expect(width).toBe(3508);
    expect(Math.abs(height - 2480)).toBeLessThanOrEqual(2);
  });

  it('writes a one-page PDF of the exact paper size', () => {
    const pdf = renderCertificatePdf(renderCertificateSvg(base).svg, 'letter').toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain('/MediaBox [0 0 792 612]');
    const a4 = renderCertificatePdf(renderCertificateSvg(base, 'a4').svg, 'a4').toString('latin1');
    expect(a4).toContain('/MediaBox [0 0 841.89 595.28]');
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('marks a revoked certificate', () => {
    expect(renderCertificateSvg({ ...base, revoked: true }).svg.length).toBeGreaterThan(renderCertificateSvg(base).svg.length);
  });

  it('formats length and the printed link', () => {
    expect(formatLength(13956)).toBe('3 h 53 min');
    expect(formatLength(3600)).toBe('1 h');
    expect(formatLength(1500)).toBe('25 min');
    expect(shortUrl(base.url)).toBe('ai-devopseasylearning.com/certificates');
  });
});
