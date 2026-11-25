import type { CookieOptions } from 'express';
import { isProd } from '../config/env';

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
});

/** Readable by the web app's JavaScript (double-submit pattern). */
export const csrfCookieOptions = (): CookieOptions => ({
  httpOnly: false,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
});
