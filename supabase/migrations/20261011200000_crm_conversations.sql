begin;
-- Conversations unify in-app support messages and customer email replies.
create table public.ticketsafe_crm_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  support_message_id uuid unique references public.ticketsafe_support_messages(id) on delete set null,
  kind text not null default 'email' check(kind in('support','feedback','bug','email')),
  customer_email text not null check(length(customer_email) between 3 and 320),
  customer_name text check(length(customer_name)<=200),
  subject text not null check(length(subject) between 1 and 300),
  status text not null default 'open' check(status in('open','replied','closed')),
  unread boolean not null default true,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index ticketsafe_crm_threads_recent on public.ticketsafe_crm_threads(last_message_at desc);
create index ticketsafe_crm_threads_sender on public.ticketsafe_crm_threads(lower(customer_email),last_message_at desc);
create table public.ticketsafe_crm_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ticketsafe_crm_threads(id) on delete cascade,
  direction text not null check(direction in('inbound','outbound')),
  source text not null check(source in('app','email','portal')),
  from_email text check(length(from_email)<=320),
  from_name text check(length(from_name)<=200),
  body text not null check(length(body) between 1 and 50000),
  attachments jsonb not null default '[]',
  provider_id text unique check(length(provider_id)<=100),
  message_id text check(length(message_id)<=1000),
  actor_id uuid references auth.users(id) on delete set null,
  idempotency_key uuid,
  status text not null default 'received' check(status in('received','pending','sending','sent','failed')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  first_attempt_at timestamptz,
  lease_until timestamptz,
  content jsonb,
  created_at timestamptz not null default now()
);
create index ticketsafe_crm_thread_messages_thread on public.ticketsafe_crm_thread_messages(thread_id,created_at);
create unique index ticketsafe_crm_thread_messages_key on public.ticketsafe_crm_thread_messages(actor_id,idempotency_key)
  where idempotency_key is not null;
alter table public.ticketsafe_crm_threads enable row level security;
alter table public.ticketsafe_crm_thread_messages enable row level security;
revoke all on public.ticketsafe_crm_threads,public.ticketsafe_crm_thread_messages from public,anon,authenticated;
grant all on public.ticketsafe_crm_threads,public.ticketsafe_crm_thread_messages to service_role;

-- "Re: Re: Fwd: Hello" and "回复：Hello" both group with "Hello".
create function ticketsafe_private.thread_subject(subject text) returns text
language sql immutable set search_path='' as $$
  select lower(btrim(regexp_replace(coalesce(subject,''),
    '^(\s*(re|fw|fwd|aw|回复|答复|转发)\s*[:：]\s*)+','','i')))
$$;

insert into public.ticketsafe_crm_threads(user_id,support_message_id,kind,customer_email,subject,status,unread,last_message_at,created_at)
  select m.user_id,m.id,m.kind,u.email,m.subject,case when m.replied_at is null then 'open' else 'replied' end,
    m.replied_at is null,coalesce(m.replied_at,m.created_at),m.created_at
  from public.ticketsafe_support_messages m join auth.users u on u.id=m.user_id where length(u.email)>=3;
insert into public.ticketsafe_crm_thread_messages(thread_id,direction,source,from_email,body,created_at)
  select t.id,'inbound','app',t.customer_email,m.message,m.created_at
  from public.ticketsafe_crm_threads t join public.ticketsafe_support_messages m on m.id=t.support_message_id;
insert into public.ticketsafe_crm_thread_messages(thread_id,direction,source,body,status,created_at)
  select t.id,'outbound','portal',m.reply,'sent',m.replied_at
  from public.ticketsafe_crm_threads t join public.ticketsafe_support_messages m on m.id=t.support_message_id
  where m.reply is not null and m.replied_at is not null;

create function ticketsafe_private.support_message_thread() returns trigger
language plpgsql security definer set search_path='' as $$
declare thread_id uuid; sender text;
begin
  select email into sender from auth.users where id=new.user_id;
  if length(coalesce(sender,''))<3 then return new; end if;
  insert into public.ticketsafe_crm_threads(user_id,support_message_id,kind,customer_email,subject,last_message_at,created_at)
    values(new.user_id,new.id,new.kind,sender,new.subject,new.created_at,new.created_at) returning id into thread_id;
  insert into public.ticketsafe_crm_thread_messages(thread_id,direction,source,from_email,body,created_at)
    values(thread_id,'inbound','app',sender,new.message,new.created_at);
  return new;
end $$;
revoke all on function ticketsafe_private.support_message_thread() from public,anon,authenticated;
create trigger ticketsafe_support_message_thread after insert on public.ticketsafe_support_messages
  for each row execute function ticketsafe_private.support_message_thread();

create function ticketsafe_private.conversation_request(actor_id uuid,session_id uuid,action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; page_no integer; rows_json jsonb; total integer; query_text text; filter_name text;
  t public.ticketsafe_crm_threads; m public.ticketsafe_crm_thread_messages; budget integer; reply_text text;
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
  if action<>'threads' and coalesce(input->>'threadId','') !~* uuid_pattern then
    raise exception 'Conversation not found.';
  end if;

  if action='threads' then
    delete from public.ticketsafe_crm_threads where last_message_at<now()-interval '90 days';
    query_text:=lower(left(btrim(coalesce(input->>'search','')),100));
    filter_name:=coalesce(input->>'filter','needs_reply');
    with matched as(select th.* from public.ticketsafe_crm_threads th
      where case filter_name when 'needs_reply' then th.status='open' when 'unread' then th.unread
          when 'closed' then th.status='closed' else true end
        and (query_text='' or position(query_text in lower(th.customer_email))>0
          or position(query_text in lower(th.subject))>0
          or exists(select 1 from public.ticketsafe_crm_thread_messages tm
            where tm.thread_id=th.id and position(query_text in lower(tm.body))>0))),
    paged as(select mt.id,mt.kind,mt.customer_email,mt.customer_name,mt.subject,mt.status,mt.unread,
        mt.last_message_at,mt.user_id is not null has_account,
        (select count(*) from public.ticketsafe_crm_thread_messages tm where tm.thread_id=mt.id) message_count,
        (select jsonb_build_object('body',left(tm.body,200),'direction',tm.direction)
          from public.ticketsafe_crm_thread_messages tm where tm.thread_id=mt.id order by tm.created_at desc limit 1) last
      from matched mt order by mt.last_message_at desc,mt.id limit 25 offset (page_no-1)*25)
    select coalesce((select jsonb_agg(to_jsonb(paged) order by paged.last_message_at desc,paged.id) from paged),'[]'),
      (select count(*) from matched) into rows_json,total;
    return jsonb_build_object('threads',rows_json,'total',total,'page',page_no,'pageSize',25,
      'needsReply',(select count(*) from public.ticketsafe_crm_threads where status='open'),
      'unread',(select count(*) from public.ticketsafe_crm_threads where unread));
  end if;

  if action in('thread','thread_status','thread_delete','thread_reply_prepare') then
    select * into t from public.ticketsafe_crm_threads where id=(input->>'threadId')::uuid for update;
    if not found then raise exception 'Conversation not found.'; end if;
  end if;

  if action='thread' then
    update public.ticketsafe_crm_threads set unread=false where id=t.id;
    return jsonb_build_object('thread',jsonb_build_object('id',t.id,'kind',t.kind,'customer_email',t.customer_email,
        'customer_name',t.customer_name,'subject',t.subject,'status',t.status,'user_id',t.user_id,'created_at',t.created_at),
      'messages',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'direction',tm.direction,'source',tm.source,
          'from_email',tm.from_email,'from_name',tm.from_name,'body',tm.body,'attachments',tm.attachments,
          'status',tm.status,'created_at',tm.created_at,'actor_email',u.email,
          'needs_review',tm.status in('pending','sending') and (tm.lease_until is null or tm.lease_until<now()),
          'retryable',tm.status in('pending','sending') and tm.attempts<5
            and (tm.first_attempt_at is null or tm.first_attempt_at>now()-interval '22 hours'))
        order by tm.created_at,tm.id)
        from public.ticketsafe_crm_thread_messages tm left join auth.users u on u.id=tm.actor_id
        where tm.thread_id=t.id),'[]'));
  end if;

  if action='thread_status' then
    if coalesce(input->>'status','') not in('open','closed') then raise exception 'Choose open or closed.'; end if;
    update public.ticketsafe_crm_threads set status=input->>'status' where id=t.id;
    return jsonb_build_object('ok',true);
  end if;

  if action='thread_delete' then
    if actor_role not in('master','admin') then
      raise exception 'Only admins can delete conversations.' using errcode='42501';
    end if;
    delete from public.ticketsafe_crm_threads where id=t.id;
    if t.support_message_id is not null then
      delete from public.ticketsafe_support_messages where id=t.support_message_id;
      delete from public.ticketsafe_crm_campaigns where support_context->>'messageId'=t.support_message_id::text;
    end if;
    insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail)
      values(actor_id,'thread_delete',t.user_id,jsonb_build_object('threadId',t.id,'kind',t.kind,'createdAt',t.created_at));
    return jsonb_build_object('ok',true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text,10372));
  if action='thread_reply_prepare' then
    if coalesce(input->>'retryMessageId','')<>'' then
      if input->>'retryMessageId' !~* uuid_pattern then raise exception 'Reply not found.'; end if;
      select * into m from public.ticketsafe_crm_thread_messages where id=(input->>'retryMessageId')::uuid
        and thread_id=t.id and direction='outbound' and source='portal';
      if not found then raise exception 'Reply not found.'; end if;
    else
      reply_text:=btrim(coalesce(input->>'reply',''));
      if length(reply_text) not between 1 and 10000 or coalesce(input->>'idempotencyKey','') !~* uuid_pattern then
        raise exception 'Write a reply before sending.';
      end if;
      select * into m from public.ticketsafe_crm_thread_messages tm
        where tm.actor_id=conversation_request.actor_id and tm.idempotency_key=(input->>'idempotencyKey')::uuid;
      if found then
        if m.thread_id<>t.id or m.body<>reply_text then raise exception 'This send key was already used for different content.'; end if;
      else
        if (select count(*) from public.ticketsafe_crm_thread_messages tm where tm.actor_id=conversation_request.actor_id
          and tm.direction='outbound' and tm.created_at>now()-interval '24 hours')>=100 then
          raise exception 'Daily CRM email limit reached.';
        end if;
        insert into public.ticketsafe_crm_thread_messages(thread_id,direction,source,body,actor_id,idempotency_key,status)
          values(t.id,'outbound','portal',reply_text,actor_id,(input->>'idempotencyKey')::uuid,'pending') returning * into m;
      end if;
    end if;
    return jsonb_build_object('messageId',m.id,'status',m.status,'reply',m.body,'threadId',t.id,
      'recipient',t.customer_email,'subject',t.subject,
      'language',coalesce((select language from public.curbside_preferences where user_id=t.user_id),'en'),
      'inReplyTo',(select tm.message_id from public.ticketsafe_crm_thread_messages tm
        where tm.thread_id=t.id and tm.direction='inbound' and tm.message_id is not null order by tm.created_at desc limit 1));
  end if;

  if coalesce(input->>'messageId','') !~* uuid_pattern then raise exception 'Reply not found.'; end if;
  select tm.* into m from public.ticketsafe_crm_thread_messages tm join public.ticketsafe_crm_threads th on th.id=tm.thread_id
    where tm.id=(input->>'messageId')::uuid and th.id=(input->>'threadId')::uuid
      and tm.direction='outbound' and tm.source='portal' for update of tm;
  if not found then raise exception 'Reply not found.'; end if;
  select * into t from public.ticketsafe_crm_threads where id=m.thread_id for update;

  if action='thread_reply_claim' then
    if m.status='sent' then return jsonb_build_object('claimed',false,'status','completed'); end if;
    if m.status not in('pending','sending') or m.attempts>=5 or m.lease_until>now()
      or m.first_attempt_at<now()-interval '22 hours' then
      return jsonb_build_object('claimed',false,'status','review');
    end if;
    if jsonb_typeof(input->'content') is distinct from 'object' or octet_length((input->'content')::text)>200000 then
      raise exception 'Invalid reply content';
    end if;
    insert into public.ticketsafe_crm_budget(day) values(current_date) on conflict do nothing;
    select attempts into budget from public.ticketsafe_crm_budget where day=current_date for update;
    if budget>=100 then raise exception 'Daily CRM email limit reached.'; end if;
    update public.ticketsafe_crm_budget set attempts=attempts+1 where day=current_date;
    update public.ticketsafe_crm_thread_messages set status='sending',attempts=attempts+1,
      first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes',
      content=coalesce(content,input->'content')
      where id=m.id returning * into m;
    return jsonb_build_object('claimed',true,'recipient',t.customer_email,'content',m.content);
  end if;

  if action='thread_reply_result' then
    if length(coalesce(input->>'providerId','')) not between 1 and 100 or m.status not in('sending','sent') then
      raise exception 'Reply delivery needs review.';
    end if;
    update public.ticketsafe_crm_thread_messages set status='sent',provider_id=coalesce(provider_id,input->>'providerId'),
      lease_until=null where id=m.id;
    update public.ticketsafe_crm_threads set status=case when status='closed' then 'closed' else 'replied' end,
      unread=false,last_message_at=now() where id=t.id;
    if t.support_message_id is not null then
      update public.ticketsafe_support_messages set reply=m.body,replied_at=now() where id=t.support_message_id;
    end if;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'Unknown CRM action.';
end $$;
revoke all on function ticketsafe_private.conversation_request(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function ticketsafe_private.conversation_request(uuid,uuid,text,jsonb) to service_role;

-- Called only by the signed inbound-email webhook.
create function public.ticketsafe_crm_inbound(payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ticketsafe_crm_threads; sender text; subject_text text; message_id uuid;
begin
  sender:=lower(btrim(coalesce(payload->>'fromEmail','')));
  if sender !~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' or length(sender)>320
    or length(coalesce(payload->>'providerId','')) not between 1 and 100
    or length(btrim(coalesce(payload->>'body',''))) not between 1 and 50000 then
    raise exception 'Invalid inbound email.';
  end if;
  if exists(select 1 from public.ticketsafe_crm_thread_messages where provider_id=payload->>'providerId') then
    return jsonb_build_object('duplicate',true);
  end if;
  if (select count(*) from public.ticketsafe_crm_thread_messages where direction='inbound' and source='email'
      and lower(from_email)=sender and created_at>now()-interval '24 hours')>=50
    or (select count(*) from public.ticketsafe_crm_thread_messages where direction='inbound' and source='email'
      and created_at>now()-interval '24 hours')>=1000 then
    return jsonb_build_object('dropped',true);
  end if;
  subject_text:=left(coalesce(nullif(btrim(regexp_replace(coalesce(payload->>'subject',''),'[\r\n]+',' ','g')),''),'(no subject)'),300);
  if coalesce(payload->>'threadId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select * into t from public.ticketsafe_crm_threads where id=(payload->>'threadId')::uuid for update;
  end if;
  if t.id is null then
    select * into t from public.ticketsafe_crm_threads where lower(customer_email)=sender
      and ticketsafe_private.thread_subject(subject)=ticketsafe_private.thread_subject(subject_text)
      and last_message_at>now()-interval '30 days' order by last_message_at desc limit 1 for update;
  end if;
  if t.id is null then
    insert into public.ticketsafe_crm_threads(user_id,kind,customer_email,customer_name,subject)
      values((select id from auth.users where lower(email)=sender and email_confirmed_at is not null limit 1),
        'email',sender,nullif(left(btrim(coalesce(payload->>'fromName','')),200),''),
        coalesce(nullif(left(btrim(regexp_replace(subject_text,'^(\s*(re|fw|fwd|aw|回复|答复|转发)\s*[:：]\s*)+','','i')),300),''),subject_text))
      returning * into t;
  end if;
  insert into public.ticketsafe_crm_thread_messages(thread_id,direction,source,from_email,from_name,body,attachments,provider_id,message_id)
    values(t.id,'inbound','email',sender,nullif(left(btrim(coalesce(payload->>'fromName','')),200),''),
      left(btrim(payload->>'body'),50000),
      case when jsonb_typeof(payload->'attachments')='array' then payload->'attachments' else '[]' end,
      payload->>'providerId',nullif(left(payload->>'messageId',1000),''))
    returning id into message_id;
  update public.ticketsafe_crm_threads set status='open',unread=true,last_message_at=now() where id=t.id;
  return jsonb_build_object('threadId',t.id,'messageId',message_id);
end $$;
revoke all on function public.ticketsafe_crm_inbound(jsonb) from public,anon,authenticated;
grant execute on function public.ticketsafe_crm_inbound(jsonb) to service_role;

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
  if action in('threads','thread','thread_status','thread_delete','thread_reply_prepare','thread_reply_claim','thread_reply_result') then
    return ticketsafe_private.conversation_request(actor_id,session_id,action,input);
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
  return result;
end $$;
commit;
