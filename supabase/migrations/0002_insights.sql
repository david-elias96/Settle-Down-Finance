-- Smart insight alerts: one row per insight sent, so the same one isn't repeated and
-- 👍/👎 feedback can steer which kinds get sent.
create table insights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  insight_key text not null,           -- e.g. '2026-11:risk:dining'
  kind text not null,
  title text not null,
  body text not null,
  facts jsonb not null default '{}',   -- the numbers the message was written from
  sent_at timestamptz not null default now(),
  feedback smallint check (feedback in (-1, 1)),
  unique (household_id, insight_key)
);
create index on insights (household_id, sent_at desc);

alter table insights enable row level security;
create policy household_rw on insights for all using (is_member(household_id)) with check (is_member(household_id));

-- Per-household alert preferences.
alter table households
  add column smart_alerts boolean not null default true,
  add column weekly_summary boolean not null default true,
  add column quiet_start smallint not null default 21,  -- local hour; no alerts from 9pm
  add column quiet_end smallint not null default 8,     -- until 8am
  add column timezone text not null default 'America/Denver';
