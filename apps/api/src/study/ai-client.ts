import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { env } from '../config/env';

/**
 * The one door to Claude for the AI learning features (docs/AI_LEARNING.md). Tests replace it with a fake: the real
 * API is never called from a test. The key comes only from ANTHROPIC_API_KEY and is never logged.
 */
export interface LearningAi {
  complete(params: BetaMessageStreamParams): Promise<BetaMessage>;
}

/** Assistant and study notes exist only with a key (AGENTS rule 4: hidden, not shown as a placeholder). */
export const learningAiEnabled = () => !!env().ANTHROPIC_API_KEY && env().LEARNING_AI_ENABLED;
export const askModel = () => env().LEARNING_AI_ASK_MODEL || env().LEARNING_AI_MODEL;
export const notesModel = () => env().LEARNING_AI_MODEL;

/** Models that take the server-side refusal fallback (Opus 5 / 5.5, Sonnet 5.5, Fable); others run without it. */
export const supportsServerFallback = (model: string) => /^claude-(opus-5|sonnet-5-5|fable-5|mythos-5)/.test(model);

/** Adds the server-side fallback (a declined request is retried on a fallback model inside the same call). */
export function withFallback(params: BetaMessageStreamParams): BetaMessageStreamParams {
  if (!supportsServerFallback(params.model)) return params;
  return { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}

let client: Anthropic | null = null;

/** Streams (long transcripts, no HTTP timeouts) and returns the final message. */
export const anthropicLearningAi: LearningAi = {
  complete(params) {
    client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
    return client.beta.messages.stream(withFallback(params)).finalMessage();
  },
};

export function textOf(m: BetaMessage): string {
  return m.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
}

export function usageOf(m: BetaMessage) {
  return {
    inputTokens: m.usage.input_tokens ?? 0,
    outputTokens: m.usage.output_tokens ?? 0,
    cacheReadTokens: m.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: m.usage.cache_creation_input_tokens ?? 0,
  };
}

/** A short, secret-free reason for logs (never the request body, never the key). */
export function aiErrorReason(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return 'rate limited by the API';
  if (e instanceof Anthropic.AuthenticationError) return 'ANTHROPIC_API_KEY was rejected';
  if (e instanceof Anthropic.APIError) return `API error ${e.status ?? ''}`.trim();
  return (e as Error)?.message?.slice(0, 200) ?? 'unknown error';
}
