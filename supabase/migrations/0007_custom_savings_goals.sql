-- Custom savings goals: people now create, edit and delete their own goals from the app.
-- The savings_goals table and its household-only row level security come from 0001_init.
-- These checks mirror the app's form validation so bad values can't be written directly.

alter table savings_goals
  add constraint savings_goals_name_length check (char_length(btrim(name)) between 1 and 40),
  add constraint savings_goals_target_positive check (target > 0 and target <= 1000000000),
  add constraint savings_goals_balance_range check (balance >= 0 and balance <= 1000000000),
  add constraint savings_goals_monthly_range check (monthly_contribution >= 0 and monthly_contribution <= 1000000000),
  add column created_at timestamptz not null default now();

-- Goals are listed per household in priority order.
create index if not exists savings_goals_household_priority on savings_goals (household_id, priority);
