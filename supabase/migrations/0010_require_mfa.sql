-- Two-step verification is required at every sign-in once it's set up (policy section 4).
-- A user with a verified second factor (authenticator app or passkey) can reach household data
-- only from a session that used it (AAL2). Users without a second factor are unaffected.
-- Every household table, the linked_institutions view and the member-only RPCs go through
-- is_member(), so tightening it here covers them all.

create or replace function mfa_satisfied() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
      )
$$;
revoke execute on function mfa_satisfied() from public, anon;
grant execute on function mfa_satisfied() to authenticated;

create or replace function is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_satisfied()
     and exists (select 1 from household_members where household_id = h and user_id = auth.uid())
$$;
