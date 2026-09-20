-- Schedules live in the database (pg_cron + pg_net) because GitHub Actions never fired its cron.
-- The bearer token is generated here and kept in Vault; the app reads it through cron_token() (service role only).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_secret', 'Bearer token for /api/cron/* routes, generated in-db');

create or replace function public.cron_token() returns text
language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
$$;
revoke all on function public.cron_token() from public, anon, authenticated;
grant execute on function public.cron_token() to service_role;

-- One helper that reads the secret from Vault and fires the request. Fire-and-forget; the route does the work.
create or replace function public.call_cron(path text) returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare s text; rid bigint;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select net.http_get(url := 'https://rails-psi.vercel.app' || path,
                      headers := jsonb_build_object('Authorization', 'Bearer ' || s),
                      timeout_milliseconds := 300000) into rid;
  return rid;
end $$;
revoke all on function public.call_cron(text) from public, anon, authenticated;

select cron.schedule('rails-poll',      '5 * * * *',    $$select public.call_cron('/api/cron/poll?limit=40')$$);
select cron.schedule('rails-tag',       '*/10 * * * *', $$select public.call_cron('/api/cron/tag')$$);
select cron.schedule('rails-tag-batch', '0 7 * * *',    $$select public.call_cron('/api/cron/tag-batch?max=3000')$$);

-- Check: select jobid, jobname, schedule, active from cron.job;  recent runs: select * from cron.job_run_details order by start_time desc limit 20;
