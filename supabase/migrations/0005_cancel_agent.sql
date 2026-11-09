-- Subscription-cancelling agent sessions. The browser and the user's logins stay on the
-- phone; this only keeps the agent's conversation (page text with sensitive values
-- removed) and the outcome, as a record of what was cancelled and when.
create table cancel_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  vendor text not null,                 -- as it appears on the bank statement
  service_name text not null,
  start_url text not null,
  allowed_domains text[] not null,
  messages jsonb not null default '[]', -- agent conversation, for the next step
  steps int not null default 0,
  status text not null default 'running' check (status in ('running', 'done', 'stopped')),
  outcome text check (outcome in ('cancelled', 'already_cancelled', 'billed_elsewhere', 'not_found', 'failed')),
  summary text,
  confirmation text,                    -- confirmation number or text shown by the service
  ends_on text,                         -- when access ends, as the service said it
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on cancel_sessions (household_id, created_at desc);

alter table cancel_sessions enable row level security;
-- Members see the household's cancellations (not the conversation details via the app UI);
-- only the backend writes.
create policy member_read on cancel_sessions for select using (is_member(household_id));
