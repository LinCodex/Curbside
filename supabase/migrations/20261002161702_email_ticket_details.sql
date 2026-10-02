begin;
alter table public.curbside_email_events add column details jsonb not null default '{}'::jsonb;
alter table public.curbside_email_outbox add column ticket_details jsonb, add column email_content jsonb;
create or replace function public.curbside_finish_snapshot_with_email(snapshot_key text,lease_id uuid,result jsonb,full_history boolean,observation jsonb)
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
  for v in select c.id,c.user_id,c.plate,c.state,c.nickname from public.curbside_vehicles c
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
      insert into public.curbside_email_events(user_id,summons,vehicle_id,outbox_id,details)
        select v.user_id,t->>'id',v.id,job,jsonb_build_object(
          'id',t->>'id','plate',v.plate,'state',v.state,'nickname',v.nickname,
          'description',left(t->>'description',200),'issued',t->>'issued','time',left(t->>'time',30),
          'due',t->'due','status',left(t->>'status',80),'location',t->'location')
        from jsonb_array_elements(observation->'tickets') t where t->>'id'=any(fresh)
        on conflict do nothing;
    end if;
  end loop;
  return true;
end $$;
create or replace function public.curbside_claim_email_jobs()
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
      ticket_details=coalesce(ticket_details,(select coalesce(jsonb_agg(e.details order by e.summons),'[]'::jsonb)
        from (select summons,details from public.curbside_email_events where outbox_id=o.id order by summons limit 20) e)),
      first_attempt_at=coalesce(first_attempt_at,now()),ticket_count=coalesce(ticket_count,least(n,10000)),
      recipient=coalesce(recipient,(select email from auth.users where id=o.user_id)),
      language=coalesce(language,(select case when language='zh' then 'zh' else 'en' end from public.curbside_preferences where user_id=o.user_id),'en')
      where id=o.id returning * into o;
    update public.curbside_email_budget set attempts=attempts+1 where day=today;
    return next o;
  end loop;
end $$;
create or replace function public.curbside_finish_email_job(job_id uuid,lease_id uuid,delivered boolean,provider_id text default null,retryable boolean default true)
returns boolean language plpgsql set search_path='' as $$
declare n integer;
begin
  update public.curbside_email_outbox set
    status=case when delivered then 'sent' when not retryable or attempts>=5 then 'failed' else 'pending' end,
    provider_id=case when delivered then left(curbside_finish_email_job.provider_id,100) else null end,
    sent_at=case when delivered then now() else null end,
    next_attempt_at=now()+least(60,power(2,attempts)::integer)*interval '1 minute',
    email_content=case when delivered or not retryable or attempts>=5 then null else email_content end,
    ticket_details=case when delivered or not retryable or attempts>=5 then null else ticket_details end,
    recipient=case when delivered or not retryable or attempts>=5 then null else recipient end,
    lease=null,lease_until=null
    where id=job_id and lease=lease_id and status='sending';
  get diagnostics n=row_count;
  return n=1;
end $$;
create function public.curbside_freeze_email_content(job_id uuid,lease_id uuid,content jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare frozen jsonb;
begin
  if content is null or jsonb_typeof(content)<>'object' or octet_length(content::text)>300000 then
    raise exception 'Invalid email content' using errcode='22023';
  end if;
  update public.curbside_email_outbox set email_content=coalesce(email_content,content)
    where id=job_id and lease=lease_id and status='sending' and lease_until>now()
    returning email_content into frozen;
  return frozen;
end $$;
revoke all on function public.curbside_freeze_email_content(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.curbside_freeze_email_content(uuid,uuid,jsonb) to service_role;
comment on column public.curbside_email_events.details is 'Saved-vehicle new ticket details only. Private, opted-in email payload; terminal outbox cleanup removes events after 30 days.';
comment on column public.curbside_email_outbox.email_content is 'Frozen branded message and attached map for safe provider retries. Cleared when delivery is accepted or fails permanently.';
commit;
