import type { Bucket } from './types.ts';
import { dollars } from './money.ts';

/**
 * Starter buckets. Limits are placeholders until the family's real budget is loaded.
 * `plaidPrimary` maps Plaid's personal_finance_category.primary values onto each bucket.
 */
export const DEFAULT_BUCKETS: (Bucket & { plaidPrimary: string[] })[] = [
  { id: 'housing', name: 'Housing', icon: 'house.fill', monthlyLimit: dollars(1800), isCustom: false, plaidPrimary: ['RENT_AND_UTILITIES'] },
  { id: 'groceries', name: 'Groceries', icon: 'cart.fill', monthlyLimit: dollars(700), isCustom: false, plaidPrimary: [] },
  { id: 'dining', name: 'Dining Out', icon: 'fork.knife', monthlyLimit: dollars(250), isCustom: false, plaidPrimary: ['FOOD_AND_DRINK'] },
  { id: 'transport', name: 'Transportation', icon: 'car.fill', monthlyLimit: dollars(400), isCustom: false, plaidPrimary: ['TRANSPORTATION', 'TRAVEL'] },
  { id: 'health', name: 'Health', icon: 'cross.case.fill', monthlyLimit: dollars(200), isCustom: false, plaidPrimary: ['MEDICAL'] },
  { id: 'kids', name: 'Kids', icon: 'figure.and.child.holdinghands', monthlyLimit: dollars(200), isCustom: false, plaidPrimary: [] },
  { id: 'shopping', name: 'Shopping', icon: 'bag.fill', monthlyLimit: dollars(250), isCustom: false, plaidPrimary: ['GENERAL_MERCHANDISE'] },
  { id: 'entertainment', name: 'Entertainment', icon: 'tv.fill', monthlyLimit: dollars(120), isCustom: false, plaidPrimary: ['ENTERTAINMENT'] },
  { id: 'personal', name: 'Personal Care', icon: 'sparkles', monthlyLimit: dollars(80), isCustom: false, plaidPrimary: ['PERSONAL_CARE'] },
  { id: 'bills', name: 'Bills & Services', icon: 'doc.text.fill', monthlyLimit: dollars(300), isCustom: false, plaidPrimary: ['GENERAL_SERVICES', 'LOAN_PAYMENTS', 'GOVERNMENT_AND_NON_PROFIT'] },
  { id: 'other', name: 'Everything Else', icon: 'questionmark.circle.fill', monthlyLimit: dollars(150), isCustom: false, plaidPrimary: [] },
];

/** Detailed Plaid categories that should override the primary mapping. */
export const PLAID_DETAILED_OVERRIDES: Record<string, string> = {
  FOOD_AND_DRINK_GROCERIES: 'groceries',
  GENERAL_MERCHANDISE_SUPERSTORES: 'shopping',
};

export const FALLBACK_BUCKET_ID = 'other';
