import { resetEnvCache } from '../config/env';
import { TEMPLATES, render } from './templates';

const sample = {
  name: 'Ama Mensah', link: 'https://example.test/x?token=abc', code: '482913', provider: 'Google', added: ['instructor'], removed: [],
  orderId: '9f1c0a7e-0000-4000-8000-000000000000', total: 7900, lines: [{ title: 'AI for DevOps', priceCents: 7900, accessUntil: '2027-11-25T00:00:00Z', renewal: false }],
  course: 'AI for DevOps', slug: 'ai-for-devops', expiresAt: '2027-11-25T00:00:00Z', daysLeft: 7, courses: [{ title: 'AI for DevOps', expiresAt: '2027-11-25T00:00:00Z' }],
  amountCents: 7900, watchedPercent: 31, thresholdPercent: 25, windowDays: 14, note: 'Please add the payment reference.', ref: 'ME-1001', student: 'Ama Mensah',
  instructor: 'Nadia', method: 'google', headline: 'SRE', ticket: 'S-1001', subject: 'Card declined', email: 'ama@example.test', topic: 'payment', body: 'Hello', signedIn: true, expiresInDays: 7,
};

describe('email templates', () => {
  beforeAll(() => { process.env.WEB_URL = 'https://learn.example.test'; resetEnvCache(); });

  it.each(Object.keys(TEMPLATES))('%s renders a complete HTML and text email in DEL branding', (name) => {
    const r = render(name, sample)!;
    expect(r.subject.length).toBeGreaterThan(5);
    for (const part of [r.subject, r.html, r.text]) {
      expect(part).not.toMatch(/undefined|NaN|\[object Object\]|Invalid Date/);
      expect(part).not.toMatch(/Insurance|Life &amp; Health/);
    }
    expect(r.html).toContain('DevOps Easy Learning');
    // one dark design in every client (owner, 2026-11-25): declared dark, colours inline and as bgcolor for Outlook
    expect(r.html).toContain('<meta name="color-scheme" content="dark">');
    expect(r.html).toContain('bgcolor="#0C0F22"');
    expect(r.html).toContain('bgcolor="#141834"');
    expect(r.html).not.toMatch(/#FFFFFF|#F3F2FA|#FAFAFE/i);
    expect(r.html).toContain('https://learn.example.test/icons/icon-192.png');
    expect(r.text).toContain('DevOps Easy Learning');
  });

  it('escapes user text (no HTML injection from names, subjects or messages)', () => {
    const r = render('contact-message', { ...sample, name: '<img src=x onerror=alert(1)>', body: '<script>x</script>' })!;
    expect(r.html).not.toContain('<script>x');
    expect(r.html).not.toContain('<img src=x');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('unknown templates are not sent', () => expect(render('nope', {})).toBeNull());
});
