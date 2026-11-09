// Receives Plaid webhooks. On SYNC_UPDATES_AVAILABLE it pulls new transactions, files each
// into a bucket, and pushes "$84.12 at Kroger → Groceries: $512 of $700 (73%)" to the family.
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import { admin, handle, json } from '../_shared/supabase.ts';
import { plaid, toCents } from '../_shared/plaid.ts';
import { pushToHousehold } from '../_shared/push.ts';
import { aiSort } from '../_shared/aiSort.ts';
import {
  billsByBucket, bucketStatuses, findBills, isBudgetSpending, sortTransaction, withBills, transactionNotification, vendorKey,
  type Allocation, type Bucket, type MerchantRule, type PastChoice, type Transaction,
} from '../_shared/domain/index.ts';

Deno.serve(handle(async (req) => {
  const raw = await req.text();
  await verifyPlaidWebhook(req.headers.get('Plaid-Verification'), raw);
  const event = JSON.parse(raw);

  if (event.webhook_type === 'TRANSACTIONS' && event.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    await syncItem(event.item_id);
  } else if (event.webhook_type === 'ITEM' && ['ERROR', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT'].includes(event.webhook_code)) {
    // The bank login needs attention (e.g. password changed). The app shows a "Reconnect" prompt.
    await admin.from('plaid_items').update({ status: 'needs_reconnect' }).eq('plaid_item_id', event.item_id);
  }
  return json({ ok: true });
}));

/** Verifies the Plaid-Verification JWT and that it signs this exact body. */
async function verifyPlaidWebhook(token: string | null, body: string) {
  if (!token) throw new Error('Missing Plaid-Verification header');
  const { kid, alg } = decodeProtectedHeader(token);
  if (alg !== 'ES256' || !kid) throw new Error('Unexpected webhook signature');
  const { key } = await plaid('/webhook_verification_key/get', { key_id: kid });
  const { payload } = await jwtVerify(token, await importJWK(key, 'ES256'), { maxTokenAge: '5 min' });
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  if (payload.request_body_sha256 !== digest) throw new Error('Webhook body hash mismatch');
}

async function syncItem(plaidItemId: string) {
  const { data: item } = await admin.from('plaid_items').select('*').eq('plaid_item_id', plaidItemId).single();
  if (!item) return;
  const householdId: string = item.household_id;
  const { data: accessToken } = await admin.rpc('read_plaid_token', { secret_id: item.access_token_secret_id });

  const [{ data: bucketRows }, { data: ruleRows }, { data: accountRows }, { data: pastRows }, { data: hh }] = await Promise.all([
    admin.from('buckets').select('*').eq('household_id', householdId),
    admin.from('merchant_rules').select('*').eq('household_id', householdId),
    admin.from('accounts').select('id, plaid_account_id').eq('household_id', householdId),
    // Where the family (or the AI) put stores before, so each store is only worked out once.
    admin.from('allocations').select('bucket_id, source, transactions!inner(merchant, date)').eq('household_id', householdId)
      .in('source', ['user', 'ai']).order('date', { referencedTable: 'transactions', ascending: false }).limit(1000),
    admin.from('households').select('ai_sorting').eq('id', householdId).single(),
  ]);
  const buckets: Bucket[] = (bucketRows ?? []).map((b) => ({
    id: b.id, name: b.name, icon: b.icon, monthlyLimit: b.monthly_limit, isCustom: b.is_custom, archived: b.archived,
  }));
  // Default-bucket logic works on slugs ('groceries'); map them to this household's bucket ids.
  const slugToId = new Map((bucketRows ?? []).filter((b) => b.slug).map((b) => [b.slug, b.id]));
  const idToSlug = new Map([...slugToId].map(([s, id]) => [id, s]));
  const slugBuckets = buckets.map((b) => ({ ...b, id: idToSlug.get(b.id) ?? b.id }));
  const rules: MerchantRule[] = (ruleRows ?? []).map((r) => ({ match: r.match, bucketId: idToSlug.get(r.bucket_id) ?? r.bucket_id }));
  const accountId = new Map((accountRows ?? []).map((a) => [a.plaid_account_id, a.id]));
  const history: PastChoice[] = (pastRows ?? []).map((a: any) => ({
    merchant: a.transactions.merchant, date: a.transactions.date, source: a.source, bucketId: idToSlug.get(a.bucket_id) ?? a.bucket_id,
  }));
  // Purchases to ask Claude about after the sync, keyed by store so each store is asked once.
  const vague = new Map<string, { id: string; merchant: string; amount: number; plaidCategory?: string; plaidDetailedCategory?: string; txIds: string[] }>();

  let cursor: string | undefined = item.sync_cursor ?? undefined;
  const fresh: string[] = [];
  for (;;) {
    const page = await plaid('/transactions/sync', { access_token: accessToken, cursor, count: 250 });

    for (const t of [...page.added, ...page.modified]) {
      const row = {
        household_id: householdId,
        account_id: accountId.get(t.account_id),
        plaid_transaction_id: t.transaction_id,
        pending_transaction_id: t.pending_transaction_id,
        merchant: t.merchant_name ?? t.name,
        amount: toCents(t.amount),
        date: t.date,
        pending: t.pending,
        plaid_category: t.personal_finance_category?.primary,
        plaid_detailed_category: t.personal_finance_category?.detailed,
      };
      if (!row.account_id) continue;
      const { data: saved } = await admin.from('transactions')
        .upsert(row, { onConflict: 'plaid_transaction_id' }).select('id, notified_at').single();
      if (!saved) continue;

      const { count } = await admin.from('allocations').select('*', { count: 'exact', head: true }).eq('transaction_id', saved.id);
      if (count) continue; // already categorized (maybe split by the user) - leave it alone

      // A posted transaction replacing a pending one keeps whatever the family chose for the pending one.
      if (t.pending_transaction_id) {
        const { data: prev } = await admin.from('transactions').select('id, notified_at')
          .eq('plaid_transaction_id', t.pending_transaction_id).maybeSingle();
        if (prev) {
          await admin.from('allocations').update({ transaction_id: saved.id }).eq('transaction_id', prev.id);
          await admin.from('transactions').update({ notified_at: prev.notified_at }).eq('id', saved.id);
          await admin.from('transactions').delete().eq('id', prev.id);
          continue;
        }
      }

      // Card payments, transfers and income are stored for the activity list but not budgeted.
      if (!isBudgetSpending({ plaidCategory: row.plaid_category, plaidDetailedCategory: row.plaid_detailed_category })) continue;

      const sorted = sortTransaction(
        { merchant: row.merchant, plaidCategory: row.plaid_category, plaidDetailedCategory: row.plaid_detailed_category },
        rules, slugBuckets, history,
      );
      await admin.from('allocations').insert({
        transaction_id: saved.id, household_id: householdId, amount: row.amount, source: sorted.source,
        reason: sorted.source === 'rule' || sorted.source === 'ai' ? sorted.reason : null,
        bucket_id: slugToId.get(sorted.bucketId) ?? sorted.bucketId,
      });
      if (sorted.askAi && row.amount > 0) {
        const key = vendorKey(row.merchant);
        const v = vague.get(key);
        if (v) v.txIds.push(saved.id);
        else vague.set(key, { id: saved.id, merchant: row.merchant, amount: row.amount, plaidCategory: row.plaid_category, plaidDetailedCategory: row.plaid_detailed_category, txIds: [saved.id] });
      }
      if (!saved.notified_at && row.amount > 0) fresh.push(saved.id);
    }

    const removed = page.removed.map((r: any) => r.transaction_id);
    if (removed.length) await admin.from('transactions').delete().in('plaid_transaction_id', removed);

    cursor = page.next_cursor;
    if (!page.has_more) break;
  }
  await admin.from('plaid_items').update({ sync_cursor: cursor, status: 'ok' }).eq('id', item.id);

  // Let Claude place what the rules couldn't, before anyone is notified. Capped so a first
  // sync with months of history stays quick; the rest keep their plain category.
  if (hh?.ai_sorting !== false && vague.size) {
    const stores = [...vague.values()].slice(0, 100);
    const choices = await aiSort(stores, slugBuckets, history);
    for (const s of stores) {
      const c = choices.get(s.id);
      if (!c) continue;
      await admin.from('allocations').update({ bucket_id: slugToId.get(c.bucketId) ?? c.bucketId, source: 'ai', reason: c.reason })
        .in('transaction_id', s.txIds).eq('source', 'auto');
    }
  }

  // Skip notifications on the very first sync (which back-fills 90 days of history).
  if (item.sync_cursor) await notify(householdId, buckets, fresh);
}

async function notify(householdId: string, buckets: Bucket[], transactionIds: string[]) {
  if (!transactionIds.length) return;
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  // A few months back, so monthly bills like rent are recognised and planned for.
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4, 1)).toISOString().slice(0, 10);
  const { data: txRows } = await admin.from('transactions').select('*')
    .eq('household_id', householdId).gte('date', since);
  const { data: allocRows } = await admin.from('allocations').select('*, transactions!inner(date)').eq('household_id', householdId)
    .gte('transactions.date', since);

  const transactions: Transaction[] = (txRows ?? []).map((t) => ({
    id: t.id, accountId: t.account_id, merchant: t.merchant, amount: t.amount, date: t.date, pending: t.pending,
    plaidCategory: t.plaid_category ?? undefined,
  }));
  const allocations: Allocation[] = (allocRows ?? []).map((a) => ({
    transactionId: a.transaction_id, bucketId: a.bucket_id, amount: a.amount, source: a.source,
  }));
  const bills = findBills(transactions, month, now.getUTCDate(), allocations);
  const statuses = withBills(bucketStatuses(buckets, transactions, allocations, month), billsByBucket(bills));

  for (const id of transactionIds) {
    const tx = transactions.find((t) => t.id === id && t.date.startsWith(month));
    if (!tx) continue; // older than this month
    const parts = allocations.filter((a) => a.transactionId === id)
      .map((a) => ({ amount: a.amount, status: statuses.find((s) => s.bucket.id === a.bucketId)! }))
      .filter((p) => p.status);
    const today = new Date();
    const days = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
    const { title, body, bucketId } = transactionNotification(tx, parts, today.getUTCDate(), days);
    await pushToHousehold(householdId, { title, body, data: { transactionId: id, bucketId } });
    await admin.from('transactions').update({ notified_at: new Date().toISOString() }).eq('id', id);
  }
}
