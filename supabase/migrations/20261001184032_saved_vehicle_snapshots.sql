begin;

-- A subscription is private and unique per customer; city history is shared.
create table public.curbside_vehicle_snapshots (
  key text primary key,
  plate text not null,
  state text not null,
  plate_type text not null default '',
  payload jsonb,
  checked_at timestamptz,
  full_checked_at timestamptz,
  last_attempt_at timestamptz,
  next_check_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','checking','ready','partial','retry')),
  lease uuid,
  lease_until timestamptz,
  unique (plate,state,plate_type)
);
alter table public.curbside_vehicle_snapshots enable row level security;
create index curbside_snapshot_due on public.curbside_vehicle_snapshots(next_check_at);
create index curbside_vehicle_identity on public.curbside_vehicles(plate,state,plate_type);
create policy "Read histories of own saved cars" on public.curbside_vehicle_snapshots
for select to authenticated using (
  (select curbside_private.confirmed_email()) and exists (
    select 1 from public.curbside_vehicles v where v.user_id=(select auth.uid())
    and v.plate=curbside_vehicle_snapshots.plate and v.state=curbside_vehicle_snapshots.state
    and v.plate_type=curbside_vehicle_snapshots.plate_type
  )
);
revoke all on public.curbside_vehicle_snapshots from public,anon,authenticated;
grant select(key,plate,state,plate_type,payload,checked_at,last_attempt_at,next_check_at,status)
on public.curbside_vehicle_snapshots to authenticated;
grant all on public.curbside_vehicle_snapshots to service_role;

create function curbside_private.subscribe_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text;
begin
  k:=new.state||':'||new.plate||':'||coalesce(nullif(new.plate_type,''),'*');
  perform pg_advisory_xact_lock(64289031);
  if not exists(select 1 from public.curbside_vehicle_snapshots where key=k)
    and (select count(*) from public.curbside_vehicle_snapshots)>=500 then
    raise exception 'Saved vehicle capacity reached. Please contact support.' using errcode='P0001';
  end if;
  insert into public.curbside_vehicle_snapshots(key,plate,state,plate_type)
  values(k,new.plate,new.state,new.plate_type) on conflict(key) do nothing;
  return new;
end $$;
create function curbside_private.unsubscribe_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(64289031);
  if not exists(select 1 from public.curbside_vehicles v
    where v.plate=old.plate and v.state=old.state and v.plate_type=old.plate_type) then
    delete from public.curbside_vehicle_snapshots
    where plate=old.plate and state=old.state and plate_type=old.plate_type;
  end if;
  return old;
end $$;
revoke all on function curbside_private.subscribe_snapshot(),curbside_private.unsubscribe_snapshot() from public,anon,authenticated;
create trigger curbside_snapshot_subscribe after insert on public.curbside_vehicles
for each row execute function curbside_private.subscribe_snapshot();
create trigger curbside_snapshot_unsubscribe after delete on public.curbside_vehicles
for each row execute function curbside_private.unsubscribe_snapshot();
insert into public.curbside_vehicle_snapshots(key,plate,state,plate_type)
select distinct state||':'||plate||':'||coalesce(nullif(plate_type,''),'*'),plate,state,plate_type
from public.curbside_vehicles on conflict(key) do nothing;

-- These invoker RPCs are service-only; clients cannot write source history or leases.
create function public.curbside_claim_snapshots(target_key text default null)
returns setof public.curbside_vehicle_snapshots language sql set search_path='' as $$
  with due as (
    select key from public.curbside_vehicle_snapshots
    where next_check_at<=now() and (lease_until is null or lease_until<now())
      and (target_key is null or key=target_key)
    order by next_check_at for update skip locked limit 3
  ) update public.curbside_vehicle_snapshots s
    set lease=gen_random_uuid(),lease_until=now()+interval '4 minutes',
        status='checking',last_attempt_at=now()
    from due where s.key=due.key returning s.*;
$$;
create function public.curbside_finish_snapshot(snapshot_key text,lease_id uuid,result jsonb,full_history boolean)
returns boolean language plpgsql set search_path='' as $$
declare changed integer;
begin
  update public.curbside_vehicle_snapshots set
    payload=case when result is null then payload else result end,
    checked_at=case when result is null then checked_at else now() end,
    full_checked_at=case when result is not null and full_history then now() else full_checked_at end,
    status=case when result is null then 'retry' when (result->>'complete')::boolean then 'ready' else 'partial' end,
    next_check_at=case when result is null then now()+interval '30 minutes'
      else (date_trunc('day',now() at time zone 'UTC')+interval '1 day 13 hours') at time zone 'UTC' end,
    lease=null,lease_until=null
    where key=snapshot_key and lease=lease_id;
  get diagnostics changed=row_count;
  return changed=1;
end $$;
revoke all on function public.curbside_claim_snapshots(text),public.curbside_finish_snapshot(text,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.curbside_claim_snapshots(text),public.curbside_finish_snapshot(text,uuid,jsonb,boolean) to service_role;

-- Dedicated cron credential stays in Vault, never in frontend or Vercel variables.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'curbside_snapshot_cron',
  'Credential for the authenticated Curbside history scheduler');
create function curbside_private.verify_snapshot_cron(candidate text) returns boolean
language sql security definer set search_path='' as $$
  select coalesce(length(candidate)=64 and exists (
    select 1 from vault.decrypted_secrets where name='curbside_snapshot_cron'
      and extensions.digest(decrypted_secret,'sha256')=extensions.digest(candidate,'sha256')
  ),false);
$$;
revoke all on function curbside_private.verify_snapshot_cron(text) from public,anon,authenticated;
grant usage on schema curbside_private to service_role;
grant execute on function curbside_private.verify_snapshot_cron(text) to service_role;
create function public.curbside_verify_snapshot_cron(candidate text) returns boolean
language sql set search_path='' as $$ select curbside_private.verify_snapshot_cron(candidate) $$;
revoke all on function public.curbside_verify_snapshot_cron(text) from public,anon,authenticated;
grant execute on function public.curbside_verify_snapshot_cron(text) to service_role;
select cron.schedule('curbside-saved-history-morning','* 13-15 * * *', $cron$
  select net.http_post(
    url:='https://wkuvihaiacfcqctwolqu.supabase.co/functions/v1/vehicle-snapshots',
    headers:=jsonb_build_object('Content-Type','application/json','x-curbside-cron',
      (select decrypted_secret from vault.decrypted_secrets where name='curbside_snapshot_cron')),
    body:='{"mode":"cron"}'::jsonb,timeout_milliseconds:=1000
  ) where exists(select 1 from public.curbside_vehicle_snapshots
    where next_check_at<=now() and (lease_until is null or lease_until<now()));
$cron$);
comment on table public.curbside_vehicles is 'Private per-customer car details. Shared public-city histories refresh daily; saving does not enable reminder delivery.';
comment on table public.curbside_vehicle_snapshots is 'Public city records only, shared by plate/state/type; removed after the last customer removes this identity. Never store customer annotations here.';
commit;
