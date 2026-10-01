-- Run after the Clerk cutover migration. All fixtures roll back.
-- Clerk identity and owner isolation are tested at the server API boundary;
-- Supabase browser roles must have no direct account data access.
begin;
set local role service_role;
insert into public.curbside_accounts(id,clerk_user_id) values
('193a2604-3ba1-4b61-9e9a-5276512dc001','user_sqlTestA'),
('193a2604-3ba1-4b61-9e9a-5276512dc002','user_sqlTestB');
insert into public.curbside_terms_acceptances(user_id,version,accepted_at) values
('193a2604-3ba1-4b61-9e9a-5276512dc001','2026-09-27.1','2026-09-30T12:00:00Z');
insert into public.curbside_vehicles(user_id,plate,state,nickname) values
('193a2604-3ba1-4b61-9e9a-5276512dc001','RLSCHECK','NY','Owner A'),
('193a2604-3ba1-4b61-9e9a-5276512dc002','RLSCHECK','NY','Owner B');
insert into public.curbside_preferences(user_id,theme,language,detail_mode) values
('193a2604-3ba1-4b61-9e9a-5276512dc001','dark','zh','geek'),
('193a2604-3ba1-4b61-9e9a-5276512dc002','light','en','normal');
reset role;

-- Table and column grants both have to be revoked. An old Supabase JWT
-- cannot read or mutate rows even though its old RLS policies still exist.
do $$ declare browser_role text; account_table text; protected_column record; begin
  foreach browser_role in array array['anon','authenticated'] loop
    foreach account_table in array array['curbside_accounts','curbside_vehicles','curbside_preferences','curbside_terms_acceptances','curbside_vehicle_snapshots'] loop
      if has_table_privilege(browser_role,'public.'||account_table,'SELECT,INSERT,UPDATE,DELETE') then
        raise exception '% retains table access to %',browser_role,account_table;
      end if;
      for protected_column in select column_name from information_schema.columns
        where table_schema='public' and table_name=account_table loop
        if has_column_privilege(browser_role,'public.'||account_table,protected_column.column_name,'SELECT,INSERT,UPDATE') then
          raise exception '% retains column access to %.%',browser_role,account_table,protected_column.column_name;
        end if;
      end loop;
    end loop;
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dc001","role":"authenticated"}',true);
do $$ begin
  begin
    perform * from public.curbside_vehicles;
    raise exception 'Legacy JWT can read cars';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname)
    values('193a2604-3ba1-4b61-9e9a-5276512dc001','FORGED','NY','Forged');
    raise exception 'Legacy JWT can insert through old column grants';
  exception when insufficient_privilege then null; end;
  begin
    update public.curbside_preferences set theme='light';
    raise exception 'Legacy JWT can update preferences';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.curbside_vehicles;
    raise exception 'Legacy JWT can delete cars';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
update public.curbside_vehicles set nickname='Renamed' where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001';
update public.curbside_preferences set theme='system' where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001';
do $$ begin
  if not exists(select 1 from public.curbside_vehicles where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001' and nickname='Renamed') then raise exception 'Scoped rename failed'; end if;
  if not exists(select 1 from public.curbside_vehicles where user_id='193a2604-3ba1-4b61-9e9a-5276512dc002' and nickname='Owner B') then raise exception 'Other owner changed'; end if;
  if not exists(select 1 from public.curbside_preferences where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001' and theme='system' and language='zh' and detail_mode='geek') then raise exception 'Own preferences lost'; end if;
  if not exists(select 1 from public.curbside_terms_acceptances where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001' and accepted_at='2026-09-30T12:00:00Z') then raise exception 'Original consent timestamp lost'; end if;
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname)
    values('193a2604-3ba1-4b61-9e9a-5276512dc001','RLSCHECK','NY','Duplicate');
    raise exception 'Duplicate per-owner identity allowed';
  exception when unique_violation then null; end;
end $$;
delete from public.curbside_accounts where clerk_user_id='user_sqlTestA';
do $$ begin
  if exists(select 1 from public.curbside_vehicles where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001')
    or exists(select 1 from public.curbside_preferences where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001')
    or exists(select 1 from public.curbside_terms_acceptances where user_id='193a2604-3ba1-4b61-9e9a-5276512dc001') then raise exception 'Deleted account retained private data'; end if;
  if not exists(select 1 from public.curbside_vehicles where user_id='193a2604-3ba1-4b61-9e9a-5276512dc002') then raise exception 'Other account cars removed'; end if;
end $$;
reset role;
rollback;
select 'PASS: browser grants revoked, service writes, per-owner uniqueness, preferences, original consent and deletion cascade' as result,
  (select count(*) from public.curbside_accounts where id in('193a2604-3ba1-4b61-9e9a-5276512dc001','193a2604-3ba1-4b61-9e9a-5276512dc002'))=0 as fixtures_rolled_back,
  (select bool_and(rowsecurity) from pg_tables where schemaname='public' and tablename in('curbside_accounts','curbside_vehicles','curbside_preferences','curbside_terms_acceptances')) as rls_enabled;
