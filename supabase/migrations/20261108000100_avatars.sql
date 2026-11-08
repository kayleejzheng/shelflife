-- Fix "new row violates row-level security policy" when uploading a profile photo.
-- Paste into Supabase -> SQL Editor -> Run. Safe to run more than once.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

drop policy if exists "avatar upload" on storage.objects;
drop policy if exists "avatar update" on storage.objects;
drop policy if exists "avatar read" on storage.objects;
drop policy if exists "avatar delete" on storage.objects;

-- Anyone signed in can upload into their own folder: avatars/<their user id>/...
create policy "avatar upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- Uploads need read access to the bucket too
create policy "avatar read" on storage.objects for select
  using (bucket_id = 'avatars');
