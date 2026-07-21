-- =====================================================================
--  TaskProof — login & roles setup
--  Run this in the Supabase SQL Editor after the first setup SQL.
-- =====================================================================

-- 1. Add a column that records WHICH user created each submission.
--    It fills in automatically with the signed-in user's id.
alter table submissions
  add column if not exists user_id uuid default auth.uid();

-- 2. Remove the temporary "anyone can do anything" policy.
drop policy if exists "temporary open access" on submissions;

-- 3. A helper that returns true if the signed-in user is the boss.
--    Reads the role we set on the account when creating the user.
create or replace function is_boss()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'boss',
    false
  );
$$;

-- 4. INSERT: any signed-in user may add a submission, but only as themselves.
create policy "insert own submissions"
  on submissions for insert
  to authenticated
  with check (user_id = auth.uid());

-- 5. SELECT: the boss sees everything; a PM sees only their own rows.
create policy "read own or boss reads all"
  on submissions for select
  to authenticated
  using (user_id = auth.uid() or is_boss());

-- 6. UPDATE / DELETE: boss only. PMs cannot change submitted checklists.
create policy "boss can update"
  on submissions for update
  to authenticated
  using (is_boss());

create policy "boss can delete"
  on submissions for delete
  to authenticated
  using (is_boss());
