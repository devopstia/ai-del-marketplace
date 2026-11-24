import { LearningService } from './learning.service';

describe('LearningService access to paid content', () => {
  const lecture = {
    id: 'l1',
    isPreview: false,
    durationSec: 30,
    videoAsset: { id: 'a1', status: 'ready' },
    section: { courseId: 'c1', course: { id: 'c1', instructorId: 'teacher', slug: 'c' } },
  };
  function build(enrollment: unknown) {
    const prisma: any = {
      lecture: { findUnique: jest.fn(async () => lecture) },
      enrollment: { findUnique: jest.fn(async () => enrollment) },
    };
    const media = { playback: jest.fn(async () => ({ url: 'signed', expiresAt: 'x', format: 'mp4' })) };
    return { svc: new LearningService(prisma, media as any, {} as any, {} as any), media };
  }
  const user = (id: string, roles: any[] = ['student']) => ({ id, email: '', name: '', roles });

  it('refuses playback without an enrolment', async () => {
    const { svc, media } = build(null);
    await expect(svc.playback(user('s1'), 'l1')).rejects.toMatchObject({ code: 'not_enrolled' });
    expect(media.playback).not.toHaveBeenCalled();
  });

  it('refuses playback after a refund (revoked enrolment)', async () => {
    const { svc } = build({ revokedAt: new Date() });
    await expect(svc.playback(user('s1'), 'l1')).rejects.toMatchObject({ code: 'not_enrolled' });
  });

  it.each([
    ['an enrolled student', user('s1'), { revokedAt: null }],
    ['the course owner', user('teacher', ['student', 'instructor']), null],
    ['an admin', user('boss', ['student', 'admin']), null],
  ])('issues a signed URL to %s', async (_l, u, enr) => {
    const { svc, media } = build(enr);
    await expect(svc.playback(u, 'l1')).resolves.toMatchObject({ url: 'signed' });
    expect(media.playback).toHaveBeenCalled();
  });
});
