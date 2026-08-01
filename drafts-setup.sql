-- =====================================================================
--  Unfinished checklists (drafts)
--
--  Drafts move from browser storage into the database so they can be
--  listed in the app, resumed on any device, and cleaned up automatically.
--
--  When a draft is deleted (by hand or by the 30-day job) we also remove:
--    * any screenshots uploaded while working on it, and
--    * the reuse-detection hashes recorded for those screenshots,
--  so that re-using one of those images later is NOT wrongly flagged.
-- =====================================================================

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  checklist_id uuid,
  checklist_title text not null,
  pm_name text,
  property_address text,
  state jsonb not null default '[]'::jsonb,   -- per-step progress
  uploaded_paths text[] default '{}',         -- screenshots stored so far
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists drafts_user_idx on drafts (user_id);
create index if not exists drafts_updated_idx on drafts (updated_at);

alter table drafts enable row level security;

-- A PM works with their own drafts; the boss can see and clear any of them.
create policy "insert own drafts"
  on drafts for insert to authenticated
  with check (user_id = auth.uid());

create policy "read own drafts or boss reads all"
  on drafts for select to authenticated
  using (user_id = auth.uid() or is_boss());

create policy "update own drafts or boss"
  on drafts for update to authenticated
  using (user_id = auth.uid() or is_boss());

create policy "delete own drafts or boss"
  on drafts for delete to authenticated
  using (user_id = auth.uid() or is_boss());

-- ---------------------------------------------------------------------
--  Link hashes to the draft that created them.
--  While a checklist is unfinished its hashes belong to the draft. On
--  submission the link is cleared, which makes those hashes permanent.
-- ---------------------------------------------------------------------
alter table screenshot_hashes
  add column if not exists draft_id uuid references drafts(id) on delete cascade;

create index if not exists screenshot_hashes_draft_idx on screenshot_hashes (draft_id);

-- ---------------------------------------------------------------------
--  Clean up drafts left unfinished for 30 days.
-- ---------------------------------------------------------------------
create or replace function delete_stale_drafts()
returns void
language plpgsql
security definer
as $$
declare
  stale_paths text[];
begin
  -- Gather every screenshot path belonging to drafts that are 30+ days old.
  select coalesce(array_agg(p), '{}'::text[])
    into stale_paths
  from drafts d, unnest(d.uploaded_paths) as p
  where d.updated_at < now() - interval '30 days';

  -- Remove those image files from storage.
  if array_length(stale_paths, 1) is not null then
    delete from storage.objects
    where bucket_id = 'screenshots' and name = any(stale_paths);
  end if;

  -- Deleting the drafts cascades to their screenshot_hashes rows, so those
  -- images won't trigger a false "already used before" flag in future.
  delete from drafts where updated_at < now() - interval '30 days';
end;
$$;

-- Run daily at 03:30 UTC (just after the 12-month screenshot job).
do $$
begin
  perform cron.unschedule('delete-stale-drafts');
exception when others then
  null;
end $$;

select cron.schedule(
  'delete-stale-drafts',
  '30 3 * * *',
  $$ select delete_stale_drafts(); $$
);
