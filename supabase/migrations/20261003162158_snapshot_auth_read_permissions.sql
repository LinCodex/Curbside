begin;

-- Service-only invoker RPCs finish shared snapshots and check email eligibility.
-- BYPASSRLS does not grant SELECT: hosted Auth does not grant this role reads by
-- default. Limit access to the four columns those RPCs actually use; never grant
-- customer/anonymous roles or access to passwords, tokens or Auth sessions.
grant select (id, email, email_confirmed_at, is_anonymous)
  on auth.users to service_role;

commit;
