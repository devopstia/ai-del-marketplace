import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles } from '../common/auth-context';
import { priceCentsSchema } from '../common/pricing';
import { ZBody, ZQuery } from '../common/zod';
import { InsightsService } from './insights.service';
import { InstructorService } from './instructor.service';

const baseProfile = z.object({
  headline: z.string().trim().min(3).max(120),
  bio: z.string().trim().min(20).max(5000),
  website: z.string().url().max(300).nullable().optional(),
});
/** Instructor application: what DEL needs to decide (owner 2026-11-25). */
const applySchema = baseProfile.extend({
  expertise: z.array(z.string().trim().min(2).max(60)).min(1).max(12),
  experience: z.string().trim().min(20).max(3000),
  plannedCourses: z.string().trim().min(10).max(3000),
  extraInfo: z.string().trim().max(3000).optional(),
}).strict();
const profileSchema = baseProfile.partial();
const str = (max: number) => z.string().trim().max(max);
const courseFields = z.object({
  title: str(120).min(3),
  subtitle: str(200),
  description: str(20000),
  language: str(10),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  objectives: z.array(str(200).min(1)).max(20),
  requirements: z.array(str(200).min(1)).max(20),
  priceCents: priceCentsSchema,
  categoryId: z.string().uuid().nullable(),
  thumbnailKey: z.string().max(300).nullable(),
  promoVideoAssetId: z.string().uuid().nullable(),
});
const createSchema = courseFields.partial().extend({ title: str(120).min(3) });
const updateSchema = courseFields.partial();
const titleSchema = z.object({ title: str(200).min(1) });
const idsSchema = z.object({ ids: z.array(z.string().uuid()).max(500) });
const arrangeSchema = z.object({ sections: z.array(z.object({ id: z.string().uuid(), lectureIds: z.array(z.string().uuid()).max(1000) })).max(200) });
const packageSchema = z.object({ title: z.string().trim().min(1).max(200), storageKey: z.string().max(400) });
const lectureFields = z.object({
  title: str(200).min(1),
  type: z.enum(['video', 'article', 'quiz']),
  isPreview: z.boolean(),
  articleMd: z.string().max(100000).nullable(),
  summary: str(300),
  videoAssetId: z.string().uuid().nullable(),
  sectionId: z.string().uuid(),
});
const lectureCreate = lectureFields.omit({ sectionId: true }).partial().extend({ title: str(200).min(1) });
const lectureUpdate = lectureFields.partial();
const quizSchema = z.object({
  questions: z
    .array(z.object({ q: str(500).min(3), options: z.array(str(300).min(1)).min(3).max(5), correct: z.number().int().min(0).max(4), why: str(1000).min(1) }))
    .min(1)
    .max(50),
});
const resourceSchema = z.object({ title: str(200).min(1), storageKey: z.string().min(1).max(400) });
const salesQuery = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });
const studentsQuery = z.object({ courseId: z.string().uuid().optional() });
const replySchema = z.object({ reply: str(4000) });
const versionQuery = z.object({ version: z.enum(['live', 'draft']).optional() });

@Controller('instructor')
export class InstructorController {
  constructor(private readonly svc: InstructorService, private readonly insights: InsightsService) {}

  /** Insights for one course: retention per lesson, hardest quiz questions, AI questions (own course; super admin any). */
  @Roles('instructor', 'admin') @Get('courses/:id/insights')
  courseInsights(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.insights.course(a, id);
  }

  /** Any signed-in user can apply. */
  @Post('apply')
  apply(@ZBody(applySchema) body: z.infer<typeof applySchema>, @ActorCtx() a: Actor) {
    return this.svc.apply(a, body);
  }

  /** Any signed-in user: returns their application/profile (404 if none). */
  @Get('profile')
  profile(@ActorCtx() a: Actor) {
    return this.svc.profile(a.user.id);
  }

  @Put('profile')
  updateProfile(@ZBody(profileSchema) body: z.infer<typeof profileSchema>, @ActorCtx() a: Actor) {
    return this.svc.updateProfile(a.user.id, body);
  }

  @Roles('instructor') @Get('courses')
  courses(@ActorCtx() a: Actor) {
    return this.svc.listCourses(a.user.id);
  }

  @Roles('instructor') @Post('courses')
  create(@ZBody(createSchema) body: z.infer<typeof createSchema>, @ActorCtx() a: Actor) {
    return this.svc.createCourse(a, body);
  }

  /** `?version=live` shows the live course even when draft changes exist (default: what the studio edits). */
  @Roles('instructor') @Get('courses/:id')
  course(@Param('id') id: string, @ZQuery(versionQuery) q: z.infer<typeof versionQuery>, @ActorCtx() a: Actor) {
    return this.svc.courseDetail(a.user.id, id, q.version);
  }

  /** Preview a lesson of the version the studio edits (draft revision included): course owner or course-reviewing admin. */
  @Roles('instructor', 'admin') @Get('courses/:id/lectures/:lectureId/preview')
  previewLecture(@Param('id') id: string, @Param('lectureId') lectureId: string, @ActorCtx() a: Actor) {
    return this.svc.previewLecture(a, id, lectureId);
  }

  /** Discard the draft changes of a published course (live course untouched). */
  @Roles('instructor') @Delete('courses/:id/revision')
  discardRevision(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.svc.discardRevision(a, id);
  }

  @Roles('instructor') @Patch('courses/:id')
  update(@Param('id') id: string, @ZBody(updateSchema) body: z.infer<typeof updateSchema>, @ActorCtx() a: Actor) {
    return this.svc.updateCourse(a, id, body);
  }

  @Roles('instructor') @Delete('courses/:id')
  remove(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.svc.deleteCourse(a, id);
  }

  @Roles('instructor') @HttpCode(200) @Post('courses/:id/submit')
  submit(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.svc.submit(a, id);
  }

  @Roles('instructor') @Post('courses/:id/sections')
  addSection(@Param('id') id: string, @ZBody(titleSchema) body: z.infer<typeof titleSchema>, @ActorCtx() a: Actor) {
    return this.svc.addSection(a, id, body.title);
  }

  @Roles('instructor') @Put('courses/:id/curriculum')
  arrange(@Param('id') id: string, @ZBody(arrangeSchema) body: z.infer<typeof arrangeSchema>, @ActorCtx() a: Actor) {
    return this.svc.arrange(a, id, body.sections);
  }

  @Roles('instructor') @Get('courses/:id/package')
  packageFiles(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.packageFiles(a.user.id, id); }

  @Roles('instructor') @Post('courses/:id/package')
  addPackageFile(@Param('id') id: string, @ZBody(packageSchema) body: z.infer<typeof packageSchema>, @ActorCtx() a: Actor) { return this.svc.addPackageFile(a, id, body); }

  @Roles('instructor') @Delete('courses/:id/package/:fileId')
  deletePackageFile(@Param('id') id: string, @Param('fileId') fid: string, @ActorCtx() a: Actor) { return this.svc.deletePackageFile(a, id, fid); }

  @Roles('instructor') @Put('courses/:id/sections/order')
  reorderSections(@Param('id') id: string, @ZBody(idsSchema) body: z.infer<typeof idsSchema>, @ActorCtx() a: Actor) {
    return this.svc.reorderSections(a, id, body.ids);
  }

  @Roles('instructor') @Patch('courses/:id/sections/:sectionId')
  updateSection(@Param('id') id: string, @Param('sectionId') sid: string, @ZBody(titleSchema) body: z.infer<typeof titleSchema>, @ActorCtx() a: Actor) {
    return this.svc.updateSection(a, id, sid, body.title);
  }

  @Roles('instructor') @Delete('courses/:id/sections/:sectionId')
  deleteSection(@Param('id') id: string, @Param('sectionId') sid: string, @ActorCtx() a: Actor) {
    return this.svc.deleteSection(a, id, sid);
  }

  @Roles('instructor') @Post('courses/:id/sections/:sectionId/lectures')
  addLecture(@Param('id') id: string, @Param('sectionId') sid: string, @ZBody(lectureCreate) body: z.infer<typeof lectureCreate>, @ActorCtx() a: Actor) {
    return this.svc.addLecture(a, id, sid, body);
  }

  @Roles('instructor') @Put('courses/:id/sections/:sectionId/lectures/order')
  reorderLectures(@Param('id') id: string, @Param('sectionId') sid: string, @ZBody(idsSchema) body: z.infer<typeof idsSchema>, @ActorCtx() a: Actor) {
    return this.svc.reorderLectures(a, id, sid, body.ids);
  }

  @Roles('instructor') @Patch('courses/:id/lectures/:lectureId')
  updateLecture(@Param('id') id: string, @Param('lectureId') lid: string, @ZBody(lectureUpdate) body: z.infer<typeof lectureUpdate>, @ActorCtx() a: Actor) {
    return this.svc.updateLecture(a, id, lid, body);
  }

  @Roles('instructor') @Delete('courses/:id/lectures/:lectureId')
  deleteLecture(@Param('id') id: string, @Param('lectureId') lid: string, @ActorCtx() a: Actor) {
    return this.svc.deleteLecture(a, id, lid);
  }

  @Roles('instructor') @Put('courses/:id/lectures/:lectureId/quiz')
  setQuiz(@Param('id') id: string, @Param('lectureId') lid: string, @ZBody(quizSchema) body: z.infer<typeof quizSchema>, @ActorCtx() a: Actor) {
    return this.svc.setQuiz(a, id, lid, body.questions);
  }

  @Roles('instructor') @Delete('courses/:id/lectures/:lectureId/quiz')
  deleteQuiz(@Param('id') id: string, @Param('lectureId') lid: string, @ActorCtx() a: Actor) {
    return this.svc.deleteQuiz(a, id, lid);
  }

  @Roles('instructor') @Post('courses/:id/lectures/:lectureId/resources')
  addResource(@Param('id') id: string, @Param('lectureId') lid: string, @ZBody(resourceSchema) body: z.infer<typeof resourceSchema>, @ActorCtx() a: Actor) {
    return this.svc.addResource(a, id, lid, body);
  }

  @Roles('instructor') @Delete('courses/:id/resources/:resourceId')
  deleteResource(@Param('id') id: string, @Param('resourceId') rid: string, @ActorCtx() a: Actor) {
    return this.svc.deleteResource(a, id, rid);
  }

  @Roles('instructor') @Get('sales')
  sales(@ZQuery(salesQuery) q: z.infer<typeof salesQuery>, @ActorCtx() a: Actor) {
    return this.svc.sales(a.user.id, q.from, q.to);
  }

  @Roles('instructor') @Get('students')
  students(@ZQuery(studentsQuery) q: z.infer<typeof studentsQuery>, @ActorCtx() a: Actor) {
    return this.svc.students(a.user.id, q.courseId);
  }

  @Roles('instructor') @Get('reviews')
  reviews(@ActorCtx() a: Actor) {
    return this.svc.reviews(a.user.id);
  }

  @Roles('instructor') @HttpCode(200) @Post('reviews/:id/reply')
  reply(@Param('id') id: string, @ZBody(replySchema) body: z.infer<typeof replySchema>, @ActorCtx() a: Actor) {
    return this.svc.reply(a, id, body.reply);
  }
}
