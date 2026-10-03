begin;

create table public.ticketsafe_crm_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('master','admin','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ticketsafe_crm_one_master on public.ticketsafe_crm_roles(role) where role='master';
-- Resolve the verified account once. Future access is tied to its immutable UUID,
-- never to a client claim, editable metadata or a newly registered matching email.
insert into public.ticketsafe_crm_roles(user_id,role)
select id,'master' from auth.users where lower(email)='ylin20001@gmail.com'
  and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
do $$ begin
  if not exists(select 1 from public.ticketsafe_crm_roles where role='master') then
    raise exception 'Verified master administrator account is missing; no CRM access was granted.';
  end if;
end $$;

create table public.ticketsafe_crm_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notes text not null default '' check(length(notes)<=10000),
  tags text[] not null default '{}' check(cardinality(tags)<=12),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create table public.ticketsafe_crm_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create index ticketsafe_crm_presence_time on public.ticketsafe_crm_presence(last_seen_at);
create table public.ticketsafe_announcement_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
create table public.ticketsafe_crm_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index ticketsafe_crm_audit_time on public.ticketsafe_crm_audit(created_at);
create table public.ticketsafe_crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  fingerprint text not null,
  kind text not null check(kind in('service','announcement','test')),
  subject text not null check(length(subject) between 1 and 160),
  message text not null check(length(message) between 1 and 10000),
  created_at timestamptz not null default now(),
  unique(actor_id,idempotency_key)
);
create index ticketsafe_crm_campaign_time on public.ticketsafe_crm_campaigns(created_at);
create table public.ticketsafe_crm_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ticketsafe_crm_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient text not null,
  consent_revision uuid,
  status text not null default 'pending' check(status in('pending','sending','sent','failed','cancelled')),
  provider_id text,
  sent_at timestamptz,
  unique(campaign_id,user_id)
);
create index ticketsafe_crm_delivery_due on public.ticketsafe_crm_deliveries(campaign_id,status);
create table public.ticketsafe_crm_budget (
  day date primary key,
  attempts integer not null default 0 check(attempts between 0 and 100)
);

alter table public.ticketsafe_crm_roles enable row level security;
alter table public.ticketsafe_crm_customers enable row level security;
alter table public.ticketsafe_crm_presence enable row level security;
alter table public.ticketsafe_announcement_settings enable row level security;
alter table public.ticketsafe_crm_audit enable row level security;
alter table public.ticketsafe_crm_campaigns enable row level security;
alter table public.ticketsafe_crm_deliveries enable row level security;
alter table public.ticketsafe_crm_budget enable row level security;
revoke all on public.ticketsafe_crm_roles,public.ticketsafe_crm_customers,public.ticketsafe_crm_presence,
  public.ticketsafe_announcement_settings,public.ticketsafe_crm_audit,public.ticketsafe_crm_campaigns,
  public.ticketsafe_crm_deliveries,public.ticketsafe_crm_budget from public,anon,authenticated;
grant all on public.ticketsafe_crm_roles,public.ticketsafe_crm_customers,public.ticketsafe_crm_presence,
  public.ticketsafe_announcement_settings,public.ticketsafe_crm_audit,public.ticketsafe_crm_campaigns,
  public.ticketsafe_crm_deliveries,public.ticketsafe_crm_budget to service_role;
grant usage,select on sequence public.ticketsafe_crm_audit_id_seq to service_role;

create schema if not exists ticketsafe_private;
revoke all on schema ticketsafe_private from public,anon,authenticated;
grant usage on schema ticketsafe_private to service_role;
create function ticketsafe_private.crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor_role text; target uuid; page_number integer; page_size integer; query_text text;
  rows_json jsonb; count_total integer; customer_json jsonb; campaign uuid;
  selected_role text; email_kind text; fingerprint text; existing_fingerprint text;
  tags_array text[]; item record; attempted integer;
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=session_id and s.user_id=actor_id and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Your session has ended. Sign in again.' using errcode='28000';
  end if;
  if action='presence' then
    insert into public.ticketsafe_crm_presence(user_id) values(actor_id)
      on conflict(user_id) do update set last_seen_at=now()
      where public.ticketsafe_crm_presence.last_seen_at<now()-interval '60 seconds';
    -- Bounded operational state, not a browsing history.
    delete from public.ticketsafe_crm_presence where last_seen_at<now()-interval '24 hours';
    return jsonb_build_object('ok',true);
  end if;
  if action in('announcement_preferences','announcement_preferences_save') then
    if action='announcement_preferences_save' then
      if input->>'expectedUserId' is distinct from actor_id::text then raise exception 'Your account changed. Reload before saving.'; end if;
      if jsonb_typeof(input->'enabled') is distinct from 'boolean' then raise exception 'Choose an email preference.'; end if;
      insert into public.ticketsafe_announcement_settings(user_id,enabled) values(actor_id,(input->>'enabled')::boolean)
      on conflict(user_id) do update set enabled=excluded.enabled,revision=gen_random_uuid(),updated_at=now();
    end if;
    return jsonb_build_object('enabled',coalesce((select enabled from public.ticketsafe_announcement_settings where user_id=actor_id),false));
  end if;
  select role into actor_role from public.ticketsafe_crm_roles where user_id=actor_id for share;
  if actor_role is null then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  -- No extra scheduler or billing service. Remove old operational records during
  -- ordinary guarded CRM activity; the public app does not run this cleanup.
  delete from public.ticketsafe_crm_campaigns where created_at<now()-interval '90 days';
  delete from public.ticketsafe_crm_audit where created_at<now()-interval '90 days';
  delete from public.ticketsafe_crm_budget where day<current_date-30;
  if action='me' then return jsonb_build_object('admin',jsonb_build_object('userId',actor_id,'email',(select email from auth.users where id=actor_id),'role',actor_role)); end if;
  if action='stats' then return jsonb_build_object(
    'users',(select count(*) from auth.users where not coalesce(is_anonymous,false)),
    'verifiedUsers',(select count(*) from auth.users where email_confirmed_at is not null and not coalesce(is_anonymous,false)),
    'savedVehicles',(select count(*) from public.curbside_vehicles),
    'ticketSubscribers',(select count(*) from public.curbside_email_settings where enabled),
    'announcementSubscribers',(select count(*) from public.ticketsafe_announcement_settings where enabled),
    'onlineUsers',(select count(*) from public.ticketsafe_crm_presence where last_seen_at>now()-interval '3 minutes'),
    'emailsSentToday',(select count(*) from public.ticketsafe_crm_deliveries where sent_at>=date_trunc('day',now()) and status='sent'),
    'pendingEmails',(select count(*) from public.ticketsafe_crm_deliveries where status in('pending','sending'))
  ); end if;
  page_number:=greatest(1,least(10000,coalesce((input->>'page')::integer,1)));
  page_size:=greatest(1,least(50,coalesce((input->>'pageSize')::integer,20)));
  if input ? 'userId' then target:=(input->>'userId')::uuid; end if;
  if action='users' then
    query_text:=left(coalesce(input->>'search',''),100);
    with matched as (
      select u.id,u.email,u.created_at,u.email_confirmed_at,u.last_sign_in_at,
        (select count(*) from public.curbside_vehicles v where v.user_id=u.id) vehicle_count,
        coalesce(e.enabled,false) ticket_emails,coalesce(a.enabled,false) announcement_emails,r.role,p.last_seen_at
      from auth.users u left join public.curbside_email_settings e on e.user_id=u.id
        left join public.ticketsafe_announcement_settings a on a.user_id=u.id
        left join public.ticketsafe_crm_roles r on r.user_id=u.id left join public.ticketsafe_crm_presence p on p.user_id=u.id
      where not coalesce(u.is_anonymous,false) and (query_text='' or position(lower(query_text) in lower(coalesce(u.email,'')))>0)
        and case coalesce(input->>'filter','all') when 'verified' then u.email_confirmed_at is not null
          when 'unverified' then u.email_confirmed_at is null when 'ticket_emails' then coalesce(e.enabled,false)
          when 'announcement_emails' then coalesce(a.enabled,false) else true end
    ), paged as(select * from matched order by created_at desc,id limit page_size offset (page_number-1)*page_size)
    select coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),(select count(*) from matched) into rows_json,count_total;
    return jsonb_build_object('users',rows_json,'total',count_total,'page',page_number,'pageSize',page_size);
  end if;
  if action='user' then
    select jsonb_build_object('id',id,'email',email,'created_at',created_at,'email_confirmed_at',email_confirmed_at,'last_sign_in_at',last_sign_in_at)
      into customer_json from auth.users where id=target and not coalesce(is_anonymous,false);
    if customer_json is null then raise exception 'Customer not found.'; end if;
    return jsonb_build_object('user',customer_json,
      'vehicles',coalesce((select jsonb_agg(to_jsonb(v)) from public.curbside_vehicles v where user_id=target),'[]'),
      'notes',coalesce((select notes from public.ticketsafe_crm_customers where user_id=target),''),
      'tags',coalesce((select to_jsonb(tags) from public.ticketsafe_crm_customers where user_id=target),'[]'),
      'ticketEmails',coalesce((select enabled from public.curbside_email_settings where user_id=target),false),
      'announcementEmails',coalesce((select enabled from public.ticketsafe_announcement_settings where user_id=target),false));
  end if;
  if action='notes_save' then
    if target is null or length(coalesce(input->>'notes',''))>10000 or jsonb_typeof(input->'tags') is distinct from 'array'
      or jsonb_array_length(input->'tags')>12 then raise exception 'Check the note and tags.'; end if;
    select coalesce(array_agg(distinct btrim(value)) filter(where btrim(value)<>''),'{}') into tags_array from jsonb_array_elements_text(input->'tags');
    if exists(select 1 from unnest(tags_array) t where length(t)>32) then raise exception 'Keep each tag under 32 characters.'; end if;
    insert into public.ticketsafe_crm_customers(user_id,notes,tags,updated_by) values(target,coalesce(input->>'notes',''),tags_array,actor_id)
      on conflict(user_id) do update set notes=excluded.notes,tags=excluded.tags,updated_by=actor_id,updated_at=now();
  elsif action='roles' then
    return jsonb_build_object('roles',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'email',u.email,'role',r.role,'created_at',r.created_at))
      from public.ticketsafe_crm_roles r join auth.users u on u.id=r.user_id),'[]'));
  elsif action in('role_set','role_remove') then
    if actor_role<>'master' then raise exception 'Only the master administrator can change access.' using errcode='42501'; end if;
    if exists(select 1 from public.ticketsafe_crm_roles where user_id=target and role='master') then raise exception 'Master access cannot be changed.'; end if;
    if action='role_set' then
      selected_role:=input->>'role';
      if selected_role not in('admin','support') or selected_role is null then raise exception 'Choose admin or support access.'; end if;
      if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Choose an existing verified customer.'; end if;
      insert into public.ticketsafe_crm_roles(user_id,role) values(target,selected_role)
        on conflict(user_id) do update set role=excluded.role,updated_at=now();
    else delete from public.ticketsafe_crm_roles where user_id=target; end if;
  elsif action='email_preview' then
    email_kind:=input->>'kind';
    if email_kind not in('service','announcement','test') or email_kind is null then raise exception 'Choose an email type.'; end if;
    if email_kind='test' then target:=actor_id; end if;
    with recipients as(select u.id,u.email from auth.users u left join public.ticketsafe_announcement_settings a on a.user_id=u.id
      where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())
        and case when email_kind='announcement' then a.enabled and (target is null or u.id=target) else u.id=target end),
      sample as(select * from recipients order by id limit 50)
    select coalesce((select jsonb_agg(to_jsonb(sample)) from sample),'[]'),(select count(*) from recipients) into rows_json,count_total;
    return jsonb_build_object('recipients',rows_json,'recipientCount',count_total,'eligible',count_total>0);
  elsif action='email_create' then
    if actor_role='support' then raise exception 'Support access cannot send emails.' using errcode='42501'; end if;
    if input->>'confirm' is distinct from 'true' then raise exception 'Confirm this send first.'; end if;
    email_kind:=input->>'kind'; fingerprint:=input->>'fingerprint';
    if email_kind not in('service','announcement','test') or email_kind is null or length(coalesce(input->>'subject','')) not between 1 and 160
      or length(coalesce(input->>'message','')) not between 1 and 10000 or fingerprint is null then raise exception 'Check the email content.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text,10367));
    select id,c.fingerprint into campaign,existing_fingerprint from public.ticketsafe_crm_campaigns c where c.actor_id=crm_request.actor_id and idempotency_key=(input->>'idempotencyKey')::uuid;
    if campaign is not null then
      if existing_fingerprint<>fingerprint then raise exception 'This send key was already used for different content.'; end if;
      return jsonb_build_object('campaignId',campaign);
    end if;
    if (select count(*) from public.ticketsafe_crm_campaigns c where c.actor_id=crm_request.actor_id and created_at>now()-interval '24 hours')>=10 then raise exception 'Daily campaign limit reached. Try tomorrow.'; end if;
    if email_kind='test' then target:=actor_id; end if;
    insert into public.ticketsafe_crm_campaigns(actor_id,idempotency_key,fingerprint,kind,subject,message)
      values(actor_id,(input->>'idempotencyKey')::uuid,fingerprint,email_kind,input->>'subject',input->>'message') returning id into campaign;
    insert into public.ticketsafe_crm_deliveries(campaign_id,user_id,recipient,consent_revision)
      select campaign,u.id,u.email,case when email_kind='announcement' then a.revision else null end
      from auth.users u left join public.ticketsafe_announcement_settings a on a.user_id=u.id
      where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now())
        and case when email_kind='announcement' then a.enabled and (target is null or u.id=target) else u.id=target end;
    if not found then raise exception 'No eligible recipients. Announcements require a separate opt-in.'; end if;
    insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail) values(actor_id,'email_create',target,jsonb_build_object('campaignId',campaign,'kind',email_kind));
    return jsonb_build_object('campaignId',campaign);
  elsif action='email_claim' then
    if actor_role='support' then raise exception 'Support access cannot send emails.' using errcode='42501'; end if;
    campaign:=(input->>'campaignId')::uuid;
    perform 1 from public.ticketsafe_crm_campaigns c where id=campaign and c.actor_id=crm_request.actor_id for update;
    if not found then raise exception 'Campaign not found.'; end if;
    insert into public.ticketsafe_crm_budget(day) values(current_date) on conflict do nothing;
    select attempts into attempted from public.ticketsafe_crm_budget where day=current_date for update;
    rows_json:='[]';
    for item in select d.*,c.kind,c.subject,c.message from public.ticketsafe_crm_deliveries d join public.ticketsafe_crm_campaigns c on c.id=d.campaign_id
      where campaign_id=campaign and d.status='pending' order by d.id limit least(1,100-attempted) for update of d skip locked loop
      if not exists(select 1 from auth.users u where u.id=item.user_id and u.email=item.recipient and u.email_confirmed_at is not null
        and (u.banned_until is null or u.banned_until<now())) or (item.kind='announcement' and not exists(select 1 from public.ticketsafe_announcement_settings a where a.user_id=item.user_id and a.enabled and a.revision=item.consent_revision)) then
        update public.ticketsafe_crm_deliveries set status='cancelled' where id=item.id;
        continue;
      end if;
      update public.ticketsafe_crm_deliveries set status='sending' where id=item.id;
      attempted:=attempted+1;
      rows_json:=rows_json||jsonb_build_array(to_jsonb(item));
    end loop;
    update public.ticketsafe_crm_budget set attempts=attempted where day=current_date;
    return jsonb_build_object('deliveries',rows_json);
  elsif action='email_result' then
    if actor_role='support' then raise exception 'Support access cannot send emails.' using errcode='42501'; end if;
    update public.ticketsafe_crm_deliveries d set status=case when input->>'status'='sent' then 'sent' else 'failed' end,
      provider_id=left(input->>'providerId',100),sent_at=case when input->>'status'='sent' then now() else null end
      from public.ticketsafe_crm_campaigns c where d.id=(input->>'deliveryId')::uuid and d.status='sending' and c.id=d.campaign_id and c.actor_id=crm_request.actor_id;
    return jsonb_build_object('ok',true);
  elsif action='email_progress' then
    campaign:=(input->>'campaignId')::uuid;
    if not exists(select 1 from public.ticketsafe_crm_campaigns where id=campaign) then raise exception 'Campaign not found.'; end if;
    return (select jsonb_build_object('campaignId',campaign,'sent',count(*) filter(where status='sent'),'failed',count(*) filter(where status='failed'),
      'remaining',count(*) filter(where status='pending'),'uncertain',count(*) filter(where status='sending'),
      'status',case when count(*) filter(where status='pending')>0 then 'pending' when count(*) filter(where status='sending')>0 then 'review' when count(*) filter(where status='failed')>0 then 'failed' else 'complete' end)
      from public.ticketsafe_crm_deliveries where campaign_id=campaign);
  elsif action='emails' then
    select count(*) into count_total from public.ticketsafe_crm_campaigns;
    select coalesce(jsonb_agg(to_jsonb(c)),'[]') into rows_json from (
      select c.id,c.subject,c.kind,c.created_at,
        count(d.id) recipient_count,count(d.id) filter(where d.status='sent') sent,count(d.id) filter(where d.status='failed') failed,
        case when count(d.id) filter(where d.status='pending')>0 then 'pending' when count(d.id) filter(where d.status='sending')>0 then 'review' when count(d.id) filter(where d.status='failed')>0 then 'failed' else 'complete' end status
      from public.ticketsafe_crm_campaigns c left join public.ticketsafe_crm_deliveries d on d.campaign_id=c.id
      group by c.id order by c.created_at desc limit page_size offset (page_number-1)*page_size
    ) c;
    return jsonb_build_object('emails',rows_json,'total',count_total,'page',page_number);
  elsif action='debug' then
    if target is null then target:=actor_id; end if;
    return jsonb_build_object('checks',jsonb_build_array(
      jsonb_build_object('name','Saved vehicles','state','ok','detail',(select count(*)::text||' saved vehicles' from public.curbside_vehicles where user_id=target)),
      jsonb_build_object('name','Ticket email opt-in','state',case when coalesce((select enabled from public.curbside_email_settings where user_id=target),false) then 'ok' else 'off' end,'detail','Only saved vehicles produce new-ticket alerts.'),
      jsonb_build_object('name','Notification queue','state','ok','detail',(select count(*)::text||' pending ticket deliveries' from public.curbside_email_outbox where user_id=target and status in('pending','sending'))),
      jsonb_build_object('name','Announcement consent','state',case when coalesce((select enabled from public.ticketsafe_announcement_settings where user_id=target),false) then 'ok' else 'off' end,'detail','Separate from new-ticket alerts.')));
  elsif action='status' then
    return jsonb_build_object('database',true,'snapshotLastChecked',(select max(checked_at) from public.curbside_vehicle_snapshots),
      'ticketPending',(select count(*) from public.curbside_email_outbox where status in('pending','sending')),
      'ticketFailed',(select count(*) from public.curbside_email_outbox where status='failed'));
  else raise exception 'Unknown CRM action.'; end if;
  insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail) values(actor_id,action,target,jsonb_build_object('role',selected_role));
  return jsonb_build_object('ok',true);
end $$;
revoke all on function ticketsafe_private.crm_request(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function ticketsafe_private.crm_request(uuid,uuid,text,jsonb) to service_role;
create function public.ticketsafe_crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$
  select ticketsafe_private.crm_request(actor_id,session_id,action,input);
$$;
revoke all on function public.ticketsafe_crm_request(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ticketsafe_crm_request(uuid,uuid,text,jsonb) to service_role;

create function public.ticketsafe_unsubscribe_announcement(account_id uuid,setting_revision uuid)
returns boolean language sql security invoker set search_path='' as $$
  with changed as(update public.ticketsafe_announcement_settings set enabled=false,revision=gen_random_uuid(),updated_at=now()
    where user_id=account_id and revision=setting_revision returning user_id) select exists(select 1 from changed);
$$;
revoke all on function public.ticketsafe_unsubscribe_announcement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ticketsafe_unsubscribe_announcement(uuid,uuid) to service_role;

comment on table public.ticketsafe_crm_presence is 'Operational signed-in presence only; visible within three minutes, pruned after 24 hours. No guest browsing history.';
comment on table public.ticketsafe_announcement_settings is 'Optional product announcements. False by default; independent of saved-vehicle ticket alerts.';
commit;
