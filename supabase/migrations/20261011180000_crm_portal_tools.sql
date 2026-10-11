begin;
create table public.ticketsafe_crm_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in('service','announcement')),
  name text not null check(length(name) between 1 and 60),
  subject text not null check(length(subject) between 1 and 160 and subject !~ '[\r\n]'),
  message text not null check(length(message) between 1 and 10000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ticketsafe_crm_templates_name on public.ticketsafe_crm_templates(kind,lower(name));
alter table public.ticketsafe_crm_templates enable row level security;
revoke all on public.ticketsafe_crm_templates from public,anon,authenticated;
grant all on public.ticketsafe_crm_templates to service_role;

-- Activity log, inbox status/search, uncertain-delivery settlement and shared templates.
create function ticketsafe_private.portal_tools_request(actor_id uuid,session_id uuid,action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; page_no integer; rows_json jsonb; total integer; open_total integer; query_text text;
  filter_actions text[]; d public.ticketsafe_crm_deliveries; c public.ticketsafe_crm_campaigns; t public.ticketsafe_crm_templates;
  uuid_pattern constant text:='^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=session_id and s.user_id=actor_id and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Your session has ended. Sign in again.' using errcode='28000';
  end if;
  select role into actor_role from public.ticketsafe_crm_roles where user_id=actor_id;
  if actor_role is null then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  page_no:=greatest(1,least(10000,coalesce((input->>'page')::integer,1)));

  if action='support_messages' then
    delete from public.ticketsafe_support_messages where created_at<now()-interval '90 days';
    query_text:=lower(left(btrim(coalesce(input->>'search','')),100));
    with matched as(select m.*,u.email from public.ticketsafe_support_messages m join auth.users u on u.id=m.user_id
      where (coalesce(input->>'kind','all')='all' or m.kind=input->>'kind')
        and case coalesce(input->>'status','all') when 'open' then m.replied_at is null
          when 'replied' then m.replied_at is not null else true end
        and (query_text='' or position(query_text in lower(coalesce(u.email,'')))>0
          or position(query_text in lower(m.subject))>0 or position(query_text in lower(m.message))>0)),
    paged as(select * from matched order by created_at desc,id limit 20 offset (page_no-1)*20)
    select coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),(select count(*) from matched) into rows_json,total;
    select count(*) into open_total from public.ticketsafe_support_messages where replied_at is null;
    return jsonb_build_object('messages',rows_json,'total',total,'page',page_no,'open',open_total);
  end if;

  if action='templates' then
    return jsonb_build_object('templates',coalesce((select jsonb_agg(jsonb_build_object('id',tp.id,'kind',tp.kind,'name',tp.name,
      'subject',tp.subject,'message',tp.message,'updated_at',tp.updated_at,'updated_by',u.email) order by lower(tp.name))
      from public.ticketsafe_crm_templates tp left join auth.users u on u.id=tp.updated_by),'[]'));
  end if;

  if actor_role not in('master','admin') then
    raise exception 'Only admins can use this tool.' using errcode='42501';
  end if;

  if action='audit' then
    filter_actions:=case coalesce(input->>'filter','all')
      when 'access' then array['role_set','role_remove']
      when 'accounts' then array['change_email','set_password','reset_password','delete_account','ticket_test']
      when 'email' then array['email_create','delivery_resolve']
      when 'inbox' then array['support_delete']
      when 'notes' then array['notes_save']
      when 'templates' then array['template_save','template_delete']
      else null end;
    with matched as(select a.id,a.action,a.detail,a.created_at,ua.email actor_email,ut.email target_email,a.target_id is not null has_target
      from public.ticketsafe_crm_audit a left join auth.users ua on ua.id=a.actor_id left join auth.users ut on ut.id=a.target_id
      where filter_actions is null or a.action=any(filter_actions)),
    paged as(select * from matched order by created_at desc,id desc limit 25 offset (page_no-1)*25)
    select coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),(select count(*) from matched) into rows_json,total;
    return jsonb_build_object('entries',rows_json,'total',total,'page',page_no,'pageSize',25);
  end if;

  if action='delivery_review' then
    return jsonb_build_object('deliveries',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select dl.id,dl.recipient,dl.provider_id,cp.subject,cp.kind,cp.created_at,cp.support_context is not null support_reply
      from public.ticketsafe_crm_deliveries dl join public.ticketsafe_crm_campaigns cp on cp.id=dl.campaign_id
      where dl.status='sending' and (dl.support_lease_until is null or dl.support_lease_until<now())
      order by cp.created_at desc limit 50) x),'[]'));
  end if;

  if action='delivery_resolve' then
    if input->>'confirm' is distinct from 'true' or coalesce(input->>'outcome','') not in('sent','failed') then
      raise exception 'Confirm the result you checked in Resend.';
    end if;
    if coalesce(input->>'deliveryId','') !~* uuid_pattern then raise exception 'This delivery no longer needs review.'; end if;
    select * into d from public.ticketsafe_crm_deliveries where id=(input->>'deliveryId')::uuid for update;
    if not found or d.status<>'sending' then raise exception 'This delivery no longer needs review.'; end if;
    if d.support_lease_until>now() then raise exception 'This reply is still sending. Try again in a few minutes.'; end if;
    select * into c from public.ticketsafe_crm_campaigns where id=d.campaign_id;
    update public.ticketsafe_crm_deliveries set status=input->>'outcome',
      sent_at=case when input->>'outcome'='sent' then coalesce(sent_at,now()) else null end,
      provider_id=coalesce(nullif(left(btrim(coalesce(input->>'providerId','')),100),''),provider_id),
      support_lease_until=null
      where id=d.id;
    if input->>'outcome'='sent' and c.support_context is not null then
      update public.ticketsafe_support_messages set reply=c.message,replied_at=coalesce(replied_at,now())
        where id=(c.support_context->>'messageId')::uuid;
    end if;
    insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail)
      values(actor_id,'delivery_resolve',d.user_id,jsonb_build_object('deliveryId',d.id,'campaignId',c.id,'outcome',input->>'outcome'));
    return jsonb_build_object('ok',true);
  end if;

  if action='template_save' then
    if coalesce(input->>'kind','') not in('service','announcement')
      or length(btrim(coalesce(input->>'name',''))) not between 1 and 60
      or length(btrim(coalesce(input->>'subject',''))) not between 1 and 160 or btrim(input->>'subject') ~ '[\r\n]'
      or length(btrim(coalesce(input->>'message',''))) not between 1 and 10000 then
      raise exception 'Enter a template name, subject and message within the size limits.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('ticketsafe_crm_templates',10371));
    if not exists(select 1 from public.ticketsafe_crm_templates where kind=input->>'kind' and lower(name)=lower(btrim(input->>'name')))
      and (select count(*) from public.ticketsafe_crm_templates)>=100 then
      raise exception 'Template limit reached. Delete an old template first.';
    end if;
    insert into public.ticketsafe_crm_templates(kind,name,subject,message,created_by,updated_by)
      values(input->>'kind',btrim(input->>'name'),btrim(input->>'subject'),btrim(input->>'message'),actor_id,actor_id)
      on conflict(kind,lower(name)) do update set name=excluded.name,subject=excluded.subject,message=excluded.message,
        updated_by=actor_id,updated_at=now()
      returning * into t;
    insert into public.ticketsafe_crm_audit(actor_id,action,detail)
      values(actor_id,'template_save',jsonb_build_object('templateId',t.id,'name',t.name,'kind',t.kind));
    return jsonb_build_object('id',t.id);
  end if;

  if action='template_delete' then
    if coalesce(input->>'templateId','') !~* uuid_pattern then raise exception 'Template not found.'; end if;
    delete from public.ticketsafe_crm_templates where id=(input->>'templateId')::uuid returning * into t;
    if t.id is null then raise exception 'Template not found.'; end if;
    insert into public.ticketsafe_crm_audit(actor_id,action,detail)
      values(actor_id,'template_delete',jsonb_build_object('templateId',t.id,'name',t.name,'kind',t.kind));
    return jsonb_build_object('ok',true);
  end if;

  raise exception 'Unknown CRM action.';
end $$;
revoke all on function ticketsafe_private.portal_tools_request(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function ticketsafe_private.portal_tools_request(uuid,uuid,text,jsonb) to service_role;

-- Campaigns may use 80 of the 100 daily attempts; the rest stays available for
-- support replies and account security notices.
create or replace function public.ticketsafe_crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; removed public.ticketsafe_support_messages; used integer;
begin
  if action in('support_delivery_prepare','support_delivery_claim','support_delivery_result') then
    return ticketsafe_private.support_delivery_request(actor_id,session_id,action,input);
  end if;
  if action in('support_messages','audit','delivery_review','delivery_resolve','templates','template_save','template_delete') then
    return ticketsafe_private.portal_tools_request(actor_id,session_id,action,input);
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
  return result;
end $$;
-- Existing service-only grants are preserved by CREATE OR REPLACE.
commit;
