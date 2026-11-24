import { AppError } from '../common/errors';
import { InstructorService } from './instructor.service';

const actor = (id: string) => ({ user: { id, email: `${id}@x`, name: id, roles: ['instructor' as const] }, ip: null });

describe('InstructorService ownership (service layer)', () => {
  const course = { id: 'c1', instructorId: 'owner', status: 'draft', title: 'Mine', description: '', categoryId: null };

  function build() {
    const prisma: any = {
      course: {
        // Emulates Postgres: only matches when BOTH id and instructorId match.
        findFirst: jest.fn(async ({ where }: any) => (where.id === course.id && where.instructorId === course.instructorId ? course : null)),
        update: jest.fn(),
        delete: jest.fn(),
        findUniqueOrThrow: jest.fn(async () => ({ ...course, sections: [], category: null, thumbnailKey: null })),
      },
      section: { aggregate: jest.fn(async () => ({ _max: { position: null } })), create: jest.fn(async ({ data }: any) => data) },
      orderLine: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
      enrollment: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
      review: { findFirst: jest.fn(async () => null), update: jest.fn() },
      $transaction: jest.fn(),
      cartItem: { deleteMany: jest.fn() },
    };
    const svc = new InstructorService(prisma, { log: jest.fn() } as any, { imageUrl: () => null, ownedAsset: jest.fn() } as any, {} as any);
    return { svc, prisma };
  }

  it.each([
    ['read', (s: InstructorService) => s.courseDetail('intruder', 'c1')],
    ['update', (s: InstructorService) => s.updateCourse(actor('intruder'), 'c1', { title: 'Hijacked' })],
    ['delete', (s: InstructorService) => s.deleteCourse(actor('intruder'), 'c1')],
    ['submit', (s: InstructorService) => s.submit(actor('intruder'), 'c1')],
    ['add section', (s: InstructorService) => s.addSection(actor('intruder'), 'c1', 'x')],
    ['list students of', (s: InstructorService) => s.students('intruder', 'c1')],
  ])("another instructor cannot %s someone else's course (404)", async (_label, call) => {
    const { svc, prisma } = build();
    const err = await call(svc).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.getStatus()).toBe(404);
    expect(prisma.course.update).not.toHaveBeenCalled();
    expect(prisma.course.delete).not.toHaveBeenCalled();
    expect(prisma.section.create).not.toHaveBeenCalled();
  });

  it('every course lookup is scoped by instructorId', async () => {
    const { svc, prisma } = build();
    await svc.courseDetail('owner', 'c1');
    expect(prisma.course.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', instructorId: 'owner' } });
  });

  it('the owner can add a section', async () => {
    const { svc, prisma } = build();
    await svc.addSection(actor('owner'), 'c1', 'Intro');
    expect(prisma.section.create).toHaveBeenCalledWith({ data: { courseId: 'c1', title: 'Intro', position: 0 } });
  });

  it('sales and reviews queries only ever ask for the caller’s data', async () => {
    const { svc, prisma } = build();
    await svc.sales('owner');
    expect(prisma.orderLine.findMany.mock.calls[0][0].where.instructorId).toBe('owner');
    await expect(svc.reply(actor('intruder'), 'r1', 'hi')).rejects.toBeInstanceOf(AppError);
    expect(prisma.review.findFirst).toHaveBeenCalledWith({ where: { id: 'r1', course: { instructorId: 'intruder' } } });
    expect(prisma.review.update).not.toHaveBeenCalled();
  });
});
