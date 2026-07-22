-- =====================================================================
--  Checklists live in the database so the boss can edit them and the
--  changes persist. Each checklist stores its groups + steps as JSON.
-- =====================================================================

create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  groups jsonb not null default '[]'::jsonb,   -- [{ name, steps: [{ text, evidence }] }]
  sort_order int default 0,                    -- controls display order
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table checklists enable row level security;

-- Everyone signed in can READ checklists (PMs need them to do tasks).
create policy "anyone signed in can read checklists"
  on checklists for select
  to authenticated
  using (true);

-- Only the boss can create, edit, or delete checklists.
create policy "boss can insert checklists"
  on checklists for insert
  to authenticated
  with check (is_boss());

create policy "boss can update checklists"
  on checklists for update
  to authenticated
  using (is_boss());

create policy "boss can delete checklists"
  on checklists for delete
  to authenticated
  using (is_boss());
