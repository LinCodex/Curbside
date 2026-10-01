begin;

-- Service-only check for a live session. Neither customer-selected account IDs
-- nor a valid but revoked JWT may authorize permanent account deletion.
create function public.curbside_can_delete_account(account_id uuid, session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=session_id and s.user_id=account_id
      and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false
  );
$$;
revoke all on function public.curbside_can_delete_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.curbside_can_delete_account(uuid,uuid) to service_role;

commit;
