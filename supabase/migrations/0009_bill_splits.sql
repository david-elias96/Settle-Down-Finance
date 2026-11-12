-- Bills shared with people outside the app (rent split with a roommate, a utility split three
-- ways). Only the household's share counts toward the budget. A split applies either to one
-- transaction or to every charge from a vendor (by the app's vendorKey). Rows cascade from
-- households and transactions, so deleting a household or unlinking a bank removes them.

create table bill_splits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  transaction_id uuid references transactions on delete cascade,
  vendor_key text check (char_length(vendor_key) between 1 and 80),
  -- "Split 3 ways"; null when the household typed its own share.
  ways int check (ways between 2 and 50),
  -- The household's share of each charge, 0 to 1.
  fraction numeric not null check (fraction >= 0 and fraction <= 1),
  created_at timestamptz not null default now(),
  check ((transaction_id is null) <> (vendor_key is null))
);
create unique index bill_splits_one_per_transaction on bill_splits (household_id, transaction_id) where transaction_id is not null;
create unique index bill_splits_one_per_vendor on bill_splits (household_id, vendor_key) where vendor_key is not null;

alter table bill_splits enable row level security;
create policy household_rw on bill_splits for all using (is_member(household_id)) with check (is_member(household_id));
