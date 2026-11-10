-- Controls from docs/security/information-security-policy.md that live in the database.

-- 1. Consent. A user must accept the data-use notice (current version) before the backend
--    will create a Plaid Link token for them. Kept as a record of when they agreed.
create table plaid_consents (
  user_id uuid not null references auth.users on delete cascade,
  notice_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, notice_version)
);
alter table plaid_consents enable row level security;
create policy own_read on plaid_consents for select using (user_id = auth.uid());
create policy own_insert on plaid_consents for insert with check (user_id = auth.uid());

-- 2. Plaid access tokens: delete the Vault secret when an item is unlinked or an account is
--    deleted. Service role only, like store/read.
create or replace function delete_plaid_token(secret_id uuid) returns void
language sql security definer set search_path = public, vault as $$
  delete from vault.secrets where id = secret_id
$$;
revoke all on function delete_plaid_token(uuid) from public, anon, authenticated;

-- 3. Invite codes from a cryptographic random source instead of random().
create or replace function create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 characters, no look-alikes
  c text;
  b int;
begin
  if not is_member(p_household) then raise exception 'not a member of this household'; end if;
  loop
    c := '';
    while length(c) < 8 loop
      b := get_byte(gen_random_bytes(1), 0);
      -- Rejection sampling: 248 = 8 * 31, so every character is equally likely.
      if b < 248 then c := c || substr(alphabet, 1 + (b % 31), 1); end if;
    end loop;
    begin
      insert into household_invites (code, household_id, created_by) values (c, p_household, auth.uid());
      return c;
    exception when unique_violation then
      -- extremely unlikely; try another code
    end;
  end loop;
end $$;
revoke all on function create_invite(uuid) from public, anon;
grant execute on function create_invite(uuid) to authenticated;

-- 4. The cancel assistant's conversation (page text) is backend-only. Members can still read
--    the outcome of each cancellation.
revoke select on cancel_sessions from authenticated, anon;
grant select (id, household_id, user_id, vendor, service_name, status, outcome, summary, confirmation, ends_on, created_at, finished_at)
  on cancel_sessions to authenticated;

-- 5. Retention: when an inactive account was warned before deletion (see the retention function).
create table retention_notices (
  user_id uuid primary key references auth.users on delete cascade,
  warned_at timestamptz not null default now()
);
alter table retention_notices enable row level security;  -- no policies: backend only

-- Last sign-in per user, for the retention job (auth.users is not exposed over the API).
create or replace function inactive_users(before timestamptz) returns table (user_id uuid, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select id, coalesce(last_sign_in_at, created_at) from auth.users where coalesce(last_sign_in_at, created_at) < before
$$;
revoke all on function inactive_users(timestamptz) from public, anon, authenticated;
