// Reads a receipt photo with Claude and suggests a bucket for each line item.
// The app shows the suggestions, the user confirms, and the app saves the split
// (using splitByReceipt so tax/discounts are spread and totals match the bank charge).
import Anthropic from '@anthropic-ai/sdk';
import { admin, handle, HttpError, json, requireMember } from '../_shared/supabase.ts';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['merchant', 'date', 'total', 'items'],
  properties: {
    merchant: { type: 'string' },
    date: { type: ['string', 'null'], description: 'Purchase date as YYYY-MM-DD, or null if not visible' },
    total: { type: 'number', description: 'Grand total paid, in dollars' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'amount', 'bucket'],
        properties: {
          description: { type: 'string', description: 'Readable item name, expanding receipt abbreviations' },
          amount: { type: 'number', description: 'Line price in dollars after any item-level discount; negative for coupons' },
          bucket: { type: 'string', description: 'One of the provided bucket ids' },
        },
      },
    },
  },
} as const;

type Scan = { merchant: string; date: string | null; total: number; items: { description: string; amount: number; bucket: string }[] };

Deno.serve(handle(async (req) => {
  const { householdId, imageBase64, mediaType = 'image/jpeg', transactionId } = await req.json();
  await requireMember(req, householdId);
  if (!imageBase64) throw new HttpError(400, 'imageBase64 is required');

  const [{ data: buckets }, { data: rules }] = await Promise.all([
    admin.from('buckets').select('id, name').eq('household_id', householdId).eq('archived', false),
    admin.from('merchant_rules').select('match, bucket_id').eq('household_id', householdId),
  ]);
  const bucketList = (buckets ?? []).map((b) => `- ${b.id}: ${b.name}`).join('\n');

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system:
      'You read store receipts for a family budgeting app. Extract every purchased line item with its price, ' +
      'skipping subtotal, tax, payment and change lines. Assign each item to the best-fitting budget bucket id ' +
      'from the list given. Food and household consumables go to groceries-type buckets; toys and kids items to ' +
      'kids-type buckets; and so on.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: `Budget buckets:\n${bucketList}\n\nExtract the receipt.` },
      ],
    }],
  });

  if (response.stop_reason === 'refusal') throw new HttpError(422, 'Could not read this receipt');
  const text = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
  if (!text) throw new HttpError(422, 'Could not read this receipt');
  const scan = JSON.parse(text.text) as Scan;

  const valid = new Set((buckets ?? []).map((b) => b.id));
  const fallbackBucket = (buckets ?? []).find((b) => /else|other/i.test(b.name))?.id ?? null;
  const toCents = (d: number) => Math.round(d * 100);

  const { data: receipt, error } = await admin.from('receipts').insert({
    household_id: householdId, transaction_id: transactionId ?? null,
    merchant: scan.merchant, total: toCents(scan.total), purchased_on: scan.date,
  }).select('id').single();
  if (error) throw error;

  const lines = scan.items.map((i) => ({
    receipt_id: receipt.id, household_id: householdId, description: i.description, amount: toCents(i.amount),
    suggested_bucket_id: valid.has(i.bucket) ? i.bucket : fallbackBucket,
  }));
  await admin.from('receipt_lines').insert(lines);

  return json({ receiptId: receipt.id, merchant: scan.merchant, date: scan.date, total: toCents(scan.total), lines, merchantRules: rules ?? [] });
}));
