create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;

drop policy if exists "members read their memberships" on public.business_members;
create policy "members read their memberships" on public.business_members
  for select using (user_id = auth.uid() or exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "owners manage memberships" on public.business_members;
create policy "owners manage memberships" on public.business_members
  for all using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));

drop policy if exists "owners manage invitations" on public.business_invitations;
create policy "owners manage invitations" on public.business_invitations
  for all using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));
