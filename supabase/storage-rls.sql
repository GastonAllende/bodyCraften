-- Body-photo storage: bucket + object-level RLS.
--
-- Unlike supabase/rls.sql, this one is *not* defense-in-depth — photo
-- uploads/downloads go through Supabase's Storage API (not the direct
-- DATABASE_URL/Drizzle path), which does honor auth.uid() from the caller's
-- session. These policies are the real enforcement boundary for this bucket.
--
-- Path convention: body-photos/<user_id>/<uuid>.<ext> — the first path
-- segment is the owning user, which is what the policies key off.
--
-- Already applied to the live Supabase project via the Supabase MCP
-- (migration `body_photos_storage`) — this file is the checked-in record.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('body-photos', 'body-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "body_photos_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "body_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'body-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "body_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
