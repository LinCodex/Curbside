begin;
-- Customer profiles include a count of signed-in devices. The service role
-- cannot read auth.sessions directly; keep that lookup in the private CRM
-- path, after the existing live-session and administrator-role checks.
create function ticketsafe_private.customer_profile_request(actor_id uuid,session_id uuid,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; target uuid;
begin
  -- This must authorize the actor before any customer/session lookup.
  result:=ticketsafe_private.portal_request(actor_id,session_id,'user',input);
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
  return result;
end $$;
revoke all on function ticketsafe_private.customer_profile_request(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function ticketsafe_private.customer_profile_request(uuid,uuid,jsonb) to service_role;

create or replace function public.ticketsafe_crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; removed public.ticketsafe_support_messages; used integer;
begin
  if action='user' then
    return ticketsafe_private.customer_profile_request(actor_id,session_id,input);
  end if;
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
  return result;
end $$;
commit;
