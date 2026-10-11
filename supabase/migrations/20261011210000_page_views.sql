begin;
-- First-party page counts: hourly totals with no visitor identifiers, plus
-- per-account counts for confirmed signed-in customers. No URLs, devices,
-- IP addresses or referrers are stored.
create table public.ticketsafe_page_views (
  hour timestamptz not null,
  page text not null check (page in ('garage','search','map','timeline','account','legal')),
  views integer not null default 0 check (views>=0),
  signed_in_views integer not null default 0 check (signed_in_views>=0),
  primary key(hour,page)
);
create table public.ticketsafe_customer_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  page_views bigint not null default 0 check (page_views>=0),
  first_view_at timestamptz not null default now(),
  last_view_at timestamptz not null default now(),
  last_page text not null
);
create table public.ticketsafe_customer_activity_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views>=0),
  primary key(user_id,day)
);
create index ticketsafe_customer_activity_daily_day on public.ticketsafe_customer_activity_daily(day);
create index ticketsafe_customer_activity_recent on public.ticketsafe_customer_activity(last_view_at desc);
alter table public.ticketsafe_page_views enable row level security;
alter table public.ticketsafe_customer_activity enable row level security;
alter table public.ticketsafe_customer_activity_daily enable row level security;
revoke all on public.ticketsafe_page_views,public.ticketsafe_customer_activity,public.ticketsafe_customer_activity_daily
  from public,anon,authenticated;
grant all on public.ticketsafe_page_views,public.ticketsafe_customer_activity,public.ticketsafe_customer_activity_daily
  to service_role;
comment on table public.ticketsafe_page_views is 'Hourly page totals without visitor identifiers; kept 25 months.';
comment on table public.ticketsafe_customer_activity_daily is 'Per-account daily page counts; kept 90 days, removed with the account.';

create function public.ticketsafe_page_view(page_name text)
returns void language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); bucket timestamptz:=date_trunc('hour',now());
  today date:=(now() at time zone 'America/New_York')::date; signed boolean:=false;
begin
  if page_name is null or page_name not in('garage','search','map','timeline','account','legal') then return; end if;
  if uid is not null then
    signed:=exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now()));
  end if;
  -- Bounded abuse: a per-page hourly ceiling and a per-account daily ceiling.
  if coalesce((select views from public.ticketsafe_page_views where hour=bucket and page=page_name),0)>=20000 then return; end if;
  if signed and coalesce((select views from public.ticketsafe_customer_activity_daily where user_id=uid and day=today),0)>=2000 then
    return;
  end if;
  insert into public.ticketsafe_page_views(hour,page,views,signed_in_views) values(bucket,page_name,1,case when signed then 1 else 0 end)
    on conflict(hour,page) do update set views=public.ticketsafe_page_views.views+1,
      signed_in_views=public.ticketsafe_page_views.signed_in_views+excluded.signed_in_views;
  if signed then
    insert into public.ticketsafe_customer_activity_daily(user_id,day,views) values(uid,today,1)
      on conflict(user_id,day) do update set views=public.ticketsafe_customer_activity_daily.views+1;
    insert into public.ticketsafe_customer_activity(user_id,page_views,last_page) values(uid,1,page_name)
      on conflict(user_id) do update set page_views=public.ticketsafe_customer_activity.page_views+1,
        last_view_at=now(),last_page=excluded.last_page;
  end if;
end $$;
revoke all on function public.ticketsafe_page_view(text) from public;
grant execute on function public.ticketsafe_page_view(text) to anon,authenticated,service_role;

create function ticketsafe_private.traffic_request(actor_id uuid,session_id uuid,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  tz constant text:='America/New_York'; span text:=coalesce(input->>'range','week');
  unit text; step interval; n integer; finish_local timestamp; start_local timestamp;
  start_at timestamptz; previous_at timestamptz; result jsonb;
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=session_id and s.user_id=actor_id and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Your session has ended. Sign in again.' using errcode='28000';
  end if;
  if not exists(select 1 from public.ticketsafe_crm_roles where user_id=actor_id) then
    raise exception 'Administrator access is required.' using errcode='42501';
  end if;
  delete from public.ticketsafe_page_views where hour<now()-interval '25 months';
  delete from public.ticketsafe_customer_activity_daily where day<current_date-90;
  case span
    when 'day' then unit:='hour'; step:=interval '1 hour'; n:=24;
    when 'week' then unit:='day'; step:=interval '1 day'; n:=7;
    when 'month' then unit:='day'; step:=interval '1 day'; n:=30;
    when 'year' then unit:='month'; step:=interval '1 month'; n:=12;
    else raise exception 'Choose day, week, month or year.';
  end case;
  finish_local:=date_trunc(unit,now() at time zone tz);
  start_local:=finish_local-step*(n-1);
  start_at:=start_local at time zone tz;
  previous_at:=(start_local-step*n) at time zone tz;
  with series as (select generate_series(start_local,finish_local,step) b),
  totals as (
    select date_trunc(unit,hour at time zone tz) b,sum(views)::bigint v,sum(signed_in_views)::bigint s
    from public.ticketsafe_page_views where hour>=start_at group by 1)
  select jsonb_build_object(
    'range',span,'unit',unit,'timeZone',tz,
    'buckets',coalesce((select jsonb_agg(jsonb_build_object('start',to_char(series.b,'YYYY-MM-DD"T"HH24:MI:SS'),
      'views',coalesce(t.v,0),'signedIn',coalesce(t.s,0)) order by series.b)
      from series left join totals t on t.b=series.b),'[]'),
    'total',coalesce((select sum(views) from public.ticketsafe_page_views where hour>=start_at),0),
    'signedIn',coalesce((select sum(signed_in_views) from public.ticketsafe_page_views where hour>=start_at),0),
    'previous',coalesce((select sum(views) from public.ticketsafe_page_views where hour>=previous_at and hour<start_at),0),
    'pages',coalesce((select jsonb_agg(jsonb_build_object('page',page,'views',v) order by v desc,page)
      from (select page,sum(views)::bigint v from public.ticketsafe_page_views where hour>=start_at group by page) p),'[]'),
    'activeCustomers',(select count(*) from public.ticketsafe_customer_activity where last_view_at>=start_at)
  ) into result;
  return result;
end $$;
revoke all on function ticketsafe_private.traffic_request(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function ticketsafe_private.traffic_request(uuid,uuid,jsonb) to service_role;

create or replace function public.ticketsafe_crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; removed public.ticketsafe_support_messages; used integer; target uuid;
begin
  if action in('support_delivery_prepare','support_delivery_claim','support_delivery_result') then
    return ticketsafe_private.support_delivery_request(actor_id,session_id,action,input);
  end if;
  if action in('support_messages','audit','delivery_review','delivery_resolve','templates','template_save','template_delete') then
    return ticketsafe_private.portal_tools_request(actor_id,session_id,action,input);
  end if;
  if action in('threads','thread','thread_status','thread_delete','thread_reply_prepare','thread_reply_claim','thread_reply_result') then
    return ticketsafe_private.conversation_request(actor_id,session_id,action,input);
  end if;
  if action='traffic' then
    return ticketsafe_private.traffic_request(actor_id,session_id,input);
  end if;
  if action='support_delete' then
    if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
      where s.id=session_id and s.user_id=actor_id and (s.not_after is null or s.not_after>now())
        and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
        and (u.banned_until is null or u.banned_until<now())) then
      raise exception 'Your session has ended. Sign in again.' using errcode='28000';
    end if;
    if not exists(select 1 from public.ticketsafe_crm_roles where user_id=actor_id and role in('master','admin')) then
      raise exception 'Only admins can delete support messages.' using errcode='42501';
    end if;
    if coalesce(input->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Message not found.';
    end if;
    select * into removed from public.ticketsafe_support_messages where id=(input->>'messageId')::uuid for update;
    if not found then raise exception 'Message not found.'; end if;
    delete from public.ticketsafe_crm_threads where support_message_id=removed.id;
  end if;
  if action='email_claim' then
    insert into public.ticketsafe_crm_budget(day) values(current_date) on conflict do nothing;
    select attempts into used from public.ticketsafe_crm_budget where day=current_date for update;
    if used>=80 then return jsonb_build_object('deliveries','[]'::jsonb); end if;
  end if;
  result:=ticketsafe_private.portal_request(actor_id,session_id,action,input);
  if action='support_delete' then
    delete from public.ticketsafe_crm_campaigns where support_context->>'messageId'=input->>'messageId';
    insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail)
      values(actor_id,'support_delete',removed.user_id,jsonb_build_object('messageId',removed.id,'kind',removed.kind,
        'createdAt',removed.created_at,'replied',removed.replied_at is not null));
  end if;
  if action in('emails','email_progress') then
    result:=result||jsonb_build_object('budgetUsed',coalesce((select attempts from public.ticketsafe_crm_budget where day=current_date),0),
      'campaignLimit',80,'dailyLimit',100);
  end if;
  if action='users' and jsonb_typeof(result->'users')='array' then
    result:=jsonb_set(result,'{users}',coalesce((
      select jsonb_agg(e.u||jsonb_build_object('page_views',coalesce(a.page_views,0),'last_view_at',a.last_view_at) order by e.ord)
      from jsonb_array_elements(result->'users') with ordinality e(u,ord)
      left join public.ticketsafe_customer_activity a on a.user_id=(e.u->>'id')::uuid),'[]'));
  end if;
  if action='user' then
    target:=(result->'user'->>'id')::uuid;
    result:=result||jsonb_build_object('activity',jsonb_build_object(
      'pageViews',coalesce((select page_views from public.ticketsafe_customer_activity where user_id=target),0),
      'views7d',coalesce((select sum(views) from public.ticketsafe_customer_activity_daily
        where user_id=target and day>(now() at time zone 'America/New_York')::date-7),0),
      'views30d',coalesce((select sum(views) from public.ticketsafe_customer_activity_daily
        where user_id=target and day>(now() at time zone 'America/New_York')::date-30),0),
      'firstViewAt',(select first_view_at from public.ticketsafe_customer_activity where user_id=target),
      'lastViewAt',(select last_view_at from public.ticketsafe_customer_activity where user_id=target),
      'lastPage',(select last_page from public.ticketsafe_customer_activity where user_id=target),
      'lastActiveAt',(select greatest(a.last_view_at,p.last_seen_at) from (select 1) x
        left join public.ticketsafe_customer_activity a on a.user_id=target
        left join public.ticketsafe_crm_presence p on p.user_id=target),
      'activeSessions',(select count(*) from auth.sessions s where s.user_id=target and (s.not_after is null or s.not_after>now())),
      'daily',coalesce((select jsonb_agg(jsonb_build_object('day',d::date,'views',coalesce(v.views,0)) order by d)
        from generate_series((now() at time zone 'America/New_York')::date-29,(now() at time zone 'America/New_York')::date,interval '1 day') d
        left join public.ticketsafe_customer_activity_daily v on v.user_id=target and v.day=d::date),'[]')));
  end if;
  return result;
end $$;
commit;
