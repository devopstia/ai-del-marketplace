import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Which deployment this is: production, staging (cloud test copy) or local. Only staging may use simulated payments in a production build. */
  DEPLOY_ENV: z.enum(['local', 'staging', 'production']).default('local'),
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
  /** A MinIO/S3-compatible URL, or "aws" for Amazon S3 with the instance role (production). */
  S3_ENDPOINT: z.string().url().or(z.literal('aws')).default('http://127.0.0.1:9000'),
  S3_PUBLIC_ENDPOINT: z.string().url().or(z.literal('aws')).default('http://127.0.0.1:9000'),
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
  STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  DEV_TEST_PAYMENTS: bool,
  SEED_PASSWORD: z.string().default(''),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  /** Sign in with Google, GitHub, Facebook, LinkedIn (docs/AUTH.md). A provider's button appears only when both values are set. */
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  FACEBOOK_CLIENT_ID: z.string().default(''),
  FACEBOOK_CLIENT_SECRET: z.string().default(''),
  LINKEDIN_CLIENT_ID: z.string().default(''),
  LINKEDIN_CLIENT_SECRET: z.string().default(''),
  /** Development only: a built-in "Test provider" to exercise social sign-in end to end without real keys. Refused in production. */
  OAUTH_TEST_PROVIDER: bool,
  /** Compromised-password check against Have I Been Pwned (k-anonymity: only 5 hex characters of a SHA-1 hash leave the server). */
  /** Optional: AI summaries of refund requests for admins (Claude). Without a key the summary is simply not shown. */
  ANTHROPIC_API_KEY: z.string().default(''),
  REFUND_AI_MODEL: z.string().default('claude-opus-5-5'),
  PASSWORD_BREACH_CHECK: z.string().default('true').transform((v) => v !== 'false' && v !== '0'),
  /**
   * Local development only: `false` skips the Google Authenticator step so the owner can sign in quickly while testing.
   * Ignored in production (the code is always required there). docs/AUTH.md.
   */
  /** console (log only) | smtp (local Mailpit or any SMTP server) | resend (production, HTTPS API). */
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  SMTP_URL: z.string().default(''),
  EMAIL_FROM: z.string().default('DevOps Easy Learning <no-reply@devopseasylearning.com>'),
  EMAIL_REPLY_TO: z.string().default('support@devopseasylearning.com'),
  RESEND_API_KEY: z.string().default(''),
  /** Where Contact page messages go (DEL support inbox). */
  CONTACT_EMAIL: z.string().email().default('support@devopseasylearning.com'),
  MFA_REQUIRED: z.string().default('true').transform((v) => v !== 'false' && v !== '0'),
  /** The name shown in Google Authenticator. */
  MFA_ISSUER: z.string().default('DevOps Easy Learning'),
  /** Local demo accounts only: the authenticator seed the seed script gives them (base32), so tests and demos can sign in. */
  SEED_MFA_SECRET: z.string().default(''),
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
export const devPaymentsEnabled = () => env().DEV_TEST_PAYMENTS && (env().NODE_ENV !== 'production' || env().DEPLOY_ENV === 'staging');
