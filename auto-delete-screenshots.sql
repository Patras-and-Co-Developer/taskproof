-- =====================================================================
--  Auto-delete stored screenshots older than 12 months.
--
--  Why: screenshots are evidence for recent accountability. After a year
--  they're rarely needed, and removing them keeps storage bounded.
--  The reuse-detection HASH stays forever (in screenshot_hashes), so
--  reused-image detection still works on old images — only the picture
--  file is removed.
--
--  This uses Supabase's built-in scheduler (pg_cron) plus the storage
--  API. Run this whole file once in the SQL Editor.
-- =====================================================================

-- 1. Make sure the scheduler extension is available.
create extension if not exists pg_cron;

-- 2. A function that deletes screenshot objects older than 12 months.
--    storage.objects has a created_at column we can filter on.
create or replace function delete_old_screenshots()
returns void
language plpgsql
security definer
as $$
begin
  delete from storage.objects
  where bucket_id = 'screenshots'
    and created_at < now() - interval '12 months';
end;
$$;

-- 3. Schedule it to run once a day at 03:00 UTC (a quiet time).
--    If a job with this name already exists, unschedule it first so this
--    file is safe to re-run.
do $$
begin
  perform cron.unschedule('delete-old-screenshots');
exception when others then
  -- no existing job to remove; ignore
  null;
end $$;

select cron.schedule(
  'delete-old-screenshots',
  '0 3 * * *',                       -- every day at 03:00 UTC
  $$ select delete_old_screenshots(); $$
);
