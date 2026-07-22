-- =====================================================================
--  Screenshot storage
--  We store the actual image ONLY for steps that were flagged or
--  PM-confirmed (the ones a human might review). Clean passes aren't stored.
--  The reuse-detection hash is stored separately and kept forever.
-- =====================================================================

-- 1. Create a private storage bucket named "screenshots".
--    (You can also do this in the dashboard: Storage -> New bucket ->
--     name "screenshots", keep it PRIVATE / not public.)
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

-- 2. Access rules for the bucket.

-- Signed-in users may UPLOAD screenshots (PMs completing steps).
create policy "authenticated can upload screenshots"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'screenshots');

-- Reading: the boss can view any screenshot; a PM can view ones they
-- uploaded. We tie ownership via the object's owner (set automatically
-- to the uploader).
create policy "boss or owner can read screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'screenshots'
    and (is_boss() or owner = auth.uid())
  );

-- Deleting (used later by the auto-delete job and by the boss).
create policy "boss can delete screenshots"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'screenshots' and is_boss());
