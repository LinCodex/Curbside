-- Run in the authorized Supabase SQL editor. Save the JSON value locally to
-- ignored work/legacy-users.json. It contains sensitive password hashes.
-- Freeze old registrations/writes before taking the final export.
select coalesce(json_agg(json_build_object(
  'id', u.id, 'email', u.email, 'email_confirmed_at', u.email_confirmed_at,
  'encrypted_password', u.encrypted_password, 'is_anonymous', u.is_anonymous,
  'legal_accepted_at', t.accepted_at
) order by u.created_at), '[]'::json) as legacy_users
from auth.users u
left join public.curbside_terms_acceptances t on t.user_id=u.id and t.version='2026-09-27.1';
