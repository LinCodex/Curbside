begin;
grant update(nickname,make,model,year,color) on public.curbside_vehicles to authenticated;
select cron.alter_job(
  (select jobid from cron.job where jobname='curbside-saved-history-morning'),
  command:=$cron$
    select net.http_post(
      url:='https://wkuvihaiacfcqctwolqu.supabase.co/functions/v1/vehicle-snapshots',
      headers:=jsonb_build_object('Content-Type','application/json','x-curbside-cron',
        (select decrypted_secret from vault.decrypted_secrets where name='curbside_snapshot_cron')),
      body:='{"mode":"cron"}'::jsonb,timeout_milliseconds:=15000
    ) where exists(select 1 from public.curbside_vehicle_snapshots
      where next_check_at<=now() and (lease_until is null or lease_until<now()));
  $cron$
);
commit;
