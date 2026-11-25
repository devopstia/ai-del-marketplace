/**
 * Object storage layout (owner 2026-11-25; docs/STORAGE.md). Every instructor's files live under their stable id, and
 * course files under the course id, so nothing is shared by accident and a course's files are easy to find:
 *
 *   instructors/<instructorId>/courses/<courseId>/videos/<assetId>/source.mp4 (+ captions.vtt)
 *   instructors/<instructorId>/courses/<courseId>/resources/<uuid>/<file>     lesson files and the course package
 *   instructors/<instructorId>/videos/<assetId>/…                            a video uploaded before it has a course
 *   instructors/<instructorId>/resources/<uuid>/<file>
 *   images/<ownerId>/…  images/covers/…  hls/<random>/…  support/…  contact/…   (unchanged)
 *
 * Older keys (videos/<assetId>/…, resources/<ownerId>/…) stay valid; nothing is moved.
 */
export const instructorPrefix = (ownerId: string) => `instructors/${ownerId}/`;
const base = (ownerId: string, courseId?: string | null) => `${instructorPrefix(ownerId)}${courseId ? `courses/${courseId}/` : ''}`;
export const videoKey = (ownerId: string, assetId: string, ext: string, courseId?: string | null) => `${base(ownerId, courseId)}videos/${assetId}/source.${ext}`;
export const resourceKey = (ownerId: string, id: string, file: string, courseId?: string | null) => `${base(ownerId, courseId)}resources/${id}/${file}`;
/** Captions sit next to the video's source file. */
export const captionsKeyFor = (sourceKey: string | null, assetId: string) => (sourceKey && /\/source\.\w+$/.test(sourceKey) ? sourceKey.replace(/source\.\w+$/, 'captions.vtt') : `videos/${assetId}/captions.vtt`);
/** A file key the owner may attach: their own prefix (new layout or the older resources/<owner>/ one), no "..". */
export const ownsResourceKey = (ownerId: string, key: string) => !key.includes('..') && (key.startsWith(`resources/${ownerId}/`) || key.startsWith(instructorPrefix(ownerId)));
