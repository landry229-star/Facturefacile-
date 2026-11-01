alter table public.products add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable"
  on storage.objects for select using (bucket_id = 'product-images');

drop policy if exists "business members upload product images" on storage.objects;
create policy "business members upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members update product images" on storage.objects;
create policy "business members update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  )
  with check (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );

drop policy if exists "business members delete product images" on storage.objects;
create policy "business members delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.is_business_member((storage.foldername(name))[1]::uuid, 'member')
  );
