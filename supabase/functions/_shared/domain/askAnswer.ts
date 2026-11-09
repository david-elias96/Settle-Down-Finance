/**
 * Ask answers come back structured so the app can show them as a card instead of a
 * block of text: one headline sentence, a short list of rows, and at most one tip.
 */
export type AnswerTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface AnswerRow {
  /** Bucket, store or item name, e.g. "Groceries". */
  label: string;
  /** The key figure, e.g. "$569 of $700" or "Save $150". */
  value: string;
  /** Optional short line under the label (under ~60 characters). */
  detail?: string | null;
  tone?: AnswerTone;
  /** Bucket name when the row is about a bucket, so tapping opens it. */
  bucket?: string | null;
}

export interface AskAnswer {
  /** The answer in one plain sentence. */
  headline: string;
  /** Optional label above the rows, e.g. "Biggest opportunities". */
  rowsTitle?: string | null;
  rows: AnswerRow[];
  /** One practical next step, if useful. */
  tip?: string | null;
}

/** JSON schema the backend asks Claude to answer in. */
export const ASK_ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'rowsTitle', 'rows', 'tip'],
  properties: {
    headline: { type: 'string', description: 'The direct answer in one short sentence (max ~20 words).' },
    rowsTitle: { type: ['string', 'null'], description: 'Short label above the rows, e.g. "Biggest opportunities", or null.' },
    rows: {
      type: 'array',
      description: 'Up to 5 rows supporting the answer, most important first. Empty if not needed.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value', 'detail', 'tone', 'bucket'],
        properties: {
          label: { type: 'string', description: 'Bucket, store or item name, 1-3 words.' },
          value: { type: 'string', description: 'The key figure, e.g. "$569 of $700", "Save $150", "$22.99/mo".' },
          detail: { type: ['string', 'null'], description: 'One short line of context, under 60 characters, or null.' },
          tone: { type: 'string', enum: ['good', 'warn', 'bad', 'neutral'], description: 'good = on track, warn = at risk, bad = over, neutral = info.' },
          bucket: { type: ['string', 'null'], description: 'Exact bucket name if the row is about a bucket, else null.' },
        },
      },
    },
    tip: { type: ['string', 'null'], description: 'One practical next step in one sentence, or null.' },
  },
} as const;

/** Plain-text version, used for conversation history and accessibility. */
export function answerToText(a: AskAnswer): string {
  return [a.headline, ...(a.rowsTitle ? [a.rowsTitle] : []),
    ...a.rows.map((r) => `- ${r.label}: ${r.value}${r.detail ? ` (${r.detail})` : ''}`),
    ...(a.tip ? [`Tip: ${a.tip}`] : [])].join('\n');
}
