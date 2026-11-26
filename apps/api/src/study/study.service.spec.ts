import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { resetEnvCache } from '../config/env';
import { NOT_COVERED_ANSWER } from './prompts';
import { StudyService } from './study.service';

const fakeMessage = (text: string, extra: Partial<BetaMessage> = {}) =>
  ({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-test', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 2000, output_tokens: 250, cache_read_input_tokens: 0, cache_creation_input_tokens: 900 }, ...extra }) as unknown as BetaMessage;

const course = {
  id: 'c1', title: 'Helm basics', instructorId: 'teacher',
  sections: [{ title: 'Helm', lectures: [
    { id: 'lec-1', title: 'Install Helm', summary: 'brew and apt', durationSec: 200, videoAssetId: 'v1', videoAsset: { captionsKey: 'k1' } },
    { id: 'lec-2', title: 'Roll back a release', summary: '', durationSec: 300, videoAssetId: 'v2', videoAsset: { captionsKey: 'k2' } },
  ] }],
};
const segs = [
  { videoAssetId: 'v2', seq: 3, startSec: 45, endSec: 60, text: 'Use helm history to list revisions.' },
  { videoAssetId: 'v2', seq: 4, startSec: 60, endSec: 75, text: 'Then helm rollback my-app 2 returns to revision two.' },
  { videoAssetId: 'v2', seq: 5, startSec: 75, endSec: 90, text: 'Check the pods afterwards.' },
];

function build(opts: { access?: string | null; hits?: { videoAssetId: string; seq: number; rank: number }[]; counts?: [number, number, number]; reply?: BetaMessage | Error } = {}) {
  const usage: any[] = [];
  const counts = opts.counts ?? [1, 1, 1];
  let countCall = 0;
  const prisma: any = {
    course: { findUnique: jest.fn(async () => course) },
    $queryRaw: jest.fn(async () => opts.hits ?? []),
    captionSegment: { findMany: jest.fn(async ({ where }: any) => segs.filter((s) => where.OR.some((o: any) => o.videoAssetId === s.videoAssetId && o.seq === s.seq))) },
    aiUsage: {
      create: jest.fn(async ({ data }: any) => { const row = { id: `u${usage.length}`, ...data }; usage.push(row); return row; }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(usage.find((u) => u.id === where.id), data)),
      count: jest.fn(async () => counts[countCall++ % 3]),
    },
  };
  const learning: any = { access: jest.fn(async () => (opts.access === undefined ? 'enrolled' : opts.access)) };
  const index: any = { ensureIndexed: jest.fn(async () => 0) };
  const ai = { complete: jest.fn(async () => { if (opts.reply instanceof Error) throw opts.reply; return opts.reply ?? fakeMessage(JSON.stringify({ covered: true, answer: 'Run `helm rollback my-app 2` [S1].' })); }) };
  const svc = new StudyService(prisma, learning, index, {} as any, { log: jest.fn() } as any, ai);
  return { svc, ai, usage, prisma, index };
}
const student = { id: 's1', email: 's@x', name: 'S', roles: ['student'] as any };

describe('course assistant (fake Anthropic client, never the real API)', () => {
  const saved = { ...process.env };
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key-not-real'; process.env.LEARNING_AI_MODEL = 'claude-opus-5-5'; delete process.env.LEARNING_AI_ASK_MODEL; resetEnvCache(); });
  afterAll(() => { process.env = saved; resetEnvCache(); });

  it('does not exist without an API key (404, nothing recorded)', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    resetEnvCache();
    const { svc, ai, usage } = build();
    await expect(svc.ask(student, 'helm', { question: 'How do I roll back?' })).rejects.toMatchObject({ status: 404 });
    await expect(svc.lessonNotes(student, 'lec-1')).rejects.toMatchObject({ status: 404 });
    expect(ai.complete).not.toHaveBeenCalled();
    expect(usage).toHaveLength(0);
  });

  it('refuses learners without access before anything else', async () => {
    const { svc, ai } = build({ access: null });
    await expect(svc.ask(student, 'helm', { question: 'How do I roll back?' })).rejects.toMatchObject({ code: 'not_enrolled' });
    await expect(svc.search(student, 'helm', 'rollback')).rejects.toMatchObject({ code: 'not_enrolled' });
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('answers from the retrieved passages with clickable timestamp citations and logs usage without the text', async () => {
    const { svc, ai, usage } = build({ hits: [{ videoAssetId: 'v2', seq: 4, rank: 0.8 }] });
    const r = await svc.ask(student, 'helm', { question: 'How do I roll back a release?', lectureId: 'lec-2' });
    expect(r).toMatchObject({ covered: true, answer: 'Run `helm rollback my-app 2` [S1].', citations: [{ ref: 'S1', lectureId: 'lec-2', lectureTitle: 'Roll back a release', startSec: 45 }] });
    const params = (ai.complete.mock.calls[0] as any[])[0];
    expect(params.model).toBe('claude-opus-5-5');
    const prompt = String(params.messages.at(-1).content);
    expect(prompt).toContain('Use helm history to list revisions. Then helm rollback my-app 2 returns to revision two. Check the pods afterwards.');
    expect(usage[0]).toMatchObject({ userId: 's1', kind: 'ask', courseId: 'c1', status: 'ok', inputTokens: 2000, outputTokens: 250, cacheWriteTokens: 900, passages: 1, model: 'claude-test' });
    expect(JSON.stringify(usage)).not.toContain('roll back');
  });

  it('says "not covered" without calling the model when nothing in the course matches', async () => {
    const { svc, ai, usage } = build({ hits: [] });
    const r = await svc.ask(student, 'helm', { question: 'What is the refund policy?' });
    expect(r).toMatchObject({ covered: false, answer: NOT_COVERED_ANSWER, citations: [] });
    expect(ai.complete).not.toHaveBeenCalled();
    expect(usage[0].status).toBe('not_covered');
  });

  it('can still point to a lesson by its title when no transcript passage matched', async () => {
    const { svc, ai } = build({ hits: [], reply: fakeMessage(JSON.stringify({ covered: true, answer: 'See [L1].' })) });
    const r = await svc.ask(student, 'helm', { question: 'Where do we install Helm?' });
    expect(ai.complete).toHaveBeenCalled();
    expect(r.citations).toEqual([{ ref: 'L1', lectureId: 'lec-1', lectureTitle: 'Install Helm', startSec: 0 }]);
  });

  it('rate limits per learner per minute and per day (429), recording the refusal only', async () => {
    const minute = build({ counts: [6, 6, 6] });
    await expect(minute.svc.ask(student, 'helm', { question: 'How do I roll back?' })).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
    expect(minute.ai.complete).not.toHaveBeenCalled();
    expect(minute.usage[0].status).toBe('limited');
    const day = build({ counts: [1, 41, 41] });
    await expect(day.svc.ask(student, 'helm', { question: 'How do I roll back?' })).rejects.toMatchObject({ status: 429 });
  });

  it('a model refusal or an API failure gives a polite answer / 503, never a made-up one', async () => {
    const refused = build({ hits: [{ videoAssetId: 'v2', seq: 4, rank: 0.8 }], reply: fakeMessage('', { stop_reason: 'refusal' } as any) });
    await expect(refused.svc.ask(student, 'helm', { question: 'How do I roll back?' })).resolves.toMatchObject({ covered: false, citations: [] });
    expect(refused.usage[0].status).toBe('refused');
    const down = build({ hits: [{ videoAssetId: 'v2', seq: 4, rank: 0.8 }], reply: new Error('socket hang up') });
    await expect(down.svc.ask(student, 'helm', { question: 'How do I roll back?' })).rejects.toMatchObject({ status: 503, code: 'assistant_unavailable' });
    expect(down.usage[0].status).toBe('error');
  });

  it('uses LEARNING_AI_ASK_MODEL for questions when set', async () => {
    process.env.LEARNING_AI_ASK_MODEL = 'claude-haiku-5-5';
    resetEnvCache();
    const { svc, ai } = build({ hits: [{ videoAssetId: 'v2', seq: 4, rank: 0.8 }] });
    await svc.ask(student, 'helm', { question: 'How do I roll back?' });
    expect((ai.complete.mock.calls[0] as any[])[0].model).toBe('claude-haiku-5-5');
  });
});

describe('search inside videos (no AI key needed)', () => {
  it('returns moments with highlighted words, mapped to the lesson that plays the video', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    resetEnvCache();
    const { svc, index, prisma } = build();
    prisma.$queryRaw.mockResolvedValueOnce([{ ...segs[1] }]);
    const r = await svc.search(student, 'helm', 'rollback');
    expect(index.ensureIndexed).toHaveBeenCalledWith(['v1', 'v2']);
    expect(r.items).toEqual([{ lectureId: 'lec-2', lectureTitle: 'Roll back a release', sectionTitle: 'Helm', startSec: 60, endSec: 75, parts: [{ text: 'Then helm ', match: false }, { text: 'rollback', match: true }, { text: ' my-app 2 returns to revision two.', match: false }] }]);
    await expect(svc.search(student, 'helm', 'x')).resolves.toEqual({ query: 'x', items: [] });
  });
});
