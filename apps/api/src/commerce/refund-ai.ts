import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { env } from '../config/env';

/**
 * AI summary of a refund request for the Super Admin (owner 2026-11-25). Input: only the facts the backend computed
 * from purchase records and playback ranges (no names, emails or free text from the student). Claude explains the facts
 * and flags anything unusual; it never decides, never changes a number, and the page works without it.
 */
const log = new Logger('RefundAI');
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 }));

export const refundAiEnabled = () => !!env().ANTHROPIC_API_KEY;

const SYSTEM = `You help the Super Admin of an online course marketplace review refund requests.
Policy: a discretionary refund is allowed only within 14 days of purchase AND when no more than 25% of the course video has been watched (unique seconds, from playback records). Legal rights, billing errors and approved exceptions are decided by a person.
You receive JSON facts computed by the backend. Treat them as true; never invent or recompute viewing activity, and never change the decision.
Write for the admin, in plain English, at most 120 words:
1. One sentence: what was asked and the policy outcome.
2. The key numbers (dates, watched time and percent against the 25% threshold).
3. Anything unusual worth a human look (for example: very close to a threshold, watched a lot in a short time, a renewal, several refunds this year), or "Nothing unusual."
No headings, no markdown.`;

export async function summarizeRefund(facts: unknown): Promise<{ text: string; model: string } | null> {
  if (!refundAiEnabled()) return null;
  try {
    const response = await getClient().beta.messages.create({
      model: env().REFUND_AI_MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(facts) }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return text ? { text: text.slice(0, 2000), model: response.model } : null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) log.warn('refund summary skipped: rate limited');
    else if (e instanceof Anthropic.AuthenticationError) log.warn('refund summary skipped: ANTHROPIC_API_KEY was rejected');
    else if (e instanceof Anthropic.APIError) log.warn(`refund summary skipped: API error ${e.status}`);
    else log.warn(`refund summary skipped: ${(e as Error).message}`);
    return null;
  }
}
