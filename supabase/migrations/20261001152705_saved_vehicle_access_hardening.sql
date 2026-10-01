begin;
alter policy "Record own acceptance" on public.curbside_terms_acceptances
with check ((select auth.uid()) = user_id
  and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true');
alter policy "Save own car after accepting terms" on public.curbside_vehicles
with check ((select auth.uid()) = user_id
  and coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'true'
  and exists (select 1 from public.curbside_terms_acceptances t
    where t.user_id = (select auth.uid()) and t.version = '2026-09-27.1'));
-- This event-trigger helper runs during DDL, never through the customer API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
commit;
