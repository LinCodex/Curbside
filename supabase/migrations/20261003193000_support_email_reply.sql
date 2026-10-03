begin;
alter table public.ticketsafe_support_messages
  add column if not exists reply text,
  add column if not exists replied_at timestamptz;
alter table public.ticketsafe_support_messages
  drop constraint if exists ticketsafe_support_messages_reply_check;
alter table public.ticketsafe_support_messages
  add constraint ticketsafe_support_messages_reply_check
  check (reply is null or length(reply) between 1 and 4000);

create or replace function ticketsafe_private.portal_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text; target uuid; op public.ticketsafe_account_operations; rows_json jsonb; total integer; page_no integer; ticket jsonb; msg jsonb;
begin
  if action not in('support_create','support_messages','support_delete','support_reply','support_reply_record','account_claim','account_result','account_mail_claim') then
    return ticketsafe_private.crm_request(actor_id,session_id,action,input);
  end if;
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=session_id and s.user_id=actor_id and (s.not_after is null or s.not_after>now())
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Your session has ended. Sign in again.' using errcode='28000';
  end if;
  if action='support_create' then
    if input->>'expectedUserId' is distinct from actor_id::text then raise exception 'Your account changed. Reload before saving.'; end if;
    if coalesce(input->>'kind','') not in('support','feedback','bug')
      or length(btrim(coalesce(input->>'subject',''))) not between 1 and 160
      or length(btrim(coalesce(input->>'message',''))) not between 1 and 4000 then raise exception 'Check the subject and message.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(actor_id::text,10368));
    if (select count(*) from public.ticketsafe_support_messages where user_id=actor_id and created_at>now()-interval '24 hours')>=5
      or exists(select 1 from public.ticketsafe_support_messages where user_id=actor_id and created_at>now()-interval '60 seconds') then
      raise exception 'Please wait before sending another message.';
    end if;
    delete from public.ticketsafe_support_messages where created_at<now()-interval '90 days';
    if (select count(*) from public.ticketsafe_support_messages)>=10000 then raise exception 'Support inbox is full. Please try later.'; end if;
    insert into public.ticketsafe_support_messages(user_id,kind,subject,message)
      values(actor_id,input->>'kind',btrim(input->>'subject'),btrim(input->>'message'));
    return jsonb_build_object('ok',true);
  end if;
  select role into role_name from public.ticketsafe_crm_roles where user_id=actor_id;
  if role_name is null then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  delete from public.ticketsafe_support_messages where created_at<now()-interval '90 days';
  delete from public.ticketsafe_account_operations where created_at<now()-interval '90 days';
  if action='support_messages' then
    page_no:=greatest(1,least(10000,coalesce((input->>'page')::integer,1)));
    with matched as(select m.*,u.email from public.ticketsafe_support_messages m join auth.users u on u.id=m.user_id
      where coalesce(input->>'kind','all')='all' or m.kind=input->>'kind'),
    paged as(select * from matched order by created_at desc,id limit 20 offset (page_no-1)*20)
    select coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'),(select count(*) from matched) into rows_json,total;
    return jsonb_build_object('messages',rows_json,'total',total,'page',page_no);
  elsif action='support_delete' then
    delete from public.ticketsafe_support_messages where id=(input->>'messageId')::uuid;
    return jsonb_build_object('ok',true);
  elsif action='support_reply' then
    if input->>'confirm' is distinct from 'true' then raise exception 'Confirm this reply first.'; end if;
    if coalesce(input->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Message not found.'; end if;
    select jsonb_build_object(
      'email', u.email,
      'subject', m.subject,
      'message', m.message,
      'language', coalesce((select language from public.curbside_preferences p where p.user_id=m.user_id),'en')
    ) into msg
    from public.ticketsafe_support_messages m
    join auth.users u on u.id=m.user_id
    where m.id=(input->>'messageId')::uuid;
    if msg is null or coalesce(msg->>'email','')='' then raise exception 'Message not found.'; end if;
    insert into public.ticketsafe_crm_budget(day) values(current_date) on conflict do nothing;
    perform 1 from public.ticketsafe_crm_budget where day=current_date for update;
    if (select attempts from public.ticketsafe_crm_budget where day=current_date)>=100 then raise exception 'Daily CRM email limit reached.'; end if;
    update public.ticketsafe_crm_budget set attempts=attempts+1 where day=current_date;
    return msg;
  elsif action='support_reply_record' then
    if coalesce(input->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Message not found.'; end if;
    if length(btrim(coalesce(input->>'reply',''))) not between 1 and 4000 then raise exception 'Write a reply before sending.'; end if;
    update public.ticketsafe_support_messages
      set reply=btrim(input->>'reply'), replied_at=now()
      where id=(input->>'messageId')::uuid;
    if not found then raise exception 'Message not found.'; end if;
    return jsonb_build_object('ok',true);
  end if;
  if role_name='support' then raise exception 'Support access cannot manage accounts or send emails.' using errcode='42501'; end if;
  if action='account_mail_claim' then
    if not exists(select 1 from public.ticketsafe_account_operations o where o.id=(input->>'operationId')::uuid
      and o.actor_id=portal_request.actor_id and o.status='processing') then raise exception 'Account action is not active.'; end if;
    insert into public.ticketsafe_crm_budget(day) values(current_date) on conflict do nothing;
    perform 1 from public.ticketsafe_crm_budget where day=current_date for update;
    if (select attempts from public.ticketsafe_crm_budget where day=current_date)>=100 then raise exception 'Daily CRM email limit reached.'; end if;
    update public.ticketsafe_crm_budget set attempts=attempts+1 where day=current_date;
    return jsonb_build_object('ok',true);
  end if;
  if action='account_result' then
    update public.ticketsafe_account_operations o set status=case when input->>'status'='completed' then 'completed' else 'review' end,
      mail_status=left(coalesce(input->>'mailStatus','not_requested'),40)
      where o.id=(input->>'operationId')::uuid and o.actor_id=portal_request.actor_id and o.status='processing';
    return jsonb_build_object('ok',true);
  end if;
  target:=(input->>'userId')::uuid;
  if input->>'confirm' is distinct from 'true' or coalesce(input->>'kind','') not in('change_email','reset_password','set_password','delete_account','ticket_test')
    or input->>'fingerprint' is null then raise exception 'Confirm this action first.'; end if;
  if input->>'kind'<>'ticket_test' and (target=actor_id or exists(select 1 from public.ticketsafe_crm_roles where user_id=target)) then
    raise exception 'Manage administrator accounts through their own account settings.';
  end if;
  if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Customer not found.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text,10369));
  select o.* into op from public.ticketsafe_account_operations o where o.actor_id=portal_request.actor_id and o.request_key=(input->>'idempotencyKey')::uuid;
  if found then
    if op.fingerprint<>input->>'fingerprint' then raise exception 'This action key was already used for different content.'; end if;
    return jsonb_build_object('claimed',false,'operationId',op.id,'status',op.status,'mailStatus',op.mail_status);
  end if;
  if (select count(*) from public.ticketsafe_account_operations o where o.actor_id=portal_request.actor_id and o.created_at>now()-interval '24 hours')>=20 then
    raise exception 'Daily account-action limit reached.';
  end if;
  if input->>'kind'='ticket_test' then
    if coalesce(input->>'vehicleId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Select a saved vehicle.';
    end if;
    select jsonb_build_object(
      'id', t->>'id',
      'plate', v.plate,
      'state', v.state,
      'nickname', coalesce(v.nickname, ''),
      'description', left(coalesce(t->>'description', ''), 200),
      'issued', t->>'issued',
      'time', left(coalesce(t->>'time', ''), 30),
      'due', t->'due',
      'status', left(coalesce(t->>'status', ''), 80),
      'location', coalesce(t->'location', jsonb_build_object('label','','precision','unknown'))
    ) into ticket
    from public.curbside_vehicles v
    join public.curbside_vehicle_snapshots s
      on s.plate=v.plate and s.state=v.state and s.plate_type=v.plate_type
    cross join lateral jsonb_array_elements(s.payload->'tickets') t
    where v.user_id=target and v.id=(input->>'vehicleId')::uuid
    order by t->>'issued' desc nulls last, t->>'id' desc
    limit 1;
    if ticket is null then raise exception 'No saved ticket is available for this vehicle.'; end if;
  end if;
  insert into public.ticketsafe_account_operations(actor_id,target_id,request_key,fingerprint,kind)
    values(actor_id,target,(input->>'idempotencyKey')::uuid,input->>'fingerprint',input->>'kind') returning * into op;
  insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail)
    values(actor_id,input->>'kind',target,jsonb_build_object('operationId',op.id));
  return jsonb_build_object('claimed',true,'operationId',op.id,'status',op.status,
    'email',(select email from auth.users where id=target),
    'language',coalesce((select language from public.curbside_preferences where user_id=target),'en'),'ticket',ticket);
end $$;
commit;
