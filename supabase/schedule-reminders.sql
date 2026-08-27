-- ===========================================================================
-- Run this ONCE in the Supabase SQL editor to start sending push reminders.
--
-- It is not applied automatically because it needs the service role key, which
-- is a secret. Everything else (tables, RLS, RPCs, the send-reminders Edge
-- Function) is already deployed.
--
-- Find your service role key at:
--   Dashboard -> Project Settings -> API -> service_role
-- Never put that key in the app bundle or commit it — it bypasses RLS.
-- ===========================================================================

-- 1. Extensions: pg_cron schedules the job, pg_net makes the HTTP call.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2. Store the service role key in Vault, so the cron job never inlines it.
--    Replace the placeholder below before running.
select vault.create_secret(
  'PeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Y2tzcmFubGl3aXFpYmZ3c25iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY3MTI3NCwiZXhwIjoyMTAxMjQ3Mjc0fQ.Vc7ngmcbbFmPKDS9mY8HbNdkB2KxzJ1tOVmlYg8_HPA',
  'service_role_key',
  'Used by the reminder cron to call the send-reminders Edge Function'
);

-- 3. Call the Edge Function every 5 minutes. Reminders have minute precision,
--    so a 5-minute cadence keeps them punctual without hammering the function.
select cron.schedule(
  'send-chore-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://beujbhpsmapqbwfupkyw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- Checking on it afterwards
-- ---------------------------------------------------------------------------
-- Scheduled jobs:
--   select jobid, schedule, jobname, active from cron.job;
--
-- Recent runs:
--   select status, return_message, start_time
--   from cron.job_run_details
--   order by start_time desc
--   limit 10;
--
-- What the server thinks is due right now:
--   select * from public.due_reminders();
--
-- Stop sending:
--   select cron.unschedule('send-chore-reminders');
