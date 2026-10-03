begin;
-- Preserve daily spending caps, opt-out checks, leases and frozen messages.
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
      -- Wait only for this profile's cars, and never longer than ten minutes.
      -- Frozen retries must not wait for another vehicle scan.
      and (first_attempt_at is not null or created_at<=now()-interval '10 minutes'
        or not exists(select 1 from public.curbside_vehicles v
          join public.curbside_vehicle_snapshots s
            on s.plate=v.plate and s.state=v.state and s.plate_type=v.plate_type
          where v.user_id=curbside_email_outbox.user_id and s.next_check_at<=now()))
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
commit;
