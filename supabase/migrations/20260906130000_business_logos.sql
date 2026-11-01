alter table public.businesses add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "business logos are publicly readable" on storage.objects;
create policy "business logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'business-logos');

drop policy if exists "business owners upload logos" on storage.objects;
create policy "business owners upload logos"
  on storage.objects for insert
  with check (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  );

drop policy if exists "business owners update logos" on storage.objects;
create policy "business owners update logos"
  on storage.objects for update
  using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  );

drop policy if exists "business owners delete logos" on storage.objects;
create policy "business owners delete logos"
  on storage.objects for delete
  using (
    bucket_id = 'business-logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b where b.owner_id = auth.uid()
    )
  );
