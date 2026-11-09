-- Family Budget: initial schema.
-- Multi-household from day one so the same backend can serve paying customers later.
-- Money is stored as integer cents.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Overspending is covered by unused room in other buckets before touching savings.
  use_bucket_slack boolean not null default true,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create or replace function is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid())
$$;

create table buckets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  slug text,                      -- default bucket id (e.g. 'groceries'), null for custom
  name text not null,
  icon text not null default 'star.fill',
  monthly_limit bigint not null check (monthly_limit >= 0),
  is_custom boolean not null default false,
  archived boolean not null default false,
  sort_order int not null default 0
);

create table merchant_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  match text not null,
  bucket_id uuid not null references buckets on delete cascade
);

-- One row per Plaid Item (a bank login). The access token is a secret: it lives in
-- Supabase Vault and is only readable by edge functions using the service role.
create table plaid_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  plaid_item_id text not null unique,
  access_token_secret_id uuid not null,   -- vault.secrets id
  institution_name text,
  sync_cursor text,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  plaid_item_id uuid references plaid_items on delete cascade,
  plaid_account_id text unique,
  name text not null,
  mask text,
  type text,                      -- depository / credit / ...
  subtype text,                   -- checking / savings / credit card ...
  -- A savings account whose balance backs the savings-goal envelopes.
  backs_savings_goals boolean not null default false,
  current_balance bigint
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  plaid_transaction_id text unique,
  pending_transaction_id text,    -- links a posted txn to its earlier pending one
  merchant text not null,
  amount bigint not null,         -- positive = spent
  date date not null,
  pending boolean not null default false,
  plaid_category text,
  plaid_detailed_category text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index on transactions (household_id, date);

-- How a transaction is split across buckets. Sum of amounts = transaction amount.
create table allocations (
  transaction_id uuid not null references transactions on delete cascade,
  bucket_id uuid not null references buckets on delete restrict,
  household_id uuid not null references households on delete cascade,
  amount bigint not null,
  source text not null check (source in ('auto', 'rule', 'user', 'receipt')),
  primary key (transaction_id, bucket_id)
);

create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  target bigint not null,
  balance bigint not null default 0,
  monthly_contribution bigint not null default 0,
  priority int not null default 1,
  target_date date
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  transaction_id uuid references transactions on delete set null,
  storage_path text,              -- private bucket 'receipts'; may be deleted after scanning
  merchant text,
  total bigint,
  purchased_on date,
  status text not null default 'scanned' check (status in ('scanned', 'confirmed')),
  created_at timestamptz not null default now()
);

create table receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts on delete cascade,
  household_id uuid not null references households on delete cascade,
  description text not null,
  amount bigint not null,
  suggested_bucket_id uuid references buckets on delete set null,
  bucket_id uuid references buckets on delete set null
);

create table push_tokens (
  user_id uuid not null references auth.users on delete cascade,
  expo_push_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

-- Row-level security: members can only see their own household's data.
do $$
declare t text;
begin
  foreach t in array array['buckets','merchant_rules','accounts','transactions','allocations','savings_goals','receipts','receipt_lines']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy household_rw on %I for all using (is_member(household_id)) with check (is_member(household_id))', t);
  end loop;
end $$;

alter table households enable row level security;
create policy member_read on households for select using (is_member(id));
create policy member_update on households for update using (is_member(id));

alter table household_members enable row level security;
create policy member_read on household_members for select using (is_member(household_id));

-- Plaid items are never readable from the app (only via service role in edge functions),
-- except for display fields through this view.
alter table plaid_items enable row level security;
create view linked_institutions with (security_invoker = false) as
  select id, household_id, institution_name, status, created_at from plaid_items where is_member(household_id);

alter table push_tokens enable row level security;
create policy own_tokens on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vault helpers for Plaid access tokens. Only the service role (edge functions) may call these.
create or replace function store_plaid_token(token text, label text) returns uuid
language sql security definer set search_path = public, vault as $$
  select vault.create_secret(token, label)
$$;
create or replace function read_plaid_token(secret_id uuid) returns text
language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where id = secret_id
$$;
revoke all on function store_plaid_token(text, text) from public, anon, authenticated;
revoke all on function read_plaid_token(uuid) from public, anon, authenticated;

-- Creates a household for the signed-in user, seeded with the default buckets.
create or replace function create_household(household_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households (name) values (household_name) returning id into h;
  insert into household_members (household_id, user_id, role) values (h, auth.uid(), 'owner');
  insert into buckets (household_id, slug, name, icon, monthly_limit, sort_order) values
    (h, 'housing', 'Housing', 'house.fill', 180000, 1),
    (h, 'groceries', 'Groceries', 'cart.fill', 70000, 2),
    (h, 'dining', 'Dining Out', 'fork.knife', 25000, 3),
    (h, 'transport', 'Transportation', 'car.fill', 40000, 4),
    (h, 'health', 'Health', 'cross.case.fill', 20000, 5),
    (h, 'kids', 'Kids', 'figure.and.child.holdinghands', 20000, 6),
    (h, 'shopping', 'Shopping', 'bag.fill', 25000, 7),
    (h, 'entertainment', 'Entertainment', 'tv.fill', 12000, 8),
    (h, 'personal', 'Personal Care', 'sparkles', 8000, 9),
    (h, 'bills', 'Bills & Services', 'doc.text.fill', 30000, 10),
    (h, 'other', 'Everything Else', 'questionmark.circle.fill', 15000, 11);
  return h;
end $$;
