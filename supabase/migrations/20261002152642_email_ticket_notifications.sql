begin;
-- Service invoker RPCs need explicit source reads, regardless of host defaults.
grant select on public.curbside_vehicles,public.curbside_terms_acceptances,public.curbside_preferences to service_role;

create table public.curbside_email_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  revision uuid not null default gen_random_uuid()
);
alter table public.curbside_email_settings enable row level security;
create policy "Read own email preferences" on public.curbside_email_settings for select to authenticated
  using(user_id=(select auth.uid()) and (select curbside_private.confirmed_email()));
create policy "Create own email preferences" on public.curbside_email_settings for insert to authenticated
  with check(user_id=(select auth.uid()) and (not enabled or (
    (select curbside_private.confirmed_email()) and exists(select 1 from public.curbside_terms_acceptances t
      where t.user_id=(select auth.uid()) and t.version='2026-09-27.1'))));
create policy "Update own email preferences" on public.curbside_email_settings for update to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and (not enabled or (
    (select curbside_private.confirmed_email()) and exists(select 1 from public.curbside_terms_acceptances t
      where t.user_id=(select auth.uid()) and t.version='2026-09-27.1'))));
revoke all on public.curbside_email_settings from public,anon,authenticated;
grant select(user_id,enabled,updated_at),insert(user_id,enabled),update(enabled)
  on public.curbside_email_settings to authenticated;
grant all on public.curbside_email_settings to service_role;

create table public.curbside_email_baselines (
  vehicle_id uuid primary key references public.curbside_vehicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ready boolean not null default false
);
create table public.curbside_email_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  summons text not null check(summons ~ '^[0-9]{8,12}$'),
  primary key(user_id,summons)
);
create table public.curbside_email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setting_revision uuid not null,
  delivery_day date not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check(status in('pending','sending','sent','cancelled','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease uuid,
  lease_until timestamptz,
  recipient text,
  language text,
  ticket_count integer,
  provider_id text,
  sent_at timestamptz,
  unique(user_id,delivery_day)
);
create table public.curbside_email_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  summons text not null,
  vehicle_id uuid not null references public.curbside_vehicles(id) on delete cascade,
  outbox_id uuid references public.curbside_email_outbox(id) on delete cascade,
  primary key(user_id,summons)
);
create table public.curbside_email_budget (
  day date primary key,
  attempts integer not null default 0 check(attempts between 0 and 100)
);
alter table public.curbside_email_baselines enable row level security;
alter table public.curbside_email_seen enable row level security;
alter table public.curbside_email_events enable row level security;
alter table public.curbside_email_outbox enable row level security;
alter table public.curbside_email_budget enable row level security;
revoke all on public.curbside_email_baselines,public.curbside_email_seen,public.curbside_email_events,
  public.curbside_email_outbox,public.curbside_email_budget from public,anon,authenticated;
grant all on public.curbside_email_baselines,public.curbside_email_seen,public.curbside_email_events,
  public.curbside_email_outbox,public.curbside_email_budget to service_role;
create index curbside_email_due on public.curbside_email_outbox(next_attempt_at) where status in('pending','sending');
create index curbside_email_event_job on public.curbside_email_events(outbox_id);

-- Re-enabling always establishes fresh baselines. Old unsubscribe links cannot
-- undo a later, deliberate opt-in, and customers cannot forge the revision/time.
create function curbside_private.email_setting_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,984314));
  if tg_op='INSERT' or new.enabled is distinct from old.enabled then
    new.revision:=gen_random_uuid();
    new.enabled_at:=case when new.enabled then now() else null end;
    update public.curbside_email_outbox set status='cancelled',lease=null,lease_until=null,recipient=null
      where user_id=new.user_id and status in('pending','sending');
    delete from public.curbside_email_baselines where user_id=new.user_id;
    delete from public.curbside_email_seen where user_id=new.user_id;
    delete from public.curbside_email_events where user_id=new.user_id;
  end if;
  new.updated_at:=now();
  return new;
end $$;
revoke all on function curbside_private.email_setting_change() from public,anon,authenticated;
create trigger curbside_email_setting_change before insert or update on public.curbside_email_settings
  for each row execute function curbside_private.email_setting_change();

create function public.curbside_snapshot_needs_email_baseline(snapshot_key text)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.curbside_vehicles v
    join public.curbside_vehicle_snapshots s on s.key=snapshot_key and s.plate=v.plate and s.state=v.state and s.plate_type=v.plate_type
    join public.curbside_email_settings p on p.user_id=v.user_id and p.enabled
    join auth.users u on u.id=v.user_id and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false
    where not exists(select 1 from public.curbside_email_baselines b where b.vehicle_id=v.id and b.ready)
      and exists(select 1 from public.curbside_terms_acceptances t where t.user_id=v.user_id and t.version='2026-09-27.1'));
$$;

create function public.curbside_finish_snapshot_with_email(snapshot_key text,lease_id uuid,result jsonb,full_history boolean,observation jsonb)
returns boolean language plpgsql set search_path='' as $$
declare
  v record; pref record; ids text[]; fresh text[]; seeded boolean; job uuid; day date;
begin
  -- Finishing and recording discoveries share one transaction. Stale leases,
  -- failures and partial city checks cannot manufacture notification events.
  if not public.curbside_finish_snapshot(snapshot_key,lease_id,result,full_history) then return false; end if;
  if observation is null or observation->>'complete' is distinct from 'true'
    or observation->>'unavailable' is distinct from 'false'
    or jsonb_typeof(observation->'tickets') is distinct from 'array'
    or jsonb_typeof(observation->'sources') is distinct from 'array'
    or jsonb_array_length(observation->'sources')=0
    or exists(select 1 from jsonb_array_elements(observation->'sources') s
      where s->>'ok' is distinct from 'true' or s->>'truncated' is distinct from 'false') then return true; end if;
  select coalesce(array_agg(distinct t->>'id'),'{}'::text[]) into ids
    from jsonb_array_elements(observation->'tickets') t where t->>'id' ~ '^[0-9]{8,12}$';
  for v in select c.id,c.user_id from public.curbside_vehicles c
    join public.curbside_vehicle_snapshots s on s.key=snapshot_key and c.plate=s.plate and c.state=s.state and c.plate_type=s.plate_type
    join auth.users u on u.id=c.user_id and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false
    join public.curbside_email_settings p on p.user_id=c.user_id and p.enabled
    where exists(select 1 from public.curbside_terms_acceptances t where t.user_id=c.user_id and t.version='2026-09-27.1')
    order by c.user_id,c.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v.user_id::text,984314));
    select * into pref from public.curbside_email_settings where user_id=v.user_id and enabled;
    if not found then continue; end if;
    select ready into seeded from public.curbside_email_baselines where vehicle_id=v.id;
    if not found or not seeded then
      -- Wait for one complete deep-history fetch for each newly watched car.
      -- Backfilled historical summons on its first full fetch are not new alerts.
      if not full_history then continue; end if;
      insert into public.curbside_email_baselines(vehicle_id,user_id,ready) values(v.id,v.user_id,true)
        on conflict(vehicle_id) do update set ready=true;
      insert into public.curbside_email_seen(user_id,summons) select v.user_id,unnest(ids) on conflict do nothing;
      continue;
    end if;
    with discovered as (
      insert into public.curbside_email_seen(user_id,summons) select v.user_id,unnest(ids)
      on conflict do nothing returning summons
    ) select coalesce(array_agg(summons),'{}'::text[]) into fresh from discovered;
    if cardinality(fresh)=0 then continue; end if;
    day:=(now() at time zone 'UTC')::date;
    -- At most one daily summary per profile. An already-frozen attempt keeps
    -- its exact body for provider idempotency; later discoveries wait tomorrow.
    if exists(select 1 from public.curbside_email_outbox o where o.user_id=v.user_id and o.delivery_day=day
      and (o.attempts>0 or o.status<>'pending' or o.setting_revision<>pref.revision)) then day:=day+1; end if;
    insert into public.curbside_email_outbox(user_id,setting_revision,delivery_day,next_attempt_at)
      values(v.user_id,pref.revision,day,case when day=(now() at time zone 'UTC')::date then now()
        else (day+time '13:00') at time zone 'UTC' end) on conflict(user_id,delivery_day) do nothing;
    select id into job from public.curbside_email_outbox where user_id=v.user_id and delivery_day=day
      and status='pending' and attempts=0 and setting_revision=pref.revision;
    if job is not null then
      insert into public.curbside_email_events(user_id,summons,vehicle_id,outbox_id)
        select v.user_id,unnest(fresh),v.id,job on conflict do nothing;
    end if;
  end loop;
  return true;
end $$;

create function public.curbside_claim_email_jobs()
returns setof public.curbside_email_outbox language plpgsql set search_path='' as $$
declare o public.curbside_email_outbox; n integer; budget integer; today date;
begin
  today:=(now() at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(984315);
  -- Remove successful/terminal metadata after 30 days; no ticket details or
  -- addresses are kept in delivered rows. Seen IDs remain until opt-out/delete.
  delete from public.curbside_email_outbox where created_at<now()-interval '30 days' and status in('sent','cancelled','failed');
  delete from public.curbside_email_budget where day<today-30;
  update public.curbside_email_outbox set status='cancelled',lease=null,lease_until=null,recipient=null
    where status in('pending','sending') and (first_attempt_at<now()-interval '22 hours' or created_at<now()-interval '7 days' or attempts>=5
      or not exists(select 1 from public.curbside_email_settings p join auth.users u on u.id=p.user_id
        where p.user_id=curbside_email_outbox.user_id and p.enabled and p.revision=setting_revision
          and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false
          and exists(select 1 from public.curbside_terms_acceptances t where t.user_id=u.id and t.version='2026-09-27.1'))
      or not exists(select 1 from public.curbside_email_events e where e.outbox_id=curbside_email_outbox.id));
  insert into public.curbside_email_budget(day) values(today) on conflict do nothing;
  select attempts into budget from public.curbside_email_budget where day=today;
  for o in select * from public.curbside_email_outbox
    where status in('pending','sending') and next_attempt_at<=now()
      and delivery_day<=today and (lease_until is null or lease_until<now())
    order by next_attempt_at,id for update skip locked limit least(10,100-budget)
  loop
    select count(*) into n from public.curbside_email_events where outbox_id=o.id;
    update public.curbside_email_outbox set status='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',
      first_attempt_at=coalesce(first_attempt_at,now()),ticket_count=coalesce(ticket_count,least(n,10000)),
      recipient=coalesce(recipient,(select email from auth.users where id=o.user_id)),
      language=coalesce(language,(select case when language='zh' then 'zh' else 'en' end from public.curbside_preferences where user_id=o.user_id),'en')
      where id=o.id returning * into o;
    update public.curbside_email_budget set attempts=attempts+1 where day=today;
    return next o;
  end loop;
end $$;

-- Recheck immediately before external delivery. Opt-out, removed cars, email
-- changes, expired leases and deleted/unconfirmed profiles suppress the send.
create function public.curbside_email_job_is_current(job_id uuid,lease_id uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.curbside_email_outbox o
    join public.curbside_email_settings p on p.user_id=o.user_id and p.enabled and p.revision=o.setting_revision
    join auth.users u on u.id=o.user_id and u.email=o.recipient and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false
    where o.id=job_id and o.lease=lease_id and o.status='sending' and o.lease_until>now()
      and o.first_attempt_at>now()-interval '22 hours'
      and exists(select 1 from public.curbside_terms_acceptances t where t.user_id=o.user_id and t.version='2026-09-27.1')
      and (select count(*) from public.curbside_email_events e where e.outbox_id=o.id)=o.ticket_count);
$$;

create function public.curbside_finish_email_job(job_id uuid,lease_id uuid,delivered boolean,provider_id text default null,retryable boolean default true)
returns boolean language plpgsql set search_path='' as $$
declare n integer;
begin
  update public.curbside_email_outbox set
    status=case when delivered then 'sent' when not retryable or attempts>=5 then 'failed' else 'pending' end,
    provider_id=case when delivered then left(curbside_finish_email_job.provider_id,100) else null end,
    sent_at=case when delivered then now() else null end,
    next_attempt_at=now()+least(60,power(2,attempts)::integer)*interval '1 minute',
    recipient=case when delivered or not retryable or attempts>=5 then null else recipient end,
    lease=null,lease_until=null
    where id=job_id and lease=lease_id and status='sending';
  get diagnostics n=row_count;
  return n=1;
end $$;

create function public.curbside_unsubscribe_ticket_email(account_id uuid,setting_revision uuid)
returns void language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,984314));
  update public.curbside_email_settings set enabled=false
    where user_id=account_id and revision=setting_revision and enabled;
end $$;

revoke all on function public.curbside_snapshot_needs_email_baseline(text),public.curbside_finish_snapshot_with_email(text,uuid,jsonb,boolean,jsonb),
  public.curbside_claim_email_jobs(),public.curbside_email_job_is_current(uuid,uuid),
  public.curbside_finish_email_job(uuid,uuid,boolean,text,boolean),public.curbside_unsubscribe_ticket_email(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.curbside_snapshot_needs_email_baseline(text),public.curbside_finish_snapshot_with_email(text,uuid,jsonb,boolean,jsonb),
  public.curbside_claim_email_jobs(),public.curbside_email_job_is_current(uuid,uuid),
  public.curbside_finish_email_job(uuid,uuid,boolean,text,boolean),public.curbside_unsubscribe_ticket_email(uuid,uuid) to service_role;

comment on table public.curbside_email_settings is 'Explicit opt-in only: daily newly found ticket email to verified account email. SMS unavailable.';
comment on table public.curbside_email_outbox is 'Service-only bounded email outbox. No plates, locations, balances or ticket descriptions. Provider acceptance is not inbox delivery.';

-- Existing scheduler only: keep the same morning window and saved-car budget.
-- Run it for durable email retries too, without adding another recurring job.
-- Scheduler infrastructure (not available in PGlite).
select cron.alter_job(
  (select jobid from cron.job where jobname='curbside-saved-history-morning'),
  command:=$cron$
    select net.http_post(
      url:='https://wkuvihaiacfcqctwolqu.supabase.co/functions/v1/vehicle-snapshots',
      headers:=jsonb_build_object('Content-Type','application/json','x-curbside-cron',
        (select decrypted_secret from vault.decrypted_secrets where name='curbside_snapshot_cron')),
      body:='{"mode":"cron"}'::jsonb,timeout_milliseconds:=15000
    ) where exists(select 1 from public.curbside_vehicle_snapshots where next_check_at<=now() and (lease_until is null or lease_until<now()))
      or exists(select 1 from public.curbside_email_outbox where status in('pending','sending')
        and next_attempt_at<=now() and (lease_until is null or lease_until<now()));
  $cron$
);
commit;
