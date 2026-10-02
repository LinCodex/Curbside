begin;

-- Only keyed hashes and random nonces are stored. No plate, account ID, email,
-- raw IP or user-agent is included in this short-lived security ledger.
create table public.curbside_search_limits (
  actor_hash text primary key check (actor_hash ~ '^[0-9a-f]{64}$'),
  attempts timestamptz[] not null default '{}'
    check (cardinality(attempts) <= 60),
  searches timestamptz[] not null default '{}'
    check (cardinality(searches) <= 30),
  expires_at timestamptz not null
);
create index curbside_search_limits_expiry on public.curbside_search_limits(expires_at);
create table public.curbside_search_passes (
  id text primary key check (id ~ '^[0-9a-f]{32}$'),
  actor_hash text not null check (actor_hash ~ '^[0-9a-f]{64}$'),
  uses integer not null check (uses between 1 and 10),
  expires_at timestamptz not null
);
create index curbside_search_passes_expiry on public.curbside_search_passes(expires_at);
create table public.curbside_search_requests (
  nonce text primary key check (nonce ~ '^[0-9a-f]{32}$'),
  expires_at timestamptz not null
);
create index curbside_search_requests_expiry on public.curbside_search_requests(expires_at);

alter table public.curbside_search_limits enable row level security;
alter table public.curbside_search_passes enable row level security;
alter table public.curbside_search_requests enable row level security;
revoke all on public.curbside_search_limits, public.curbside_search_passes,
  public.curbside_search_requests from public, anon, authenticated;
grant select, insert, update, delete on public.curbside_search_limits,
  public.curbside_search_passes, public.curbside_search_requests to service_role;

-- Invoker rights plus explicit service-only grants. The Edge function verifies
-- a fresh HMAC signed body before calling this RPC with its internal credential.
create function public.curbside_search_verification(
  action_name text, actor_hash text, request_nonce text,
  pass_id text default null, pass_expiry timestamptz default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  stamp timestamptz := clock_timestamp();
  limits public.curbside_search_limits%rowtype;
  used_pass public.curbside_search_passes%rowtype;
  recent_attempts timestamptz[];
  recent_searches timestamptz[];
  nonce_added integer;
begin
  if action_name is null or action_name not in ('attempt','mint','consume')
    or actor_hash is null or actor_hash !~ '^[0-9a-f]{64}$'
    or request_nonce is null or request_nonce !~ '^[0-9a-f]{32}$'
    or (action_name <> 'attempt' and (pass_id is null or pass_id !~ '^[0-9a-f]{32}$'))
    or (action_name = 'mint' and (pass_expiry is null or pass_expiry <= stamp
      or pass_expiry > stamp + interval '5 minutes 30 seconds')) then
    raise exception 'Invalid verification request' using errcode='22023';
  end if;

  -- Indexed, bounded opportunistic cleanup keeps request transactions short.
  -- SKIP LOCKED avoids deleting or waiting on another active transaction's row.
  delete from public.curbside_search_requests where nonce in (
    select r.nonce from public.curbside_search_requests r
    where r.expires_at <= stamp order by r.expires_at limit 100 for update skip locked
  );
  delete from public.curbside_search_passes where id in (
    select p.id from public.curbside_search_passes p
    where p.expires_at <= stamp order by p.expires_at limit 100 for update skip locked
  );
  delete from public.curbside_search_limits l where l.actor_hash in (
    select b.actor_hash from public.curbside_search_limits b
    where b.expires_at <= stamp order by b.expires_at limit 100 for update skip locked
  );
  insert into public.curbside_search_requests(nonce,expires_at)
    values(request_nonce, stamp + interval '2 minutes') on conflict do nothing;
  get diagnostics nonce_added = row_count;
  if nonce_added = 0 then return jsonb_build_object('status','replay'); end if;

  -- One global lock per keyed IP makes the rolling windows and pass use count
  -- atomic across every Vercel instance and all Supabase function regions.
  perform pg_advisory_xact_lock(hashtextextended(actor_hash, 917463));
  -- Re-evaluate expiry after waiting for another request's lock.
  stamp := clock_timestamp();
  insert into public.curbside_search_limits(actor_hash,expires_at)
    values(actor_hash, stamp + interval '1 hour') on conflict do nothing;
  select * into limits from public.curbside_search_limits l
    where l.actor_hash = curbside_search_verification.actor_hash for update;
  select coalesce(array_agg(t),'{}'::timestamptz[]) into recent_attempts
    from unnest(limits.attempts) t where t > stamp - interval '1 hour';
  select coalesce(array_agg(t),'{}'::timestamptz[]) into recent_searches
    from unnest(limits.searches) t where t > stamp - interval '1 hour';

  if action_name = 'attempt' then
    if cardinality(recent_attempts) >= 60 or
      (select count(*) from unnest(recent_attempts) t where t > stamp - interval '1 minute') >= 20 then
      return jsonb_build_object('status','rate_limited');
    end if;
    update public.curbside_search_limits l set
      attempts = array_append(recent_attempts,stamp), searches = recent_searches,
      expires_at = stamp + interval '1 hour'
      where l.actor_hash = curbside_search_verification.actor_hash;
    return jsonb_build_object('status','ok');
  end if;
  if cardinality(recent_searches) >= 30 or
    (select count(*) from unnest(recent_searches) t where t > stamp - interval '1 minute') >= 5 then
    return jsonb_build_object('status','rate_limited');
  end if;

  if action_name = 'mint' then
    insert into public.curbside_search_passes(id,actor_hash,uses,expires_at)
      values(pass_id,actor_hash,1,pass_expiry) on conflict do nothing;
    if not found then return jsonb_build_object('status','replay'); end if;
  else
    select * into used_pass from public.curbside_search_passes p
      where p.id = pass_id for update;
    if not found or used_pass.actor_hash <> actor_hash or used_pass.expires_at <= stamp
      or used_pass.uses >= 10 then
      return jsonb_build_object('status','captcha_required');
    end if;
    update public.curbside_search_passes p set uses = p.uses + 1 where p.id = pass_id;
  end if;
  update public.curbside_search_limits l set
    attempts = recent_attempts, searches = array_append(recent_searches,stamp),
    expires_at = stamp + interval '1 hour'
    where l.actor_hash = curbside_search_verification.actor_hash;
  return jsonb_build_object('status','ok');
end;
$$;
revoke all on function public.curbside_search_verification(text,text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.curbside_search_verification(text,text,text,text,timestamptz) to service_role;

comment on table public.curbside_search_limits is 'Pseudonymous search security windows; expires after one hour, bounded cleanup on traffic.';
comment on table public.curbside_search_passes is 'Five-minute server-issued search passes, ten searches maximum; service-only.';
comment on table public.curbside_search_requests is 'Two-minute signed internal request replay protection; service-only.';
commit;
