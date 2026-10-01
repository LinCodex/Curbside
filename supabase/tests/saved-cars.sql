-- Run through the SQL editor or execute_sql. Fixtures and mutations are rolled back.
begin;
insert into auth.users(id,email) values
('193a2604-3ba1-4b61-9e9a-5276512dc001','curbside-rls-a@example.invalid'),
('193a2604-3ba1-4b61-9e9a-5276512dc002','curbside-rls-b@example.invalid');
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
do $$ begin
  if has_table_privilege('anon','public.curbside_vehicles','select') then raise exception 'Anonymous read privilege'; end if;
  if has_column_privilege('authenticated','public.curbside_vehicles','user_id','update') then raise exception 'Ownership column editable'; end if;
  if has_column_privilege('authenticated','public.curbside_terms_acceptances','accepted_at','insert') then raise exception 'Acceptance timestamp forgeable'; end if;
end $$;
rollback;
select 'PASS: consent, owner isolation, rename, duplicates, anonymous denial' as result,
  (select count(*) from auth.users where id in('193a2604-3ba1-4b61-9e9a-5276512dc001','193a2604-3ba1-4b61-9e9a-5276512dc002'))=0 as fixtures_rolled_back,
  (select bool_and(rowsecurity) from pg_tables where schemaname='public' and tablename in('curbside_vehicles','curbside_terms_acceptances')) as rls_enabled;
