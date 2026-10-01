-- Run after the Clerk cutover migration. Transaction-only fixtures: no
-- identity provider requests, emails or external fetches. Everything rolls back.
begin;
set local role service_role;
insert into public.curbside_accounts(id,clerk_user_id) values
('193a2604-3ba1-4b61-9e9a-5276512dd001','user_snapshotA'),
('193a2604-3ba1-4b61-9e9a-5276512dd002','user_snapshotB');
insert into public.curbside_vehicles(user_id,plate,state,nickname,make) values
('193a2604-3ba1-4b61-9e9a-5276512dd001','SHARECHECK','NY','My car','Owner A make'),
('193a2604-3ba1-4b61-9e9a-5276512dd002','SHARECHECK','NY','Other car','Owner B make');
update public.curbside_vehicles set color='Blue' where user_id='193a2604-3ba1-4b61-9e9a-5276512dd002' and plate='SHARECHECK';
do $$ begin
  if (select count(*) from public.curbside_vehicle_snapshots where plate='SHARECHECK')<>1 then raise exception 'Shared snapshot absent'; end if;
  if not exists(select 1 from public.curbside_vehicles where user_id='193a2604-3ba1-4b61-9e9a-5276512dd001' and make='Owner A make' and color is null) then raise exception 'Other owner details changed'; end if;
end $$;
reset role;
do $$ declare browser_role text; begin
  foreach browser_role in array array['anon','authenticated'] loop
    if has_table_privilege(browser_role,'public.curbside_vehicle_snapshots','SELECT,INSERT,UPDATE,DELETE')
      or has_any_column_privilege(browser_role,'public.curbside_vehicle_snapshots','SELECT,INSERT,UPDATE') then raise exception 'Browser can access histories or leases'; end if;
    if has_function_privilege(browser_role,'public.curbside_claim_snapshots(text)','execute')
      or has_function_privilege(browser_role,'public.curbside_finish_snapshot(text,uuid,jsonb,boolean)','execute') then raise exception 'Queue publicly callable'; end if;
  end loop;
end $$;
set local role authenticated;
do $$ begin
  begin
    update public.curbside_vehicle_snapshots set payload='{}'::jsonb;
    raise exception 'Customer can forge history';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare job public.curbside_vehicle_snapshots; begin
  select * into job from public.curbside_claim_snapshots('NY:SHARECHECK:*');
  if job.lease is null then raise exception 'Job unclaimed'; end if;
  if exists(select 1 from public.curbside_claim_snapshots('NY:SHARECHECK:*')) then raise exception 'Duplicate claim'; end if;
  if public.curbside_finish_snapshot(job.key,gen_random_uuid(),null,false) then raise exception 'Stale worker overwrote'; end if;
  if not public.curbside_finish_snapshot(job.key,job.lease,null,false) then raise exception 'Failure completion failed'; end if;
  if not exists(select 1 from public.curbside_vehicle_snapshots where key=job.key and status='retry' and next_check_at>now()) then raise exception 'Failure not delayed'; end if;
end $$;
-- Account deletion uses the Clerk mapping and retains a shared history while
-- another account still has the same city-record identity saved.
delete from public.curbside_accounts where clerk_user_id='user_snapshotA';
do $$ begin
  if not exists(select 1 from public.curbside_vehicle_snapshots where plate='SHARECHECK') then raise exception 'One account removed another history'; end if;
end $$;
delete from public.curbside_vehicles where user_id='193a2604-3ba1-4b61-9e9a-5276512dd002' and plate='SHARECHECK';
do $$ begin
  if exists(select 1 from public.curbside_vehicle_snapshots where plate='SHARECHECK') then raise exception 'Unsubscribed history retained'; end if;
end $$;
-- Fill the pilot's 500 shared identities, then prove duplicate subscribers still work.
insert into public.curbside_accounts(id,clerk_user_id) values
('193a2604-3ba1-4b61-9e9a-5276512dd001','user_snapshotA');
insert into public.curbside_vehicles(user_id,plate,state,nickname)
select '193a2604-3ba1-4b61-9e9a-5276512dd001','SIM'||lpad(i::text,6,'0'),'NY','Workload fixture'
from generate_series(1,500-(select count(*)::integer from public.curbside_vehicle_snapshots)) i;
insert into public.curbside_vehicles(user_id,plate,state,plate_type,nickname)
select '193a2604-3ba1-4b61-9e9a-5276512dd002',plate,state,plate_type,'Second subscriber'
from public.curbside_vehicle_snapshots s
where not exists(select 1 from public.curbside_vehicles v where v.user_id='193a2604-3ba1-4b61-9e9a-5276512dd002' and v.plate=s.plate and v.state=s.state and v.plate_type=s.plate_type)
order by key limit 1;
do $$ begin
  if (select count(*) from public.curbside_vehicle_snapshots)<>500 then raise exception 'Workload count incorrect'; end if;
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname)
    values('193a2604-3ba1-4b61-9e9a-5276512dd001','SIMOVER','NY','Capacity overflow');
    raise exception 'Capacity overflow allowed' using errcode='XX000';
  exception when raise_exception then null; end;
end $$;
reset role;
rollback;
select 'PASS: service-only queue, shared histories, private details, leases, retries, Clerk deletion, last-subscriber cleanup, 500-identity workload' as result;
