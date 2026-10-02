-- Run after the email migration. Synthetic fixtures are always rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
  ('a9175af4-e1b0-4510-b261-8db6fdc67001','email-rls-a@example.invalid',now()),
  ('a9175af4-e1b0-4510-b261-8db6fdc67002','email-rls-b@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a9175af4-e1b0-4510-b261-8db6fdc67001","is_anonymous":false}',true);
do $$ begin
  begin
    insert into public.curbside_email_settings(user_id,enabled) values(auth.uid(),true);
    raise exception 'Opt-in without current legal acceptance allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.curbside_terms_acceptances(user_id,version) values(auth.uid(),'2026-09-27.1');
insert into public.curbside_email_settings(user_id,enabled) values(auth.uid(),true);
do $$ begin
  if not exists(select 1 from public.curbside_email_settings where user_id=auth.uid() and enabled) then raise exception 'Own opt-in missing'; end if;
  begin
    insert into public.curbside_email_settings(user_id,enabled) values('a9175af4-e1b0-4510-b261-8db6fdc67002',true);
    raise exception 'Forged notification owner allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"a9175af4-e1b0-4510-b261-8db6fdc67002","is_anonymous":false}',true);
do $$ declare n integer; begin
  if exists(select 1 from public.curbside_email_settings) then raise exception 'Other owner reads preferences'; end if;
  update public.curbside_email_settings set enabled=false;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Other owner disables alerts'; end if;
end $$;
reset role;
update auth.users set is_anonymous=true where id='a9175af4-e1b0-4510-b261-8db6fdc67001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a9175af4-e1b0-4510-b261-8db6fdc67001","is_anonymous":false}',true);
do $$ declare n integer; begin
  if exists(select 1 from public.curbside_email_settings) then raise exception 'Anonymous Auth record reads preferences'; end if;
  update public.curbside_email_settings set enabled=true where user_id=auth.uid();
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Anonymous Auth record enables alerts'; end if;
end $$;
reset role;
do $$ declare role_name text; table_name text; rpc text; begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach table_name in array array['curbside_email_baselines','curbside_email_seen','curbside_email_outbox','curbside_email_events','curbside_email_budget'] loop
      if has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Browser privileges on %',table_name; end if;
    end loop;
    foreach rpc in array array[
      'public.curbside_snapshot_needs_email_baseline(text)',
      'public.curbside_finish_snapshot_with_email(text,uuid,jsonb,boolean,jsonb)',
      'public.curbside_claim_email_jobs()',
      'public.curbside_freeze_email_content(uuid,uuid,jsonb)',
      'public.curbside_email_job_is_current(uuid,uuid)',
      'public.curbside_finish_email_job(uuid,uuid,boolean,text,boolean)',
      'public.curbside_unsubscribe_ticket_email(uuid,uuid)'] loop
      if has_function_privilege(role_name,rpc,'EXECUTE') then raise exception 'Browser executes %',rpc; end if;
    end loop;
  end loop;
  if has_column_privilege('authenticated','public.curbside_email_settings','revision','UPDATE')
    or has_column_privilege('authenticated','public.curbside_email_settings','enabled_at','INSERT')
    or has_column_privilege('authenticated','public.curbside_email_settings','user_id','UPDATE') then raise exception 'Forgeable notification control fields'; end if;
end $$;
rollback;
select 'PASS: explicit legal opt-in, owner isolation, anonymous denial and service-only outbox' as result;
