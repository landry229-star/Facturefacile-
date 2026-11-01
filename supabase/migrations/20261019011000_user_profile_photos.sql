insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-profile-photos', 'user-profile-photos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile photos are publicly readable" on storage.objects;
create policy "profile photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'user-profile-photos');

drop policy if exists "users upload own profile photos" on storage.objects;
create policy "users upload own profile photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own profile photos" on storage.objects;
create policy "users update own profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own profile photos" on storage.objects;
create policy "users delete own profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'user-profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
