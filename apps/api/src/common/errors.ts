import { HttpException, HttpStatus } from '@nestjs/common';

/** Application error with a stable machine-readable code. Rendered as { error: { code, message } }. */
export class AppError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const badRequest = (message: string, code = 'bad_request', details?: unknown) =>
  new AppError(HttpStatus.BAD_REQUEST, code, message, details);
export const unauthorized = (message = 'Sign in required', code = 'unauthorized') =>
  new AppError(HttpStatus.UNAUTHORIZED, code, message);
export const forbidden = (message = 'You do not have access to this resource', code = 'forbidden') =>
  new AppError(HttpStatus.FORBIDDEN, code, message);
export const notFound = (what = 'Resource', code = 'not_found') =>
  new AppError(HttpStatus.NOT_FOUND, code, `${what} not found`);
export const conflict = (message: string, code = 'conflict') => new AppError(HttpStatus.CONFLICT, code, message);
export const unavailable = (message: string, code = 'unavailable') =>
  new AppError(HttpStatus.SERVICE_UNAVAILABLE, code, message);
