// Asks Claude to place purchases the plain rules couldn't, one call per batch of stores.
import Anthropic from '@anthropic-ai/sdk';
import { acceptAiChoices, AI_SORT_SCHEMA, AI_SORT_SYSTEM, aiSortInput, type Bucket, type PastChoice, type Transaction } from './domain/index.ts';

const client = new Anthropic();
const BATCH = 25;

type Purchase = Pick<Transaction, 'id' | 'merchant' | 'amount' | 'plaidCategory' | 'plaidDetailedCategory'>;

/** Returns purchase id → chosen bucket and reason. Anything Claude can't place is left out. */
export async function aiSort(purchases: Purchase[], buckets: Bucket[], examples: PastChoice[]) {
  const out = new Map<string, { bucketId: string; reason: string }>();
  for (let i = 0; i < purchases.length; i += BATCH) {
    const batch = purchases.slice(i, i + BATCH);
    try {
      const response = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 4000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SORT_SCHEMA } },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: AI_SORT_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(aiSortInput(batch, buckets, examples)) }],
      });
      const text = response.content.find((b) => b.type === 'text') as { text: string } | undefined;
      if (response.stop_reason === 'refusal' || !text) continue;
      const { choices } = JSON.parse(text.text);
      for (const [id, c] of acceptAiChoices(choices, batch.map((p) => p.id), buckets)) out.set(id, c);
    } catch (e) {
      // Sorting is a nicety: on failure the plain category stays and the push still goes out.
      console.error('aiSort failed', e);
    }
  }
  return out;
}
