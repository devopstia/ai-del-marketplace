import { agentBearer, minutesLabel, supportBlockReason } from './assist-context';
import { auditData } from '../common/audit.service';
import { partCount, PART_SIZE } from '../agents/agent-uploads.service';

describe('support session restrictions', () => {
  it('blocks account security, money and learner records, reads included where private', () => {
    expect(supportBlockReason('POST', '/api/auth/password')).toMatch(/private/);
    expect(supportBlockReason('GET', '/api/auth/sessions')).toMatch(/private/);
    expect(supportBlockReason('POST', '/api/auth/logout')).not.toBeNull();
    expect(supportBlockReason('PUT', '/api/lectures/abc/progress')).toMatch(/progress/);
    expect(supportBlockReason('POST', '/api/lectures/abc/quiz')).not.toBeNull();
    expect(supportBlockReason('POST', '/api/checkout')).toMatch(/Purchases/);
    expect(supportBlockReason('POST', '/api/cart')).not.toBeNull();
    expect(supportBlockReason('POST', '/api/refund-requests/1/review')).not.toBeNull();
    expect(supportBlockReason('GET', '/api/instructor/stripe/status')).toMatch(/Stripe/);
    expect(supportBlockReason('POST', '/api/instructor/reviews/1/reply')).not.toBeNull();
    expect(supportBlockReason('POST', '/api/admin/people/users/1/status')).toMatch(/yourself/);
    expect(supportBlockReason('POST', '/api/support/tickets')).not.toBeNull();
  });
  it('allows looking around and the instructor studio work', () => {
    expect(supportBlockReason('GET', '/api/auth/me')).toBeNull();
    expect(supportBlockReason('GET', '/api/auth/csrf')).toBeNull();
    expect(supportBlockReason('GET', '/api/me/learning')).toBeNull();
    expect(supportBlockReason('GET', '/api/admin/people/users')).toBeNull();
    expect(supportBlockReason('POST', '/api/instructor/courses')).toBeNull();
    expect(supportBlockReason('PUT', '/api/instructor/courses/1/curriculum')).toBeNull();
    expect(supportBlockReason('POST', '/api/instructor/uploads/video')).toBeNull();
    expect(supportBlockReason('PUT', '/api/instructor/courses/1/cover')).toBeNull();
    expect(supportBlockReason('POST', '/api/lectures/1/playback')).toBeNull();
  });
});

describe('agent bearer', () => {
  const req = (h?: string) => ({ headers: h ? { authorization: h } : {} }) as never;
  it('accepts only well-formed agent tokens', () => {
    expect(agentBearer(req(`Bearer del_agent_${'x'.repeat(40)}`))).toBe(`del_agent_${'x'.repeat(40)}`);
    expect(agentBearer(req('Bearer something-else-entirely-long-enough'))).toBeNull();
    expect(agentBearer(req('Basic abc'))).toBeNull();
    expect(agentBearer(req())).toBeNull();
    expect(agentBearer(req('Bearer del_agent_short'))).toBeNull();
  });
});

describe('audit attribution', () => {
  it('names the real person and whom they acted for, never the user', () => {
    const ctx = { realUserId: 'admin', actingAsId: 'sam', supportSessionId: 'ss1', reason: 'cannot see course' };
    const row = auditData({ actorId: 'sam', action: 'course.created', targetType: 'course', targetId: 'c1' }, ctx);
    expect(row.actorId).toBe('admin');
    expect(row.onBehalfOfId).toBe('sam');
    expect(row.supportSessionId).toBe('ss1');
    expect(row.meta).toMatchObject({ actingAs: 'sam', reason: 'cannot see course' });
    expect(row.status).toBe('ok');
  });
  it('agent actions name the issuing admin, the instructor and the token', () => {
    const row = auditData({ actorId: 'nadia', action: 'course.updated', targetType: 'course' }, { realUserId: 'admin', actingAsId: 'nadia', agentTokenId: 't1' });
    expect(row).toMatchObject({ actorId: 'admin', onBehalfOfId: 'nadia', agentTokenId: 't1', supportSessionId: null });
  });
  it('DEL Studio keeps its old shape; plain requests are untouched', () => {
    expect(auditData({ actorId: 'del', action: 'x', targetType: 'y' }, { realUserId: 'admin', actingAsId: 'del' })).toMatchObject({ actorId: 'admin', onBehalfOfId: null, meta: { actingAs: 'del' } });
    expect(auditData({ actorId: 'u', action: 'x', targetType: 'y', status: 'failed' }, {})).toMatchObject({ actorId: 'u', onBehalfOfId: null, status: 'failed', agentTokenId: null });
  });
  it('explicit attribution wins', () => {
    expect(auditData({ actorId: 'admin', action: 'support.session_started', targetType: 'user', onBehalfOfId: 'sam', supportSessionId: 's9' }, undefined)).toMatchObject({ onBehalfOfId: 'sam', supportSessionId: 's9' });
  });
});

describe('helpers', () => {
  it('labels durations', () => {
    expect(minutesLabel(45 * 60_000)).toBe('45 min');
    expect(minutesLabel(65 * 60_000)).toBe('1 h 05 min');
  });
  it('counts multipart parts', () => {
    expect(partCount(1)).toBe(1);
    expect(partCount(PART_SIZE)).toBe(1);
    expect(partCount(PART_SIZE + 1)).toBe(2);
    expect(partCount(2 * 1024 ** 3)).toBe(32);
  });
});
