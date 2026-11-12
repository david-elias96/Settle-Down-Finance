import { describe, expect, it } from 'vitest';
import { householdWriter, loadHousehold } from './remote';

/** A stand-in for the Supabase client: returns fixed rows per table and records writes. */
function fakeDb(tables: Record<string, unknown[]>) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const db = {
    from(table: string) {
      const q: any = {
        _single: false,
        select() { return q; }, eq() { return q; }, gte() { return q; }, in(...a: unknown[]) { calls.push({ table, op: 'in', args: a }); return q; },
        order() { return q; },
        range(from: number, to: number) { return Promise.resolve({ data: (tables[table] ?? []).slice(from, to + 1), error: null }); },
        maybeSingle() { return Promise.resolve({ data: (tables[table] ?? [])[0] ?? null, error: null }); },
        single() { return Promise.resolve({ data: { id: 'new-id' }, error: null }); },
        insert(row: unknown) { calls.push({ table, op: 'insert', args: [row] }); return q; },
        update(row: unknown) { calls.push({ table, op: 'update', args: [row] }); return q; },
        delete() { calls.push({ table, op: 'delete', args: [] }); return q; },
        then(res: (v: unknown) => unknown) { return Promise.resolve({ data: null, error: null }).then(res); },
      };
      return q;
    },
  };
  return { db: db as any, calls };
}

const tables = {
  buckets: [
    { id: 'uuid-dining', slug: 'dining', name: 'Dining Out', icon: 'fork.knife', monthly_limit: 25000, is_custom: false, archived: false },
    { id: 'uuid-pets', slug: null, name: 'Pets', icon: 'star.fill', monthly_limit: 5000, is_custom: true, archived: false },
  ],
  transactions: [
    { id: 'tx1', plaid_transaction_id: 'p1', account_id: 'acc1', merchant: 'Cafe', amount: 1250, date: '2026-11-03', pending: false, plaid_category: 'FOOD_AND_DRINK', plaid_detailed_category: null },
  ],
  allocations: [{ transaction_id: 'tx1', bucket_id: 'uuid-dining', amount: 1250, source: 'ai', reason: 'Coffee shop' }],
  merchant_rules: [{ id: 'r1', match: 'pet', bucket_id: 'uuid-pets' }],
  savings_goals: [{ id: 'g1', name: 'Emergency Fund', target: 1000000, balance: 0, monthly_contribution: 0, priority: 1, target_date: null }],
  bill_splits: [
    { transaction_id: null, vendor_key: 'maple court', ways: 3, fraction: '0.3333' },
    { transaction_id: 'tx1', vendor_key: null, ways: null, fraction: 0.5 },
  ],
  household_members: [
    { user_id: 'u-me', role: 'owner', display_name: null },
    { user_id: 'u-2', role: 'member', display_name: 'Pat' },
  ],
  accounts: [{ id: 'acc1', name: 'Visa', mask: '1234', owner_user_id: 'u-me', plaid_item_id: 'item1' }],
  linked_institutions: [{ id: 'item1', institution_name: 'Test Bank' }],
  credit_balances: [{ allowance: 40, period: '2026-11', used_this_month: 3, extra: 5 }],
};

describe('loadHousehold', () => {
  it('maps rows to the shapes the screens use', async () => {
    const { db } = fakeDb(tables);
    const d = await loadHousehold(db, 'h1', 'u-me');
    // Default buckets go by slug, custom ones by uuid.
    expect(d.buckets.map((b) => b.id)).toEqual(['dining', 'uuid-pets']);
    expect(d.bucketUuid.get('dining')).toBe('uuid-dining');
    expect(d.allocations[0]).toEqual({ transactionId: 'tx1', bucketId: 'dining', amount: 1250, source: 'ai', reason: 'Coffee shop' });
    expect(d.rules).toEqual([{ match: 'pet', bucketId: 'uuid-pets' }]);
    expect(d.splits.byVendor['maple court']).toEqual({ ways: 3, fraction: 0.3333 });
    expect(d.splits.byTransaction.tx1).toEqual({ ways: null, fraction: 0.5 });
    expect(d.members.map((m) => m.name)).toEqual(['You', 'Pat']);
    expect(d.accounts[0]).toEqual({ id: 'acc1', name: 'Visa', institution: 'Test Bank', mask: '1234', ownerId: 'u-me' });
    expect(d.credits).toEqual({ allowance: 40, period: '2026-11', usedThisMonth: 3, extra: 5 });
    expect(d.goals[0].targetDate).toBeUndefined();
  });

  it('reads past the 1,000-row page limit', async () => {
    const many = Array.from({ length: 2300 }, (_, i) => ({ ...tables.transactions[0], id: `t${i}` }));
    const { db } = fakeDb({ ...tables, transactions: many });
    const d = await loadHousehold(db, 'h1', 'u-me');
    expect(d.transactions).toHaveLength(2300);
  });
});

describe('householdWriter', () => {
  it('writes bucket uuids, not app ids', async () => {
    const { db, calls } = fakeDb(tables);
    const w = householdWriter(db, 'h1', (id) => (id === 'dining' ? 'uuid-dining' : id));
    await w.replaceAllocations(['tx1'], [{ transactionId: 'tx1', bucketId: 'dining', amount: 1250, source: 'user' }, { transactionId: 'tx2', bucketId: 'dining', amount: 1, source: 'auto' }]);
    const insert = calls.find((c) => c.table === 'allocations' && c.op === 'insert')!;
    expect(insert.args[0]).toEqual([{ household_id: 'h1', transaction_id: 'tx1', bucket_id: 'uuid-dining', amount: 1250, source: 'user', reason: null }]);
  });

  it('saves a vendor split by vendor and a one-off split by purchase', async () => {
    const { db, calls } = fakeDb(tables);
    const w = householdWriter(db, 'h1', (id) => id);
    await w.setBillSplit('tx1', 'maple court', { ways: 3, fraction: 1 / 3 }, true);
    await w.setBillSplit('tx1', 'maple court', { ways: null, fraction: 0.5 }, false);
    await w.setBillSplit('tx1', 'maple court', null, false);
    const inserts = calls.filter((c) => c.table === 'bill_splits' && c.op === 'insert').map((c) => c.args[0]);
    expect(inserts).toEqual([
      { household_id: 'h1', ways: 3, fraction: 1 / 3, vendor_key: 'maple court' },
      { household_id: 'h1', ways: null, fraction: 0.5, transaction_id: 'tx1' },
    ]);
    expect(calls.filter((c) => c.table === 'bill_splits' && c.op === 'delete')).toHaveLength(6);
  });
});
