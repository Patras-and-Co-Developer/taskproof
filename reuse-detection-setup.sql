-- =====================================================================
--  Reuse detection — stores a fingerprint (hash) of every screenshot
--  so the app can tell if an image has been submitted before.
-- =====================================================================

create table if not exists screenshot_hashes (
  id uuid primary key default gen_random_uuid(),
  hash text not null,                       -- the image fingerprint
  property_address text,                    -- which property it was used for
  step_text text,                           -- which step it was used for
  user_id uuid default auth.uid(),          -- who uploaded it
  created_at timestamptz default now()
);

-- Fast lookups when checking "have we seen this hash before?"
create index if not exists screenshot_hashes_hash_idx on screenshot_hashes (hash);

-- Security: signed-in users may add a hash and check for matches.
alter table screenshot_hashes enable row level security;

-- Anyone signed in can INSERT their own hash record.
create policy "insert own hashes"
  on screenshot_hashes for insert
  to authenticated
  with check (user_id = auth.uid());

-- Anyone signed in can READ hashes — needed so the app can check for a
-- prior match across all PMs (a reused screenshot might be someone else's).
-- Only the hash string is exposed, not the image itself.
create policy "read all hashes"
  on screenshot_hashes for select
  to authenticated
  using (true);
