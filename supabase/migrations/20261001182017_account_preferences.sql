begin;

-- This lookup is deliberately outside the exposed public schema. It returns
-- only whether the calling user's current Auth record has a confirmed email.
create schema if not exists curbside_private;
revoke all on schema curbside_private from public, anon;
grant usage on schema curbside_private to authenticated;
create function curbside_private.confirmed_email() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
      and coalesce(is_anonymous, false) = false);
$$;
revoke all on function curbside_private.confirmed_email() from public, anon;
grant execute on function curbside_private.confirmed_email() to authenticated;

create table public.curbside_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  language text not null default 'system' check (language in ('system','en','zh')),
  detail_mode text not null default 'normal' check (detail_mode in ('normal','geek'))
);
alter table public.curbside_preferences enable row level security;
create policy "Read own preferences" on public.curbside_preferences for select to authenticated
  using ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
create policy "Create own preferences" on public.curbside_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
create policy "Update own preferences" on public.curbside_preferences for update to authenticated
  using ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()))
  with check ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
revoke all on public.curbside_preferences from anon, authenticated;
grant select on public.curbside_preferences to authenticated;
grant insert (user_id,theme,language,detail_mode) on public.curbside_preferences to authenticated;
grant update (theme,language,detail_mode) on public.curbside_preferences to authenticated;

-- Defense in depth: even a previously issued token cannot grant an
-- unconfirmed/anonymous account access to cars or acceptance records.
alter policy "Read own cars" on public.curbside_vehicles
  using ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
alter policy "Save own car after accepting terms" on public.curbside_vehicles
  with check ((select auth.uid()) = user_id and (select curbside_private.confirmed_email())
    and exists (select 1 from public.curbside_terms_acceptances t
      where t.user_id = (select auth.uid()) and t.version = '2026-09-27.1'));
alter policy "Edit own car" on public.curbside_vehicles
  using ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()))
  with check ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
alter policy "Remove own car" on public.curbside_vehicles
  using ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
alter policy "Read own acceptances" on public.curbside_terms_acceptances
  using ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));
alter policy "Record own acceptance" on public.curbside_terms_acceptances
  with check ((select auth.uid()) = user_id and (select curbside_private.confirmed_email()));

comment on table public.curbside_preferences is 'Private display preferences per confirmed account. Draft previews are never persisted.';
commit;
