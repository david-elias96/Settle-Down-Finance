-- Family members: invite by link, each member links their own banks into the shared budget.

alter table household_members
  add column display_name text,
  add column joined_at timestamptz not null default now();

-- Who linked each bank, so the app can show whose account a purchase came from and only
-- that person can unlink it. Their bank login stays with Plaid; nobody else sees it.
alter table plaid_items add column linked_by uuid references auth.users on delete set null;
alter table accounts add column owner_user_id uuid references auth.users on delete set null;

create or replace view linked_institutions with (security_invoker = false) as
  select id, household_id, institution_name, status, created_at, linked_by
  from plaid_items where is_member(household_id);

create table household_invites (
  code text primary key,                       -- short code in the invite link
  household_id uuid not null references households on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users on delete set null,
  accepted_at timestamptz
);
alter table household_invites enable row level security;
create policy member_read on household_invites for select using (is_member(household_id));

-- Any member can invite. Returns a single-use code valid for 7 days. The alphabet skips
-- look-alike characters (0/O, 1/I/L) so it's easy to read out loud.
create or replace function create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  if not is_member(p_household) then raise exception 'not a member of this household'; end if;
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into household_invites (code, household_id, created_by) values (c, p_household, auth.uid());
      return c;
    exception when unique_violation then
      -- extremely unlikely; try another code
    end;
  end loop;
end $$;

-- The invited person, signed in on their own phone, joins with the code.
create or replace function accept_invite(p_code text, p_display_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv household_invites;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into inv from household_invites where code = upper(trim(p_code)) for update;
  if not found or inv.expires_at < now() then raise exception 'This invite has expired. Ask for a new one.'; end if;
  if inv.accepted_by is not null and inv.accepted_by <> auth.uid() then raise exception 'This invite was already used.'; end if;
  insert into household_members (household_id, user_id, role, display_name)
    values (inv.household_id, auth.uid(), 'member', nullif(trim(p_display_name), ''))
    on conflict (household_id, user_id) do update set display_name = coalesce(excluded.display_name, household_members.display_name);
  update household_invites set accepted_by = auth.uid(), accepted_at = now() where code = inv.code;
  return inv.household_id;
end $$;

-- Members can update their own display name; the owner can remove other members.
create policy own_name on household_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner_remove on household_members for delete using (
  user_id <> auth.uid() and exists (select 1 from household_members o
    where o.household_id = household_members.household_id and o.user_id = auth.uid() and o.role = 'owner'));

revoke all on function create_invite(uuid) from public, anon;
revoke all on function accept_invite(text, text) from public, anon;
grant execute on function create_invite(uuid) to authenticated;
grant execute on function accept_invite(text, text) to authenticated;
