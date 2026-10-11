begin;
-- Deleting a support message is permanent (its reply delivery record goes with it),
-- so only admins may do it and every deletion is written to the CRM audit log.
create or replace function public.ticketsafe_crm_request(actor_id uuid,session_id uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; removed public.ticketsafe_support_messages;
begin
  if action in('support_delivery_prepare','support_delivery_claim','support_delivery_result') then
    return ticketsafe_private.support_delivery_request(actor_id,session_id,action,input);
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
  result:=ticketsafe_private.portal_request(actor_id,session_id,action,input);
  if action='support_delete' then
    delete from public.ticketsafe_crm_campaigns where support_context->>'messageId'=input->>'messageId';
    insert into public.ticketsafe_crm_audit(actor_id,action,target_id,detail)
      values(actor_id,'support_delete',removed.user_id,jsonb_build_object('messageId',removed.id,'kind',removed.kind,
        'createdAt',removed.created_at,'replied',removed.replied_at is not null));
  end if;
  return result;
end $$;
-- Existing service-only grants are preserved by CREATE OR REPLACE.
commit;
