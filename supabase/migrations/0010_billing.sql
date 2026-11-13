-- Paid plans (web checkout through Stripe), founder/comp access, and the one switch that turns
-- the paywall on. Card details never reach us: people pay on Stripe's hosted Checkout page, and
-- Stripe's webhook (stripe-webhook function) writes the subscription state here.
--
-- Access rules (mirrored in src/domain/billing.ts):
--   * the switch billing_settings.enforced is off  -> everyone has access (today's behaviour)
--   * a comp_access row for the user (not expired) -> access, unlimited AI credits
--   * the user's own subscription is trialing, active or past_due (Stripe is still retrying) -> access
--   * anyone in one of the user's households has one of the above -> access (one plan covers the household)

-- One-row settings table. Flip `enforced` in the SQL editor when Stripe is set up and tested.
create table billing_settings (
  id boolean primary key default true check (id),
  enforced boolean not null default false,
  trial_days int not null default 14 check (trial_days between 0 and 60),
  updated_at timestamptz not null default now()
);
insert into billing_settings default values;
alter table billing_settings enable row level security;
create policy signed_in_read on billing_settings for select to authenticated using (true);

-- The payer's subscription. Only the backend (service role) writes it.
create table subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text not null default 'none'
    check (status in ('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  plan text check (plan in ('monthly', 'yearly')),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Set once a subscription has existed, so a second free trial isn't offered.
  had_subscription boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
create policy own_read on subscriptions for select using (auth.uid() = user_id);
-- The app may read its own status but never the Stripe ids.
revoke all on subscriptions from anon, authenticated;
grant select (user_id, status, plan, trial_end, current_period_end, cancel_at_period_end) on subscriptions to authenticated;

-- Free access for the founder, family and testers. Granted only with grant_comp() in the SQL
-- editor (service role); nobody can grant it from the app.
create table comp_access (
  user_id uuid primary key references auth.users on delete cascade,
  reason text not null check (length(reason) between 1 and 80),
  expires_at timestamptz,
  granted_at timestamptz not null default now()
);
alter table comp_access enable row level security;
create policy own_read on comp_access for select using (auth.uid() = user_id);
revoke all on comp_access from anon, authenticated;
grant select (user_id, reason, expires_at) on comp_access to authenticated;

create or replace function billing_user_status(p_user uuid)
returns table (comped boolean, subscribed boolean)
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from comp_access c where c.user_id = p_user and (c.expires_at is null or c.expires_at > now())),
    exists (select 1 from subscriptions s where s.user_id = p_user and s.status in ('trialing', 'active', 'past_due'));
$$;

-- Whether a household may use paid features (Plaid Link, AI). Called by edge functions.
create or replace function household_access(p_household uuid)
returns table (access boolean, comped boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  is_enforced boolean;
  any_comp boolean := false;
  any_sub boolean := false;
begin
  select enforced into is_enforced from billing_settings;
  select coalesce(bool_or(st.comped), false), coalesce(bool_or(st.subscribed), false) into any_comp, any_sub
    from household_members m cross join lateral billing_user_status(m.user_id) st
    where m.household_id = p_household;
  return query select (not coalesce(is_enforced, false)) or any_comp or any_sub, any_comp;
end $$;

-- What the app shows: the signed-in user's access and plan.
create or replace function my_billing()
returns table (
  access boolean, reason text, enforced boolean, status text, plan text,
  trial_end timestamptz, current_period_end timestamptz, cancel_at_period_end boolean, trial_days int, can_trial boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  is_enforced boolean;
  days int;
  me record;
  sub subscriptions;
  via_household boolean;
  why text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select b.enforced, b.trial_days into is_enforced, days from billing_settings b;
  select * into me from billing_user_status(uid);
  select * into sub from subscriptions s where s.user_id = uid;
  select exists (
    select 1 from household_members mine
      join household_members other on other.household_id = mine.household_id and other.user_id <> uid
      cross join lateral billing_user_status(other.user_id) st
    where mine.user_id = uid and (st.comped or st.subscribed)
  ) into via_household;

  why := case when me.comped then 'comp' when me.subscribed then 'subscribed' when via_household then 'household'
              when not coalesce(is_enforced, false) then 'open' else 'none' end;
  return query select why <> 'none', why, coalesce(is_enforced, false), coalesce(sub.status, 'none'), sub.plan,
    sub.trial_end, sub.current_period_end, coalesce(sub.cancel_at_period_end, false), days,
    not coalesce(sub.had_subscription, false);
end $$;

-- Founder/family/tester access, run in the Supabase SQL editor:
--   select grant_comp('you@example.com', 'founder');            -- forever
--   select grant_comp('tester@example.com', 'beta tester', 90);  -- 90 days
--   select revoke_comp('tester@example.com');
create or replace function grant_comp(p_email text, p_reason text, p_days int default null)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No account with that email. Sign in to the app once first.'; end if;
  insert into comp_access (user_id, reason, expires_at)
    values (uid, p_reason, case when p_days is null then null else now() + make_interval(days => p_days) end)
    on conflict (user_id) do update set reason = excluded.reason, expires_at = excluded.expires_at, granted_at = now();
  return uid;
end $$;

create or replace function revoke_comp(p_email text)
returns void language sql security definer set search_path = public, auth as $$
  delete from comp_access where user_id = (select id from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function billing_user_status(uuid) from public, anon, authenticated;
revoke all on function household_access(uuid) from public, anon, authenticated;
revoke all on function grant_comp(text, text, int) from public, anon, authenticated;
revoke all on function revoke_comp(text) from public, anon, authenticated;
revoke all on function my_billing() from public, anon;
grant execute on function my_billing() to authenticated;
