import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { ApiError, type DelClient } from './client.js';

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean };
const ok = (data: unknown): Result => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown): Result => ({
  isError: true,
  content: [{ type: 'text', text: e instanceof ApiError ? `${e.code} (${e.status}): ${e.message}${e.details ? `\n${JSON.stringify(e.details, null, 2)}` : ''}` : (e as Error).message }],
});
const run = (fn: () => Promise<unknown>) => fn().then(ok, fail);

const uuid = z.string().uuid();
const level = z.enum(['beginner', 'intermediate', 'advanced']);
const courseFields = {
  title: z.string().min(3).max(120).optional(),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(20000).optional().describe('Markdown'),
  language: z.string().max(10).optional().describe('e.g. en'),
  level: level.optional(),
  objectives: z.array(z.string().min(1).max(200)).max(20).optional().describe('What learners will learn'),
  requirements: z.array(z.string().min(1).max(200)).max(20).optional(),
  priceCents: z.number().int().min(0).optional().describe('USD cents; 0 = free'),
  categoryId: uuid.nullable().optional(),
  taughtBy: z.string().max(80).nullable().optional().describe('DEL courses only: the instructor name shown ("Taught by …")'),
};
const lessonFields = {
  title: z.string().min(1).max(200).optional(),
  type: z.enum(['video', 'article', 'quiz']).optional(),
  isPreview: z.boolean().optional().describe('Free preview lesson'),
  summary: z.string().max(300).optional(),
  articleMd: z.string().max(100000).nullable().optional(),
  videoAssetId: uuid.nullable().optional().describe('assetId from upload_file'),
};

/**
 * The tools an AI agent gets (docs/SUPPORT_SESSIONS_AND_AGENTS.md). They map 1:1 to /api/agent endpoints, so the server
 * enforces ownership, scopes and review rules; nothing here can publish or touch another instructor.
 */
export function registerTools(server: McpServer, del: DelClient) {
  const t = server.registerTool.bind(server);

  t('whoami', { description: 'The instructor this token works for.' }, () => run(() => del.call('GET', '/whoami')));
  t('list_categories', { description: 'Course categories (use the id as categoryId).' }, () => run(() => del.call('GET', '/categories')));
  t('list_courses', { description: 'The instructor’s courses with status.' }, () => run(() => del.call('GET', '/courses')));
  t('get_course', { description: 'One course with its sections, lessons, videos, files and quizzes (the draft being edited).', inputSchema: { courseId: uuid } }, ({ courseId }) => run(() => del.call('GET', `/courses/${courseId}`)));

  t('create_course', { description: 'Create a draft course owned by the instructor.', inputSchema: { ...courseFields, title: z.string().min(3).max(120) } }, (b) => run(() => del.call('POST', '/courses', b)));
  t('update_course', { description: 'Edit course details (published courses: edits go to a draft revision that needs approval).', inputSchema: { courseId: uuid, ...courseFields } }, ({ courseId, ...b }) => run(() => del.call('PATCH', `/courses/${courseId}`, b)));
  t('add_section', { description: 'Add a section at the end of the curriculum.', inputSchema: { courseId: uuid, title: z.string().min(1).max(200) } }, ({ courseId, title }) => run(() => del.call('POST', `/courses/${courseId}/sections`, { title })));
  t('rename_section', { description: 'Rename a section.', inputSchema: { courseId: uuid, sectionId: uuid, title: z.string().min(1).max(200) } }, ({ courseId, sectionId, title }) => run(() => del.call('PATCH', `/courses/${courseId}/sections/${sectionId}`, { title })));
  t('add_lesson', { description: 'Add a lesson to a section. For a video lesson pass the videoAssetId returned by upload_file.', inputSchema: { courseId: uuid, sectionId: uuid, ...lessonFields, title: z.string().min(1).max(200) } }, ({ courseId, sectionId, ...b }) => run(() => del.call('POST', `/courses/${courseId}/sections/${sectionId}/lectures`, b)));
  t('update_lesson', { description: 'Edit a lesson (title, type, preview, summary, article, video).', inputSchema: { courseId: uuid, lessonId: uuid, ...lessonFields } }, ({ courseId, lessonId, ...b }) => run(() => del.call('PATCH', `/courses/${courseId}/lectures/${lessonId}`, b)));
  t('arrange_curriculum', {
    description: 'Reorder sections and lessons in one call: every section with its lesson ids in order (lessons may move between sections).',
    inputSchema: { courseId: uuid, sections: z.array(z.object({ id: uuid, lectureIds: z.array(uuid) })) },
  }, ({ courseId, sections }) => run(() => del.call('PUT', `/courses/${courseId}/curriculum`, { sections })));
  t('set_quiz', {
    description: 'Replace a quiz lesson’s questions (3–5 options each, `correct` is the 0-based index, `why` explains the answer).',
    inputSchema: { courseId: uuid, lessonId: uuid, questions: z.array(z.object({ q: z.string().min(3).max(500), options: z.array(z.string().min(1).max(300)).min(3).max(5), correct: z.number().int().min(0).max(4), why: z.string().min(1).max(1000) })).min(1).max(50) },
  }, ({ courseId, lessonId, questions }) => run(() => del.call('PUT', `/courses/${courseId}/lectures/${lessonId}/quiz`, { questions })));
  t('list_cover_templates', { description: 'The platform’s course cover templates (custom images are not allowed); `suggested` fits the category.', inputSchema: { courseId: uuid } }, ({ courseId }) => run(() => del.call('GET', `/courses/${courseId}/covers`)));
  t('set_cover', { description: 'Pick the course cover template.', inputSchema: { courseId: uuid, templateId: uuid } }, ({ courseId, templateId }) => run(() => del.call('PUT', `/courses/${courseId}/cover`, { templateId })));

  t('list_local_files', { description: 'Files in the folders the instructor shared for this task (name, size, type). Only these can be uploaded.', inputSchema: { dir: z.string().optional() } }, ({ dir }) => run(() => del.listFiles(dir)));
  t('upload_file', {
    description: 'Upload one shared file (video or study material). Resumable, checksummed (an identical file already uploaded is reused), retried. Returns assetId for videos (attach with add_lesson/update_lesson) or storageKey for files (attach with attach_file).',
    inputSchema: { path: z.string(), courseId: uuid.optional() },
  }, ({ path, courseId }) => run(() => del.upload(path, { courseId })));
  t('upload_files', {
    description: 'Upload several shared files one after another; each result or error is reported separately (one failure does not stop the rest).',
    inputSchema: { paths: z.array(z.string()).min(1).max(200), courseId: uuid.optional() },
  }, ({ paths, courseId }) => run(async () => {
    const results: unknown[] = [];
    for (const p of paths) {
      try { results.push({ ok: true, ...(await del.upload(p, { courseId })) }); } catch (e) { results.push({ ok: false, path: p, error: (e as Error).message }); }
    }
    return { uploaded: results.filter((r) => (r as { ok: boolean }).ok).length, failed: results.filter((r) => !(r as { ok: boolean }).ok).length, results };
  }));
  t('attach_file', { description: 'Attach an uploaded file (storageKey from upload_file) to a lesson so learners can download it.', inputSchema: { courseId: uuid, lessonId: uuid, title: z.string().min(1).max(200), storageKey: z.string().min(1).max(400) } }, ({ courseId, lessonId, title, storageKey }) => run(() => del.call('POST', `/courses/${courseId}/lectures/${lessonId}/resources`, { title, storageKey })));
  t('upload_captions', { description: 'Attach captions (SRT or WebVTT from the shared folders) to an uploaded video. Learners see them only when they turn captions on.', inputSchema: { assetId: uuid, path: z.string() } }, ({ assetId, path }) => run(() => del.uploadCaptions(assetId, path)));
  t('video_status', { description: 'Processing status of one uploaded video, or of all the instructor’s videos (uploading | processing | ready | failed).', inputSchema: { assetId: uuid.optional() } }, ({ assetId }) => run(() => del.call('GET', assetId ? `/videos/${assetId}` : '/videos')));

  t('validate_course', { description: 'Is the course complete? Errors block submission (unprocessed or failed videos, missing files, empty quizzes…); warnings flag duplicates and missing details.', inputSchema: { courseId: uuid } }, ({ courseId }) => run(() => del.call('GET', `/courses/${courseId}/validation`)));
  t('preview_course', { description: 'Outline as learners will see it, with each lesson’s video status and files, the validation, and the studio link for a human to review.', inputSchema: { courseId: uuid } }, ({ courseId }) => run(() => del.call('GET', `/courses/${courseId}/preview`)));
  t('submit_for_review', { description: 'Submit a validated course for review. Only a super admin can approve and publish it. Ask the person you work for before calling this.', inputSchema: { courseId: uuid } }, ({ courseId }) => run(() => del.call('POST', `/courses/${courseId}/submit`)));
}
