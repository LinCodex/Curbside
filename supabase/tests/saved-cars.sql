-- Run through the SQL editor or execute_sql. Fixtures and mutations are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('193a2604-3ba1-4b61-9e9a-5276512dc001','curbside-rls-a@example.invalid',now()),
('193a2604-3ba1-4b61-9e9a-5276512dc002','curbside-rls-b@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc001","role":"authenticated","is_anonymous":false}',true);
do $$ begin
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname) values(auth.uid(),'RLSCHECK','NY','Before acceptance');
    raise exception 'Missing consent was allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.curbside_terms_acceptances(user_id,version) values(auth.uid(),'2026-09-27.1');
insert into public.curbside_vehicles(user_id,plate,state,nickname) values(auth.uid(),'RLSCHECK','NY','Owner A');
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc002","role":"authenticated","is_anonymous":false}',true);
do $$ declare touched integer; begin
  if exists(select 1 from public.curbside_vehicles where plate='RLSCHECK') then raise exception 'Other customer can read car'; end if;
  update public.curbside_vehicles set nickname='Forbidden' where plate='RLSCHECK';
  get diagnostics touched = row_count;
  if touched<>0 then raise exception 'Other customer can update car'; end if;
  delete from public.curbside_vehicles where plate='RLSCHECK';
  get diagnostics touched = row_count;
  if touched<>0 then raise exception 'Other customer can delete car'; end if;
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname) values('193a2604-3ba1-4b61-9e9a-5276512dc001','FORGED','NY','Wrong owner');
    raise exception 'Forged owner allowed';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.curbside_terms_acceptances(user_id,version) values(auth.uid(),'2026-09-27.1');
insert into public.curbside_vehicles(user_id,plate,state,nickname) values(auth.uid(),'RLSCHECK','NY','Owner B');
do $$ begin
  if (select count(*) from public.curbside_vehicles where plate='RLSCHECK')<>1 then raise exception 'Owner scope incorrect'; end if;
end $$;
update public.curbside_vehicles set nickname='Renamed' where user_id=auth.uid();
do $$ begin
  if not exists(select 1 from public.curbside_vehicles where nickname='Renamed' and user_id=auth.uid()) then raise exception 'Rename failed'; end if;
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname) values(auth.uid(),'RLSCHECK','NY','Duplicate');
    raise exception 'Duplicate allowed';
  exception when unique_violation then null; end;
end $$;
reset role;

-- Per-profile settings and pending accounts; no fixtures leave this transaction.
insert into auth.users(id,email) values
('193a2604-3ba1-4b61-9e9a-5276512dc003','curbside-pending@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc001","role":"authenticated","is_anonymous":false}',true);
insert into public.curbside_preferences(user_id,theme,language,detail_mode) values(auth.uid(),'dark','zh','geek');
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc002","role":"authenticated","is_anonymous":false}',true);
do $$ declare touched integer; begin
  if exists(select 1 from public.curbside_preferences) then raise exception 'Another profile can read settings'; end if;
  update public.curbside_preferences set theme='light';
  get diagnostics touched = row_count;
  if touched<>0 then raise exception 'Another profile can update settings'; end if;
end $$;
insert into public.curbside_preferences(user_id,theme) values(auth.uid(),'light');
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc001","role":"authenticated","is_anonymous":false}',true);
update public.curbside_preferences set theme='system' where user_id=auth.uid();
do $$ begin
  if not exists(select 1 from public.curbside_preferences where theme='system' and language='zh' and detail_mode='geek') then raise exception 'Own settings not saved'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc003","role":"authenticated","is_anonymous":false}',true);
do $$ begin
  if curbside_private.confirmed_email() then raise exception 'Unconfirmed account accepted'; end if;
  if exists(select 1 from public.curbside_preferences) or exists(select 1 from public.curbside_vehicles) then raise exception 'Pending account reads data'; end if;
  begin
    insert into public.curbside_preferences(user_id) values(auth.uid());
    raise exception 'Pending account settings allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.curbside_terms_acceptances(user_id,version) values(auth.uid(),'2026-09-27.1');
    raise exception 'Pending account acceptance allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.curbside_vehicles','select') then raise exception 'Anonymous read privilege'; end if;
  if has_column_privilege('authenticated','public.curbside_vehicles','user_id','update') then raise exception 'Ownership column editable'; end if;
  if has_column_privilege('authenticated','public.curbside_terms_acceptances','accepted_at','insert') then raise exception 'Acceptance timestamp forgeable'; end if;
end $$;
rollback;
select 'PASS: consent, car/settings owner isolation, rename, duplicates, anonymous and unconfirmed denial' as result,
  (select count(*) from auth.users where id in('193a2604-3ba1-4b61-9e9a-5276512dc001','193a2604-3ba1-4b61-9e9a-5276512dc002'))=0 as fixtures_rolled_back,
  (select bool_and(rowsecurity) from pg_tables where schemaname='public' and tablename in('curbside_vehicles','curbside_terms_acceptances')) as rls_enabled;
