"use client";
import { api, uploadFile } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { E } from "@/lib/studio-endpoints";

type Target = { url: string; method: "PUT" | "POST"; headers: Record<string, string> };
function target(r: Record<string, unknown>): Target {
  const u = obj(r.upload);
  return {
    url: String(r.uploadUrl ?? r.url ?? u.url ?? ""),
    method: (String(r.method ?? u.method ?? "PUT").toUpperCase() === "POST" ? "POST" : "PUT"),
    headers: (obj(r.headers ?? u.headers) as Record<string, string>) ?? {},
  };
}

/** Video: ask the API for an upload target, PUT the file straight to storage, then mark it complete. */
export async function uploadVideo(file: File, onProgress: (p: number) => void, extra: Record<string, unknown> = {}): Promise<string> {
  const r = obj(await api(E.uploadVideo, { method: "POST", body: { filename: file.name, contentType: file.type || "video/mp4", ...extra } }));
  const assetId = String(r.assetId ?? r.id ?? obj(r.asset).id);
  const t = target(r);
  if (!t.url) throw new Error("The server didn’t return an upload address.");
  await uploadFile(t.url, file, onProgress, t.method, t.headers);
  await api(E.completeVideo(assetId), { method: "POST" });
  return assetId;
}

/** Resource: presigned PUT to storage, then attach the stored file to the lecture. */
export async function uploadResource(file: File, courseId: string, lectureId: string, title: string, onProgress: (p: number) => void) {
  const r = obj(await api(E.uploadResource, { method: "POST", body: { filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size } }));
  const t = target(r);
  if (!t.url) throw new Error("The server didn’t return an upload address.");
  await uploadFile(t.url, file, onProgress, t.method, t.headers);
  await api(E.lectureResources(courseId, lectureId), { method: "POST", body: { title, storageKey: String(r.storageKey ?? r.key) } });
}

export async function uploadImage(file: File, onProgress: (p: number) => void): Promise<{ key: string; url?: string }> {
  const r = obj(await api(E.uploadImage, { method: "POST", body: { contentType: file.type || "image/jpeg" } }));
  const t = target(r);
  await uploadFile(t.url, file, onProgress, t.method, t.headers);
  return { key: String(r.key ?? r.storageKey ?? ""), url: (r.publicUrl ?? r.thumbnailUrl) as string | undefined };
}
