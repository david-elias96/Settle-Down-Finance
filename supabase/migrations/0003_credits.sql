-- AI credits. Each household gets a monthly allowance (40 on both plans) that resets
-- on the 1st in the household's timezone; purchased packs (`extra`) roll over and are
-- used only after the allowance runs out. Every change is written to credit_ledger.
-- Rules mirror src/domain/credits.ts.

create table credit_balances (
  household_id uuid primary key references households on delete cascade,
  plan text not null default 'monthly' check (plan in ('monthly', 'yearly', 'none')),
  allowance int not null default 40 check (allowance >= 0),
  period text not null default to_char(now(), 'YYYY-MM'),  -- month the usage counts toward
  used_this_month int not null default 0 check (used_this_month >= 0),
  extra int not null default 0 check (extra >= 0),
  updated_at timestamptz not null default now()
);

create table credit_ledger (
  id bigint generated always as identity primary key,
  household_id uuid not null references households on delete cascade,
  delta int not null,                -- negative = spent, positive = purchase/refund
  reason text not null,              -- 'ask' | 'receipt_scan' | 'purchase' | 'refund'
  ref text,                          -- request id, receipt id or App Store transaction id
  created_at timestamptz not null default now()
);
create index on credit_ledger (household_id, created_at desc);
-- A purchase is credited once even if the store webhook is retried.
create unique index credit_ledger_purchase_once on credit_ledger (ref) where reason = 'purchase';

alter table credit_balances enable row level security;
alter table credit_ledger enable row level security;
-- Members can see their balance and history; only the backend (service role) changes them.
create policy member_read on credit_balances for select using (is_member(household_id));
create policy member_read on credit_ledger for select using (is_member(household_id));

-- New households start with a balance row.
insert into credit_balances (household_id) select id from households on conflict do nothing;
create or replace function seed_credit_balance() returns trigger language plpgsql as $$
begin
  insert into credit_balances (household_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger households_seed_credits after insert on households
  for each row execute function seed_credit_balance();

-- Spends `cost` credits atomically. Returns ok=false (and changes nothing) when there
-- aren't enough. The row lock stops two phones in the household double-spending.
create or replace function spend_credit(p_household uuid, p_cost int, p_reason text, p_ref text default null)
returns table (ok boolean, monthly_left int, extra_left int)
language plpgsql security definer set search_path = public as $$
declare
  b credit_balances;
  month text;
  from_monthly int;
begin
  select to_char(now() at time zone h.timezone, 'YYYY-MM') into month from households h where h.id = p_household;
  select * into b from credit_balances where household_id = p_household for update;
  if not found then
    insert into credit_balances (household_id, period) values (p_household, month) returning * into b;
  end if;
  if b.period <> month then
    b.period := month; b.used_this_month := 0;
  end if;

  if b.plan = 'none' then b.allowance := 0; end if;
  if greatest(b.allowance - b.used_this_month, 0) + b.extra < p_cost then
    return query select false, greatest(b.allowance - b.used_this_month, 0), b.extra;
    return;
  end if;

  from_monthly := least(p_cost, greatest(b.allowance - b.used_this_month, 0));
  update credit_balances set period = b.period, used_this_month = b.used_this_month + from_monthly,
    extra = b.extra - (p_cost - from_monthly), updated_at = now()
    where household_id = p_household returning * into b;
  insert into credit_ledger (household_id, delta, reason, ref) values (p_household, -p_cost, p_reason, p_ref);
  return query select true, greatest(b.allowance - b.used_this_month, 0), b.extra;
end $$;

-- Gives credits back when the AI call fails after charging, or adds a purchased pack.
-- Refunds go back to the monthly allowance first (where they most likely came from).
create or replace function add_credits(p_household uuid, p_amount int, p_reason text, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare back_to_monthly int;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  insert into credit_ledger (household_id, delta, reason, ref) values (p_household, p_amount, p_reason, p_ref);
  if p_reason = 'refund' then
    select least(p_amount, used_this_month) into back_to_monthly from credit_balances where household_id = p_household for update;
    update credit_balances set used_this_month = used_this_month - back_to_monthly,
      extra = extra + (p_amount - back_to_monthly), updated_at = now() where household_id = p_household;
  else
    update credit_balances set extra = extra + p_amount, updated_at = now() where household_id = p_household;
  end if;
end $$;

revoke all on function spend_credit(uuid, int, text, text) from public, anon, authenticated;
revoke all on function add_credits(uuid, int, text, text) from public, anon, authenticated;
