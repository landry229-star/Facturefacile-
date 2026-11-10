-- Limit the temporary pre-launch IFU demo registry to authenticated business owners.
-- The registry contains synthetic data only and must be emptied before public launch.
comment on table public.dgi_mock_ifu_registry is
  'Registre temporaire de pré-lancement réservé aux données IFU synthétiques; vider avant ouverture au public et ne jamais y importer de données DGI réelles.';

drop policy if exists "authenticated users read mock IFU registry"
  on public.dgi_mock_ifu_registry;
drop policy if exists "business owners read mock IFU registry"
  on public.dgi_mock_ifu_registry;

create policy "business owners read mock IFU registry"
  on public.dgi_mock_ifu_registry
  for select
  to authenticated
  using (exists (
    select 1
    from public.businesses b
    where b.owner_id = auth.uid()
  ));
