/** All money is stored as integer cents to avoid floating-point drift. */
export type Cents = number;

/** A calendar month in "YYYY-MM" form, e.g. "2026-11". */
export type Month = string;

export interface Bucket {
  id: string;
  name: string;
  /** SF Symbol / icon name shown in the UI. */
  icon: string;
  monthlyLimit: Cents;
  /** Default buckets come from the template; custom ones are created by the user. */
  isCustom: boolean;
  archived?: boolean;
}

export interface Transaction {
  id: string;
  /** Plaid transaction id, when the transaction came from a linked account. */
  externalId?: string;
  accountId: string;
  merchant: string;
  /** Positive = money spent, negative = refund / income. */
  amount: Cents;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  pending: boolean;
  /** Plaid personal_finance_category.primary, e.g. "FOOD_AND_DRINK". */
  plaidCategory?: string;
  plaidDetailedCategory?: string;
  /**
   * Set when the bill is shared with people outside the app (roommates, a landlord split).
   * `amount` is then the household's share, and `fullAmount` is what the bank charged.
   */
  split?: { fullAmount: Cents; ways: number | null; recurring: boolean };
}

/**
 * How a transaction's amount is assigned to buckets. A normal purchase has one
 * allocation; a receipt-split purchase (e.g. Target: food + toys) has several.
 * Allocations for a transaction always sum exactly to its amount.
 */
export interface Allocation {
  transactionId: string;
  bucketId: string;
  amount: Cents;
  source: 'auto' | 'rule' | 'user' | 'receipt';
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: Cents;
  /** Money currently set aside for this goal (a virtual envelope). */
  balance: Cents;
  monthlyContribution: Cents;
  /** Lower number = protected first. Overspending draws from the highest number first. */
  priority: number;
  targetDate?: string;
}

export interface MerchantRule {
  /** Case-insensitive substring matched against the merchant name. */
  match: string;
  bucketId: string;
}

/** A person in the household. Everyone sees the shared budget; each links their own banks. */
export interface Member {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

/** A linked bank account or card, and the member who linked it. */
export interface Account {
  id: string;
  name: string;
  institution: string;
  mask?: string;
  ownerId: string;
}
