begin;

create table public.curbside_terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null check (version = '2026-09-27.1'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

create table public.curbside_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plate text not null check (plate ~ '^[A-Z0-9]{1,10}$'),
  state text not null check (state = any (string_to_array('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP AB BC MB NB NL NS NT NU ON PE QC SK YT', ' '))),
  plate_type text not null default '' check (plate_type ~ '^([A-Z0-9]{1,5})?$'),
  nickname text not null check (char_length(btrim(nickname)) between 1 and 60),
  make text check (char_length(make) <= 80),
  model text check (char_length(model) <= 80),
  year integer check (year between 1886 and 2100),
  color text check (char_length(color) <= 80),
  created_at timestamptz not null default now(),
  unique (user_id, plate, state, plate_type)
);

alter table public.curbside_vehicles enable row level security;
alter table public.curbside_terms_acceptances enable row level security;

create policy "Read own acceptances" on public.curbside_terms_acceptances for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Record own acceptance" on public.curbside_terms_acceptances for insert to authenticated
with check ((select auth.uid()) = user_id and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true');
create policy "Read own cars" on public.curbside_vehicles for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Save own car after accepting terms" on public.curbside_vehicles for insert to authenticated
with check ((select auth.uid()) = user_id
  and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
  and exists (select 1 from public.curbside_terms_acceptances t where t.user_id = (select auth.uid()) and t.version = '2026-09-27.1'));
create policy "Edit own car" on public.curbside_vehicles for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Remove own car" on public.curbside_vehicles for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.curbside_vehicles from anon, authenticated;
revoke all on public.curbside_terms_acceptances from anon, authenticated;
grant select, delete on public.curbside_vehicles to authenticated;
grant insert (user_id, plate, state, plate_type, nickname, make, model, year, color) on public.curbside_vehicles to authenticated;
grant update (nickname) on public.curbside_vehicles to authenticated;
grant select on public.curbside_terms_acceptances to authenticated;
grant insert (user_id, version) on public.curbside_terms_acceptances to authenticated;

comment on table public.curbside_vehicles is 'Private saved cars only. Saving does not start monitoring or store violation results.';
comment on table public.curbside_terms_acceptances is 'Versioned acceptance with database timestamps. Customers cannot edit historical acceptance records.';
commit;
