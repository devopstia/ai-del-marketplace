import { Body, PipeTransform, Query } from '@nestjs/common';
import { z, ZodType } from 'zod';
import { badRequest } from './errors';

/** Field labels for messages ("categoryId" → "Category"). Anything else is humanised from camelCase. */
const LABELS: Record<string, string> = {
  priceCents: 'Price',
  categoryId: 'Category',
  thumbnailKey: 'Thumbnail',
  promoVideoAssetId: 'Promo video',
  videoAssetId: 'Video',
  sectionId: 'Section',
  courseId: 'Course',
  articleMd: 'Article text',
  isPreview: 'Free preview',
  positionSec: 'Position',
  storageKey: 'File',
  sizeBytes: 'File size',
  contentType: 'File type',
  newPassword: 'New password',
  currentPassword: 'Current password',
  commission_bps: 'Commission',
  lineIds: 'Order lines',
  ids: 'Order',
  q: 'Question',
  why: 'Explanation',
};

const humanise = (key: string) => {
  const s = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "priceCents" → "Price"; "questions.2.options" → "Question 3: options". */
export function fieldLabel(path: readonly PropertyKey[]): string {
  const keys = path.filter((p): p is string => typeof p === 'string');
  const key = keys[keys.length - 1];
  if (!key) {
    const nums = path.filter((p): p is number => typeof p === 'number');
    return nums.length ? `Item ${nums[nums.length - 1] + 1}` : 'Value';
  }
  const label = LABELS[key] ?? humanise(key);
  if (path[0] === 'questions' && typeof path[1] === 'number') {
    return path.length === 2 ? `Question ${path[1] + 1}` : `Question ${path[1] + 1}: ${label.toLowerCase()}`;
  }
  if (path[0] === 'questions' && path.length === 1) return 'Questions';
  return label;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One zod issue in plain English, e.g. "Title must be at least 3 characters". */
export function issueMessage(issue: z.core.$ZodIssue): string {
  const label = fieldLabel(issue.path);
  const i = issue as any;
  switch (issue.code) {
    case 'invalid_type':
      if (/received undefined/.test(issue.message)) return `${label} is required`;
      if (i.expected === 'array') return `${label} must be a list`;
      if (i.expected === 'int') return `${label} must be a whole number`;
      return `${label} must be a ${i.expected}`;
    case 'too_small': {
      const min = Number(i.minimum);
      if (i.origin === 'string') return min <= 1 ? `${label} cannot be empty` : `${label} must be at least ${plural(min, 'character')}`;
      if (i.origin === 'array' || i.origin === 'set') return `${label} needs at least ${plural(min, 'item')}`;
      return `${label} must be at least ${min}`;
    }
    case 'too_big': {
      const max = Number(i.maximum);
      if (i.origin === 'string') return `${label} must be at most ${plural(max, 'character')}`;
      if (i.origin === 'array' || i.origin === 'set') return `${label} can have at most ${plural(max, 'item')}`;
      return `${label} must be at most ${max}`;
    }
    case 'invalid_format': {
      const what: Record<string, string> = { email: 'a valid email address', url: 'a valid URL (https://…)', uuid: 'a valid id', regex: 'in the expected format' };
      return `${label} must be ${what[i.format] ?? 'in the expected format'}`;
    }
    case 'invalid_value':
      return `${label} must be one of: ${(i.values as unknown[]).map(String).join(', ')}`;
    case 'unrecognized_keys':
      return `Unknown field${i.keys.length === 1 ? '' : 's'}: ${i.keys.join(', ')}`;
    case 'custom':
      return issue.message && issue.message !== 'Invalid input' ? issue.message : `${label} is not valid`;
    default:
      return `${label} is not valid`;
  }
}

export interface FieldError {
  /** dotted path, e.g. "priceCents" or "questions.0.options" */
  field: string;
  /** same as `field` (kept for older clients) */
  path: string;
  /** plain English, e.g. "Title must be at least 3 characters" */
  message: string;
}

export function zodDetails(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => {
    const field = issue.path.map(String).join('.');
    return { field, path: field, message: issueMessage(issue) };
  });
}

export function validationMessage(details: FieldError[]): string {
  return details.length === 1 ? `${details[0].message}.` : `Please fix ${details.length} fields: ${details.map((d) => d.message).join('; ')}.`;
}

export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      const details = zodDetails(r.error);
      throw badRequest(validationMessage(details), 'validation_failed', details);
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
