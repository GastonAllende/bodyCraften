-- Custom-exercise image storage: bucket + object-level RLS.
--
-- Same rationale as supabase/storage-rls.sql: uploads/downloads for this
-- bucket go through Supabase's Storage API (not the direct DATABASE_URL/
-- Drizzle path), which does honor auth.uid() from the caller's session.
-- These policies are the real enforcement boundary for this bucket.
--
-- Path convention: exercise-images/<user_id>/<uuid>.<ext> — the first path
-- segment is the owning user, which is what the policies key off.
--
-- Already applied to the live Supabase project via the Supabase MCP
-- (migration `exercise_images_storage`) — this file is the checked-in record.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-images', 'exercise-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "exercise_images_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "exercise_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "exercise_images_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
