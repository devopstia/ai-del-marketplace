import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './errors';

const codeFor = (status: number): string =>
  ({
    400: 'bad_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    413: 'payload_too_large',
    429: 'rate_limited',
  })[status] ?? (status >= 500 ? 'internal_error' : 'error');

/** Every error leaves the API as { error: { code, message, details? } }. Internal errors never leak details. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: { code: string; message: string; details?: unknown };

    if (exception instanceof AppError) {
      status = exception.getStatus();
      body = { code: exception.code, message: exception.message, details: exception.details };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      const message =
        typeof r === 'string' ? r : Array.isArray((r as any)?.message) ? (r as any).message.join('; ') : ((r as any)?.message ?? exception.message);
      body = { code: codeFor(status), message: status === 429 ? 'Too many requests, try again later' : String(message) };
    } else if ((exception as any)?.type === 'entity.parse.failed') {
      status = 400;
      body = { code: 'invalid_json', message: 'Request body is not valid JSON' };
    } else if ((exception as any)?.type === 'entity.too.large') {
      status = 413;
      body = { code: 'payload_too_large', message: 'Request body too large' };
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      body = { code: 'internal_error', message: 'Something went wrong' };
    }
    if (body.details === undefined) delete body.details;
    res.status(status).json({ error: body });
  }
}
