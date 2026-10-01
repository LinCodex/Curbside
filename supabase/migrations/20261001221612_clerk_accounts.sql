begin;
-- Preserve legacy UUIDs and all saved rows. Clerk IDs are an admin-controlled mapping.
create table public.curbside_accounts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  legacy boolean not null default false,
  created_at timestamptz not null default now(),
  check (clerk_user_id is null or clerk_user_id ~ '^user_[A-Za-z0-9]+$')
);
alter table public.curbside_accounts enable row level security;
revoke all on public.curbside_accounts from public, anon, authenticated;
grant all on public.curbside_accounts to service_role;
insert into public.curbside_accounts(id, legacy) select id, true from auth.users;

-- A deleted identity must never be recreated by a request already in flight.
-- Retain only the opaque provider ID and cleanup timestamp, never email or car data.
create table public.curbside_deleted_identities (
  clerk_user_id text primary key check (clerk_user_id ~ '^user_[A-Za-z0-9]+$'),
  deleted_at timestamptz not null default now()
);
alter table public.curbside_deleted_identities enable row level security;
revoke all on public.curbside_deleted_identities from public, anon, authenticated;
grant all on public.curbside_deleted_identities to service_role;

create function curbside_private.guard_clerk_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.clerk_user_id is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.clerk_user_id,817462));
  if exists(select 1 from public.curbside_deleted_identities where clerk_user_id=new.clerk_user_id) then
    raise exception 'This Clerk identity has been deleted.' using errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function curbside_private.guard_clerk_identity() from public, anon, authenticated;
grant execute on function curbside_private.guard_clerk_identity() to service_role;
create trigger curbside_guard_clerk_identity before insert or update of clerk_user_id
on public.curbside_accounts for each row execute function curbside_private.guard_clerk_identity();

-- The same transaction lock serializes deletion with first-login mapping/binding.
-- A mapping committed first is removed; a later mapping sees the tombstone.
create function public.curbside_delete_clerk_account(clerk_id text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if clerk_id is null or clerk_id !~ '^user_[A-Za-z0-9]+$' then
    raise exception 'Invalid Clerk identity.' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(clerk_id,817462));
  insert into public.curbside_deleted_identities(clerk_user_id) values(clerk_id)
    on conflict(clerk_user_id) do nothing;
  delete from public.curbside_accounts where clerk_user_id=clerk_id;
end $$;
revoke all on function public.curbside_delete_clerk_account(text) from public, anon, authenticated;
grant execute on function public.curbside_delete_clerk_account(text) to service_role;
comment on table public.curbside_deleted_identities is 'Minimal deletion tombstones prevent in-flight requests from resurrecting a deleted Clerk account.';

alter table public.curbside_vehicles drop constraint curbside_vehicles_user_id_fkey;
alter table public.curbside_terms_acceptances drop constraint curbside_terms_acceptances_user_id_fkey;
alter table public.curbside_preferences drop constraint curbside_preferences_user_id_fkey;
alter table public.curbside_vehicles add constraint curbside_vehicles_user_id_fkey foreign key(user_id) references public.curbside_accounts(id) on delete cascade;
alter table public.curbside_terms_acceptances add constraint curbside_terms_acceptances_user_id_fkey foreign key(user_id) references public.curbside_accounts(id) on delete cascade;
alter table public.curbside_preferences add constraint curbside_preferences_user_id_fkey foreign key(user_id) references public.curbside_accounts(id) on delete cascade;

-- Account access moves behind Clerk-protected server routes. Retire old Supabase JWT access.
-- REVOKE ALL at table level does not revoke column grants; remove those explicitly too.
revoke all on public.curbside_vehicles, public.curbside_terms_acceptances,
  public.curbside_preferences, public.curbside_vehicle_snapshots from public, anon, authenticated;
do $$ declare t record; c record; begin
  for t in select table_name from information_schema.tables where table_schema='public'
    and table_name in ('curbside_vehicles','curbside_terms_acceptances','curbside_preferences','curbside_vehicle_snapshots') loop
    for c in select column_name from information_schema.columns where table_schema='public' and table_name=t.table_name loop
      execute format('revoke all (%I) on public.%I from public, anon, authenticated', c.column_name, t.table_name);
    end loop;
  end loop;
end $$;
grant all on public.curbside_vehicles, public.curbside_terms_acceptances,
  public.curbside_preferences, public.curbside_vehicle_snapshots to service_role;
drop function if exists public.curbside_can_delete_account(uuid,uuid);
comment on table public.curbside_accounts is 'Service-only Clerk identity mapping; legacy UUIDs retain existing cars, preferences and consent history.';
commit;
