import { allLectures, type CourseTree, readinessProblems } from '../instructor/course-tree';

/**
 * "Is this course ready to submit for review?" for AI agents and the super admin (docs/SUPPORT_SESSIONS_AND_AGENTS.md).
 * Pure: facts about videos and files are passed in. Errors block submission; warnings are worth a look.
 * Uses the same rules as the studio's Submit (readinessProblems) plus upload checks.
 */
export interface AssetFact { status: string; error?: string | null; sha256?: string | null; filename?: string | null }
export interface ValidationFacts {
  asset: (id: string) => AssetFact | undefined;
  /** storage keys that exist in storage */
  resourceExists: (storageKey: string) => boolean;
  hasCover: boolean;
}
export interface Finding { code: string; message: string; where?: string }
export interface Validation {
  ready: boolean;
  errors: Finding[];
  warnings: Finding[];
  stats: { sections: number; lectures: number; videoLectures: number; videosReady: number; videosProcessing: number; videosFailed: number; videosMissing: number; resources: number; durationSec: number };
}

export function validateCourse(tree: CourseTree, f: ValidationFacts): Validation {
  const errors: Finding[] = readinessProblems(tree, (id) => f.asset(id)?.status).map((p) => ({ code: `readiness_${p.field}`, message: p.message }));
  const warnings: Finding[] = [];
  const lectures = allLectures(tree);
  const stats = { sections: tree.sections.length, lectures: lectures.length, videoLectures: 0, videosReady: 0, videosProcessing: 0, videosFailed: 0, videosMissing: 0, resources: 0, durationSec: 0 };

  if (!tree.course.title.trim()) errors.push({ code: 'title', message: 'Add a title' });
  if (!tree.course.subtitle.trim()) warnings.push({ code: 'subtitle', message: 'Add a subtitle (shown under the title on the course page)' });
  if (!tree.course.objectives.length) warnings.push({ code: 'objectives', message: 'Add what learners will learn' });
  if (!f.hasCover) warnings.push({ code: 'cover', message: 'Pick a cover template' });

  const assetUse = new Map<string, string[]>();
  const shaUse = new Map<string, string[]>();
  for (const s of tree.sections) {
    if (!s.lectures.length) warnings.push({ code: 'empty_section', message: `Section “${s.title}” has no lessons`, where: s.id });
    const titles = new Set<string>();
    for (const l of s.lectures) {
      const key = l.title.trim().toLowerCase();
      if (titles.has(key)) warnings.push({ code: 'duplicate_title', message: `Two lessons in “${s.title}” are called “${l.title}”`, where: l.id });
      titles.add(key);
      stats.resources += l.resources.length;
      for (const r of l.resources) {
        if (!f.resourceExists(r.storageKey)) errors.push({ code: 'resource_missing', message: `File “${r.title}” on “${l.title}” was not uploaded`, where: l.id });
      }
      if (l.type === 'video') {
        stats.videoLectures++;
        if (!l.videoAssetId) { stats.videosMissing++; continue; }
        const a = f.asset(l.videoAssetId);
        assetUse.set(l.videoAssetId, [...(assetUse.get(l.videoAssetId) ?? []), l.title]);
        if (!a) { stats.videosMissing++; errors.push({ code: 'video_unknown', message: `The video of “${l.title}” doesn’t exist`, where: l.id }); continue; }
        if (a.sha256) shaUse.set(a.sha256, [...new Set([...(shaUse.get(a.sha256) ?? []), l.videoAssetId])]);
        if (a.status === 'ready') { stats.videosReady++; stats.durationSec += l.durationSec || 0; }
        else if (a.status === 'failed') { stats.videosFailed++; errors.push({ code: 'video_failed', message: `The video of “${l.title}” failed to process${a.error ? `: ${a.error}` : ''}. Upload it again.`, where: l.id }); }
        else stats.videosProcessing++;
      }
      if (l.type === 'quiz' && !l.quiz?.length) errors.push({ code: 'quiz_empty', message: `Quiz “${l.title}” has no questions`, where: l.id });
      if (l.type === 'article' && !l.articleMd?.trim()) errors.push({ code: 'article_empty', message: `Article “${l.title}” is empty`, where: l.id });
    }
  }
  for (const [, used] of assetUse) {
    if (used.length > 1) warnings.push({ code: 'duplicate_video', message: `The same video is used by ${used.map((t) => `“${t}”`).join(' and ')}` });
  }
  for (const [, ids] of shaUse) {
    if (ids.length > 1) warnings.push({ code: 'duplicate_upload', message: `${ids.length} lessons have identical video files (same content uploaded twice)` });
  }
  return { ready: errors.length === 0, errors, warnings, stats };
}
