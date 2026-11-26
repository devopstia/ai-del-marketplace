import { Controller, createParamDecorator, ExecutionContext, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { Actor, AppRequest } from '../common/auth-context';
import { forbidden } from '../common/errors';
import { ZBody, ZQuery } from '../common/zod';
import { PrismaService } from '../common/prisma.service';
import { CoversService } from '../covers/covers.service';
import { arrangeSchema, createSchema, lectureCreate, lectureUpdate, quizSchema, resourceSchema, titleSchema, updateSchema } from '../instructor/instructor.controller';
import { InstructorService } from '../instructor/instructor.service';
import { MediaService } from '../media/media.service';
import type { AgentScope } from '../assist/assist-context';
import { AgentCoursesService } from './agent-courses.service';
import { AgentUploadsService } from './agent-uploads.service';

/**
 * Agent context with a scope check: only requests authenticated by an agent token (AssistResolver) reach these routes,
 * and only with the scope the route needs. Returns the Actor (= the instructor) for the reused services.
 */
const Agent = createParamDecorator((scope: AgentScope | undefined, ctx: ExecutionContext): Actor & { tokenId: string } => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.agent || !req.user) throw forbidden('This API is for AI agent tokens (Authorization: Bearer del_agent_…).', 'agent_only');
  if (scope && !req.agent.scopes.includes(scope)) throw forbidden(`This agent token does not have the “${scope}” scope.`, 'agent_scope');
  return { user: req.user, ip: req.ip ?? null, tokenId: req.agent.tokenId };
});
type AgentActor = Actor & { tokenId: string };

const uploadSchema = z.object({
  kind: z.enum(['video', 'resource']),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  courseId: z.string().uuid().optional(),
}).strict();
const partsQuery = z.object({ from: z.coerce.number().int().min(1).default(1), count: z.coerce.number().int().min(1).max(100).default(20) });
const coverSchema = z.object({ templateId: z.string().uuid() }).strict();

/**
 * The AI agent API (docs/SUPPORT_SESSIONS_AND_AGENTS.md; the MCP server in tools/mcp-server wraps it). Everything runs
 * as the token's instructor through the same services as the Instructor Studio, so ownership, draft revisions and
 * review rules are identical. Deliberately absent: deleting, publishing, payments, students, other instructors.
 */
@Controller('agent')
export class AgentApiController {
  constructor(
    private readonly instructor: InstructorService,
    private readonly courses: AgentCoursesService,
    private readonly uploads: AgentUploadsService,
    private readonly media: MediaService,
    private readonly covers: CoversService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('whoami')
  whoami(@Agent() a: AgentActor) {
    return this.instructor.profile(a.user.id).then((p) => ({ instructor: { id: a.user.id, name: a.user.name, headline: (p as { headline?: string })?.headline ?? null } })).catch(() => ({ instructor: { id: a.user.id, name: a.user.name } }));
  }

  @Get('categories')
  async categories(@Agent() _a: AgentActor) { return { items: await this.prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }) }; }

  // ---------- courses ----------
  @Get('courses') list(@Agent('courses:read') a: AgentActor) { return this.instructor.listCourses(a.user.id); }
  @Get('courses/:id') detail(@Param('id') id: string, @Agent('courses:read') a: AgentActor) { return this.instructor.courseDetail(a.user.id, id); }
  @Get('courses/:id/validation') validation(@Param('id') id: string, @Agent('courses:read') a: AgentActor) { return this.courses.validation(a.user.id, id); }
  @Get('courses/:id/preview') preview(@Param('id') id: string, @Agent('courses:read') a: AgentActor) { return this.courses.preview(a.user.id, id); }

  @Post('courses') create(@ZBody(createSchema) b: z.infer<typeof createSchema>, @Agent('courses:write') a: AgentActor) { return this.instructor.createCourse(a, b); }
  @Patch('courses/:id') update(@Param('id') id: string, @ZBody(updateSchema) b: z.infer<typeof updateSchema>, @Agent('courses:write') a: AgentActor) { return this.instructor.updateCourse(a, id, b); }
  @Post('courses/:id/sections') addSection(@Param('id') id: string, @ZBody(titleSchema) b: z.infer<typeof titleSchema>, @Agent('courses:write') a: AgentActor) { return this.instructor.addSection(a, id, b.title); }
  @Patch('courses/:id/sections/:sid') renameSection(@Param('id') id: string, @Param('sid') sid: string, @ZBody(titleSchema) b: z.infer<typeof titleSchema>, @Agent('courses:write') a: AgentActor) { return this.instructor.updateSection(a, id, sid, b.title); }
  @Post('courses/:id/sections/:sid/lectures') addLecture(@Param('id') id: string, @Param('sid') sid: string, @ZBody(lectureCreate) b: z.infer<typeof lectureCreate>, @Agent('courses:write') a: AgentActor) { return this.instructor.addLecture(a, id, sid, b); }
  @Patch('courses/:id/lectures/:lid') updateLecture(@Param('id') id: string, @Param('lid') lid: string, @ZBody(lectureUpdate) b: z.infer<typeof lectureUpdate>, @Agent('courses:write') a: AgentActor) { return this.instructor.updateLecture(a, id, lid, b); }
  @Put('courses/:id/curriculum') arrange(@Param('id') id: string, @ZBody(arrangeSchema) b: z.infer<typeof arrangeSchema>, @Agent('courses:write') a: AgentActor) { return this.instructor.arrange(a, id, b.sections); }
  @Put('courses/:id/lectures/:lid/quiz') quiz(@Param('id') id: string, @Param('lid') lid: string, @ZBody(quizSchema) b: z.infer<typeof quizSchema>, @Agent('courses:write') a: AgentActor) { return this.instructor.setQuiz(a, id, lid, b.questions); }

  @Get('courses/:id/covers') coverPicker(@Param('id') id: string, @Agent('courses:read') a: AgentActor) { return this.covers.pickerFor(a.user.id, id); }
  @Put('courses/:id/cover') setCover(@Param('id') id: string, @ZBody(coverSchema) b: z.infer<typeof coverSchema>, @Agent('courses:write') a: AgentActor) { return this.covers.setTemplate(a, id, b.templateId); }

  /** Attach an uploaded file (storageKey from a completed upload) to a lesson. */
  @Post('courses/:id/lectures/:lid/resources') addResource(@Param('id') id: string, @Param('lid') lid: string, @ZBody(resourceSchema) b: z.infer<typeof resourceSchema>, @Agent('uploads') a: AgentActor) { return this.instructor.addResource(a, id, lid, b); }

  @HttpCode(200) @Post('courses/:id/submit') submit(@Param('id') id: string, @Agent('submit') a: AgentActor) { return this.courses.submit(a, id); }

  // ---------- videos and uploads ----------
  @Get('videos') async videos(@Agent('courses:read') a: AgentActor) { return { items: await this.media.listAssets(a.user.id) }; }
  @Get('videos/:assetId') video(@Param('assetId') id: string, @Agent('courses:read') a: AgentActor) { return this.media.getAsset(a.user.id, id); }

  @Post('uploads') startUpload(@ZBody(uploadSchema) b: z.infer<typeof uploadSchema>, @Agent('uploads') a: AgentActor) { return this.uploads.create(a, b, a.tokenId); }
  @Get('uploads/:id/parts') parts(@Param('id') id: string, @ZQuery(partsQuery) q: z.infer<typeof partsQuery>, @Agent('uploads') a: AgentActor) { return this.uploads.parts(a.user.id, id, q.from, q.count); }
  @HttpCode(200) @Post('uploads/:id/complete') complete(@Param('id') id: string, @Agent('uploads') a: AgentActor) { return this.uploads.complete(a, id); }
  @HttpCode(200) @Post('uploads/:id/abort') abort(@Param('id') id: string, @Agent('uploads') a: AgentActor) { return this.uploads.abort(a, id); }
}
