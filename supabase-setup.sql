-- Stores every completed checklist submission
create table submissions (
  id uuid primary key default gen_random_uuid(),
  checklist_title text not null,
  pm_name text not null,
  property_address text not null,
  results jsonb not null,
  needs_review boolean not null default false,
  created_at timestamptz default now()
);

-- Temporary: allow anyone to read/write while there's no login system yet.
-- We will replace this with real rules once boss/PM logins exist.
alter table submissions enable row level security;

create policy "temporary open access"
  on submissions
  for all
  using (true)
  with check (true);
