import { Body, PipeTransform, Query } from '@nestjs/common';
import { z, ZodType } from 'zod';
import { badRequest } from './errors';

export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw badRequest(details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join('; '), 'validation_failed', details);
    }
    return r.data;
  }
}

/** Validated body: `@ZBody(schema) body: z.infer<typeof schema>` */
export const ZBody = (schema: ZodType) => Body(new ZodPipe(schema));
/** Validated query string. */
export const ZQuery = (schema: ZodType) => Query(new ZodPipe(schema));

export const uuid = z.string().uuid();
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
