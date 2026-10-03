begin;
-- Reuse the private CRM delivery ledger rather than introducing a second queue.
alter table public.ticketsafe_crm_campaigns add column support_context jsonb;
alter table public.ticketsafe_crm_deliveries
  add column support_first_attempt_at timestamptz,
  add column support_lease_until timestamptz,
  add column support_attempts integer not null default 0 check(support_attempts between 0 and 5);

create function ticketsafe_private.support_delivery_request(actor_id uuid,session_id uuid,action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.ticketsafe_crm_campaigns; d public.ticketsafe_crm_deliveries; m public.ticketsafe_support_messages;
  recipient text; context jsonb; budget integer;
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
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text,10370));
  if action='support_delivery_prepare' then
    if input->>'confirm' is distinct from 'true'
      or length(btrim(coalesce(input->>'reply',''))) not between 1 and 4000
      or length(coalesce(input->>'fingerprint',''))<>64 then raise exception 'Confirm this reply first.'; end if;
    select campaign.* into c from public.ticketsafe_crm_campaigns campaign
      where campaign.actor_id=support_delivery_request.actor_id and campaign.idempotency_key=(input->>'idempotencyKey')::uuid;
    if found then
      if c.fingerprint<>input->>'fingerprint' or c.support_context is null then
        raise exception 'This send key was already used for different content.';
      end if;
    else
      select * into m from public.ticketsafe_support_messages where id=(input->>'messageId')::uuid;
      if not found then raise exception 'Message not found.'; end if;
      select email into recipient from auth.users where id=m.user_id and email_confirmed_at is not null
        and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<now());
      if recipient is null then raise exception 'Message not found.'; end if;
      if (select count(*) from public.ticketsafe_crm_campaigns campaign where campaign.actor_id=support_delivery_request.actor_id
        and support_context is not null and created_at>now()-interval '24 hours')>=100 then
        raise exception 'Daily CRM email limit reached.';
      end if;
      context:=jsonb_build_object('messageId',m.id,'subject',m.subject,'message',m.message,
        'language',coalesce((select language from public.curbside_preferences where user_id=m.user_id),'en'),
        'origin',left(input->>'origin',2048));
      insert into public.ticketsafe_crm_campaigns(actor_id,idempotency_key,fingerprint,kind,subject,message,support_context)
        values(actor_id,(input->>'idempotencyKey')::uuid,input->>'fingerprint','service',m.subject,btrim(input->>'reply'),context)
        returning * into c;
      insert into public.ticketsafe_crm_deliveries(campaign_id,user_id,recipient) values(c.id,m.user_id,recipient);
    end if;
    select * into d from public.ticketsafe_crm_deliveries where campaign_id=c.id;
    return jsonb_build_object('deliveryId',d.id,'status',d.status,'context',c.support_context,'reply',c.message);
  end if;
  select delivery.* into d from public.ticketsafe_crm_deliveries delivery
    join public.ticketsafe_crm_campaigns campaign on campaign.id=delivery.campaign_id
    where delivery.id=(input->>'deliveryId')::uuid and campaign.actor_id=support_delivery_request.actor_id
      and campaign.support_context is not null for update of delivery;
  if not found then raise exception 'Reply delivery not found.'; end if;
  select * into c from public.ticketsafe_crm_campaigns where id=d.campaign_id;
  if action='support_delivery_claim' then
    if d.status='sent' then return jsonb_build_object('claimed',false,'status','completed'); end if;
    if d.status not in('pending','sending') or d.support_attempts>=5 or d.support_lease_until>now()
      or d.support_first_attempt_at<now()-interval '22 hours' then
      return jsonb_build_object('claimed',false,'status','review');
    end if;
    if not exists(select 1 from auth.users where id=d.user_id and email=d.recipient and email_confirmed_at is not null
      and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<now())) then
      update public.ticketsafe_crm_deliveries set status='cancelled' where id=d.id;
      return jsonb_build_object('claimed',false,'status','review');
    end if;
    if jsonb_typeof(input->'content') is distinct from 'object' or octet_length((input->'content')::text)>100000 then
      raise exception 'Invalid reply content';
    end if;
    insert into public.ticketsafe_crm_budget(day) values(current_date) on conflict do nothing;
    select attempts into budget from public.ticketsafe_crm_budget where day=current_date for update;
    if budget>=100 then raise exception 'Daily CRM email limit reached.'; end if;
    update public.ticketsafe_crm_budget set attempts=attempts+1 where day=current_date;
    update public.ticketsafe_crm_campaigns set support_context=jsonb_set(support_context,'{content}',
      coalesce(support_context->'content',input->'content')) where id=c.id returning support_context into context;
    update public.ticketsafe_crm_deliveries set status='sending',support_attempts=support_attempts+1,
      support_first_attempt_at=coalesce(support_first_attempt_at,now()),support_lease_until=now()+interval '2 minutes'
      where id=d.id;
    return jsonb_build_object('claimed',true,'recipient',d.recipient,'content',context->'content');
  elsif action='support_delivery_result' then
    if length(coalesce(input->>'providerId','')) not between 1 and 100 or d.status not in('sending','sent') then
      raise exception 'Reply delivery needs review.';
    end if;
    update public.ticketsafe_crm_deliveries set status='sent',provider_id=input->>'providerId',
      sent_at=coalesce(sent_at,now()),support_lease_until=null where id=d.id;
    update public.ticketsafe_support_messages set reply=c.message,replied_at=coalesce(d.sent_at,now())
      where id=(c.support_context->>'messageId')::uuid;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'Unsupported reply action';
end $$;
revoke all on function ticketsafe_private.support_delivery_request(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function ticketsafe_private.support_delivery_request(uuid,uuid,text,jsonb) to service_role;

create or replace function public.ticketsafe_crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if action in('support_delivery_prepare','support_delivery_claim','support_delivery_result') then
    return ticketsafe_private.support_delivery_request(actor_id,session_id,action,input);
  end if;
  result:=ticketsafe_private.portal_request(actor_id,session_id,action,input);
  if action='support_delete' then
    delete from public.ticketsafe_crm_campaigns where support_context->>'messageId'=input->>'messageId';
  end if;
  return result;
end $$;
-- Existing service-only grants are preserved by CREATE OR REPLACE.
commit;
