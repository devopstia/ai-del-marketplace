"use client";
// Typed browser client for the DEL API. Session lives in an httpOnly cookie set by the API;
// mutations carry X-CSRF-Token (double submit: header must equal the `csrf` cookie).
import { API_URL } from "./config";
import { qs } from "./qs";
export { qs };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let csrfToken: string | null = null;
export function setCsrf(token: string | null | undefined) {
  if (token) csrfToken = token;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[-.]/g, "\\$&") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function ensureCsrf(): Promise<string | null> {
  const fromCookie = readCookie("csrf");
  if (fromCookie) return fromCookie;
  if (csrfToken) return csrfToken;
  try {
    const r = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
    if (r.ok) {
      const j = (await r.json()) as { csrf?: string; csrfToken?: string };
      csrfToken = j.csrf ?? j.csrfToken ?? null;
    }
  } catch {
    /* offline: the mutation will report the error */
  }
  return csrfToken;
}

type Query = Record<string, string | number | boolean | undefined | null>;
export interface ReqOpts {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: ReqOpts = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  const form = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !form) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const t = await ensureCsrf();
    if (t) headers["X-CSRF-Token"] = t;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs(opts.query)}`, {
      method,
      headers,
      credentials: "include",
      body: form ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string | string[] }; message?: string | string[] }) ?? {};
    const raw = e.error?.message ?? e.message ?? res.statusText;
    const msg = Array.isArray(raw) ? raw.join(". ") : String(raw || "Request failed");
    throw new ApiError(res.status, e.error?.code ?? String(res.status), msg);
  }
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** PUT a file straight to a presigned upload URL, reporting progress (0..1). */
export function uploadFile(url: string, file: File, onProgress: (p: number) => void, method: "PUT" | "POST" = "PUT", headers: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (!headers["Content-Type"] && file.type) xhr.setRequestHeader("Content-Type", file.type);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(ev.loaded / ev.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed: the storage server did not accept the file."));
    xhr.send(file);
  });
}
