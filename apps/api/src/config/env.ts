import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  SESSION_SECRET: z.string().min(16),
  /** Content protection: encrypted HLS for enrolled learners (owner 2026-11-25). "false" falls back to signed MP4 links. */
  PROTECTED_PLAYBACK: z.string().default('true').transform((v) => v !== 'false' && v !== '0'),
  /** HLS segment target length; with copy (no re-encode) a segment is never shorter than the source's keyframe spacing. */
  HLS_SEGMENT_SECONDS: z.coerce.number().int().min(2).max(10).default(4),
  /** Re-encode video to 2-second keyframes while packaging: faster start on slow links, more CPU, small quality cost. */
  HLS_REENCODE: z.string().default('false').transform((v) => v === 'true' || v === '1'),
  WEB_URL: z.string().url().default('http://127.0.0.1:3000'),
  API_URL: z.string().url().default('http://127.0.0.1:4000'),
  S3_ENDPOINT: z.string().url().default('http://127.0.0.1:9000'),
  S3_PUBLIC_ENDPOINT: z.string().url().default('http://127.0.0.1:9000'),
  S3_BUCKET: z.string().default('del-media'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  VIDEO_PROVIDER: z.enum(['local', 'mux']).default('local'),
  MUX_TOKEN_ID: z.string().default(''),
  MUX_TOKEN_SECRET: z.string().default(''),
  MUX_SIGNING_KEY_ID: z.string().default(''),
  MUX_SIGNING_PRIVATE_KEY: z.string().default(''),
  MUX_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  DEV_TEST_PAYMENTS: bool,
  SEED_PASSWORD: z.string().default(''),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parsed, validated environment. Throws on startup if required values are missing. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid environment: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Test hook: forget the cached env so tests can change process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const isProd = () => env().NODE_ENV === 'production';

/** Dev test payments are allowed only when explicitly enabled AND never in production. */
export const devPaymentsEnabled = () => env().DEV_TEST_PAYMENTS && env().NODE_ENV !== 'production';
