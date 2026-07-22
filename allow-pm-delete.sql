-- =====================================================================
--  Allow PMs to delete their OWN submissions.
--  (The boss can already delete any submission via the earlier
--   "boss can delete" policy. This adds PM self-delete on top.)
-- =====================================================================

create policy "pm can delete own submissions"
  on submissions for delete
  to authenticated
  using (user_id = auth.uid());
