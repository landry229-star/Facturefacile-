insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'purchase-documents',
  'purchase-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.purchase_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entity_type text not null check (entity_type in ('purchase', 'supplier')),
  entity_id uuid not null,
  file_name text not null check (length(trim(file_name)) > 0),
  storage_path text not null unique,
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path like business_id::text || '/' || entity_type || '/' || entity_id::text || '/%')
);

create index if not exists purchase_documents_entity_idx
  on public.purchase_documents (business_id, entity_type, entity_id, created_at desc);
alter table public.purchase_documents enable row level security;

create or replace function public.validate_purchase_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'purchase-documents'
       and o.name = new.storage_path
  ) then
    raise exception 'Le fichier justificatif est introuvable dans le stockage privé.';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_purchase_document() from public, anon, authenticated;
drop trigger if exists validate_purchase_document on public.purchase_documents;
create trigger validate_purchase_document
  before insert on public.purchase_documents
  for each row execute function public.validate_purchase_document();

drop policy if exists "purchase members read documents" on public.purchase_documents;
create policy "purchase members read documents" on public.purchase_documents
  for select to authenticated using (public.can_manage_purchase(business_id, 'view'));

drop policy if exists "authorized users add purchase documents" on public.purchase_documents;
create policy "authorized users add purchase documents" on public.purchase_documents
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and case entity_type
      when 'purchase' then public.can_manage_purchase(business_id, 'create_purchase')
        and exists (
          select 1 from public.purchases p
           where p.id = purchase_documents.entity_id
             and p.business_id = purchase_documents.business_id
        )
      when 'supplier' then public.can_manage_purchase(business_id, 'manage_suppliers')
        and exists (
          select 1 from public.suppliers s
           where s.id = purchase_documents.entity_id
             and s.business_id = purchase_documents.business_id
        )
      else false
    end
  );
revoke all on public.purchase_documents from anon, authenticated;
grant select, insert on public.purchase_documents to authenticated;

drop policy if exists "business members read purchase documents" on storage.objects;
create policy "business members read purchase documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'purchase-documents'
    and public.can_manage_purchase((storage.foldername(name))[1]::uuid, 'view')
  );

drop policy if exists "authorized users upload purchase documents" on storage.objects;
create policy "authorized users upload purchase documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'purchase-documents'
    and case (storage.foldername(name))[2]
      when 'purchase' then public.can_manage_purchase((storage.foldername(name))[1]::uuid, 'create_purchase')
        and exists (
          select 1 from public.purchases p
           where p.id = (storage.foldername(name))[3]::uuid
             and p.business_id = (storage.foldername(name))[1]::uuid
        )
      when 'supplier' then public.can_manage_purchase((storage.foldername(name))[1]::uuid, 'manage_suppliers')
        and exists (
          select 1 from public.suppliers s
           where s.id = (storage.foldername(name))[3]::uuid
             and s.business_id = (storage.foldername(name))[1]::uuid
        )
      else false
    end
  );

drop policy if exists "authorized users clean up purchase documents" on storage.objects;
create policy "authorized users clean up purchase documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'purchase-documents'
    and not exists (
      select 1 from public.purchase_documents d
       where d.storage_path = storage.objects.name
    )
    and case (storage.foldername(name))[2]
      when 'purchase' then public.can_manage_purchase((storage.foldername(name))[1]::uuid, 'create_purchase')
      when 'supplier' then public.can_manage_purchase((storage.foldername(name))[1]::uuid, 'manage_suppliers')
      else false
    end
  );

notify pgrst, 'reload schema';
