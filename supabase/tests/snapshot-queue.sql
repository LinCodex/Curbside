-- Transaction-only fixtures: no emails, external fetches, or app seed records.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('193a2604-3ba1-4b61-9e9a-5276512dd001','snapshot-a@example.invalid',now()),
('193a2604-3ba1-4b61-9e9a-5276512dd002','snapshot-b@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dd001","role":"authenticated"}',true);
insert into public.curbside_terms_acceptances(user_id,version) values(auth.uid(),'2026-09-27.1');
insert into public.curbside_vehicles(user_id,plate,state,nickname,make) values(auth.uid(),'SHARECHECK','NY','My car','Owner A make');
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dd002","role":"authenticated"}',true);
insert into public.curbside_terms_acceptances(user_id,version) values(auth.uid(),'2026-09-27.1');
insert into public.curbside_vehicles(user_id,plate,state,nickname,make) values(auth.uid(),'SHARECHECK','NY','Other car','Owner B make');
update public.curbside_vehicles set color='Blue' where plate='SHARECHECK';
do $$ begin
  if (select count(*) from public.curbside_vehicle_snapshots where plate='SHARECHECK')<>1 then raise exception 'Shared snapshot absent'; end if;
  if (select count(*) from public.curbside_vehicles where plate='SHARECHECK')<>1 then raise exception 'Private cars leaked'; end if;
  if exists(select 1 from public.curbside_vehicles where make='Owner A make') then raise exception 'Other customer details leaked'; end if;
  if has_column_privilege('authenticated','public.curbside_vehicle_snapshots','lease','select') then raise exception 'Lease accessible'; end if;
  if has_function_privilege('authenticated','public.curbside_claim_snapshots(text)','execute') then raise exception 'Queue publicly callable'; end if;
  begin
    update public.curbside_vehicle_snapshots set payload='{}'::jsonb;
    raise exception 'Customer can forge history';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dd001","role":"authenticated"}',true);
do $$ begin
  if not exists(select 1 from public.curbside_vehicles where make='Owner A make' and color is null) then raise exception 'Shared private details'; end if;
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
  if public.curbside_verify_snapshot_cron(repeat('x',64)) then raise exception 'Invalid cron accepted'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dd001","role":"authenticated"}',true);
delete from public.curbside_vehicles where plate='SHARECHECK';
reset role;
do $$ begin
  if not exists(select 1 from public.curbside_vehicle_snapshots where plate='SHARECHECK') then raise exception 'One customer removed another history'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"193a2604-3ba1-4b61-9e9a-5276512dd002","role":"authenticated"}',true);
delete from public.curbside_vehicles where plate='SHARECHECK';
reset role;
do $$ begin
  if exists(select 1 from public.curbside_vehicle_snapshots where plate='SHARECHECK') then raise exception 'Unsubscribed history retained'; end if;
end $$;
-- Fill the pilot's 500 shared identities, then prove duplicate subscribers still work.
insert into public.curbside_vehicles(user_id,plate,state,nickname)
select '193a2604-3ba1-4b61-9e9a-5276512dd001','SIM'||lpad(i::text,6,'0'),'NY','Workload fixture'
from generate_series(1,500-(select count(*)::integer from public.curbside_vehicle_snapshots)) i;
insert into public.curbside_vehicles(user_id,plate,state,nickname)
values('193a2604-3ba1-4b61-9e9a-5276512dd002','SIM000001','NY','Second subscriber');
do $$ begin
  if (select count(*) from public.curbside_vehicle_snapshots)<>500 then raise exception 'Workload count incorrect'; end if;
  begin
    insert into public.curbside_vehicles(user_id,plate,state,nickname)
    values('193a2604-3ba1-4b61-9e9a-5276512dd001','SIMOVER','NY','Capacity overflow');
    raise exception 'Capacity overflow allowed' using errcode='XX000';
  exception when raise_exception then null; end;
end $$;
rollback;
select 'PASS: shared histories, private details, owner access, leases, retries, last-subscriber cleanup, 500-identity workload' as result;
