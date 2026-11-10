-- TEST ONLY: deterministic fictional business data for the two existing
-- FactureFacile test accounts. This script never targets production.
-- Re-runs leave inserted records unchanged.
begin;

do $$
begin
  if not exists (
    select 1
    from public.businesses b
    join auth.users u on u.id = b.owner_id
    where b.id = '7f7d18f9-f642-4684-9ff3-1b758726f322'
      and lower(u.email) = 'azoganlandry3@gmail.com'
  ) then
    raise exception 'Le compte de test Atelier Soleil est introuvable; aucune donnée n’a été ajoutée.';
  end if;

  if not exists (
    select 1
    from public.businesses b
    join auth.users u on u.id = b.owner_id
    where b.id = 'afeca247-45e8-4e0f-bfec-442d3145a6cc'
      and lower(u.email) = 'lovematin295@gmail.com'
  ) then
    raise exception 'Le compte de test Boutique Baobab est introuvable; aucune donnée n’a été ajoutée.';
  end if;

  if not exists (
    select 1
    from auth.users
    where lower(email) = 'lovematin295@gmail.com'
  ) then
    raise exception 'Le compte super-administrateur de test est introuvable; aucune donnée n’a été ajoutée.';
  end if;
end;
$$;

update public.businesses
set name = 'TEST - Atelier Soleil (FICTIF)'
where id = '7f7d18f9-f642-4684-9ff3-1b758726f322';

update public.businesses
set name = 'TEST - Boutique Baobab (FICTIF)'
where id = 'afeca247-45e8-4e0f-bfec-442d3145a6cc';

-- Reset the previously seeded Pro trial on the platform-admin account.
update public.business_subscriptions
set plan = 'free',
    status = 'active',
    expires_at = null
where business_id = 'afeca247-45e8-4e0f-bfec-442d3145a6cc'
  and plan = 'pro'
  and status = 'trialing'
  and not exists (
    select 1
    from public.platform_admins pa
    join public.businesses b on b.owner_id = pa.user_id
    where b.id = 'afeca247-45e8-4e0f-bfec-442d3145a6cc'
  );

-- Only the explicitly designated demo account receives an unlimited Pro trial.
-- New businesses are initialized on Free by initialize_business_subscription.
-- Bypass only the expiration-default trigger for this test fixture; the global
-- 31-day expiration rule remains enabled for all other subscription changes.
alter table public.business_subscriptions
  disable trigger ensure_subscription_expiration_trigger;

update public.business_subscriptions
set plan = 'pro',
    status = 'trialing',
    expires_at = null
where business_id = '7f7d18f9-f642-4684-9ff3-1b758726f322'
  and (
    plan <> 'pro'
    or status <> 'trialing'
    or expires_at is not null
  );

alter table public.business_subscriptions
  enable trigger ensure_subscription_expiration_trigger;

insert into public.platform_admins (user_id, role, status)
select id, 'super_admin', 'active'
from auth.users
where lower(email) = 'lovematin295@gmail.com'
on conflict (user_id) do update
set role = 'super_admin',
    status = 'active';

insert into public.clients (id, business_id, name, phone, email, address, client_type, notes)
values
  ('a1000000-0000-4000-8000-000000000001', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'FICTIF - Awa Kossi', '+229 01 00 00 01', 'awa.kossi@example.test', 'Adresse fictive, Cotonou', 'individual', 'Donnée de démonstration uniquement.'),
  ('a1000000-0000-4000-8000-000000000002', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'FICTIF - Atelier Mèches', '+229 01 00 00 02', 'atelier.meches@example.test', 'Adresse fictive, Abomey-Calavi', 'company', 'Donnée de démonstration uniquement.'),
  ('a2000000-0000-4000-8000-000000000001', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'FICTIF - Jonas Hounkpe', '+229 01 00 00 03', 'jonas.hounkpe@example.test', 'Adresse fictive, Porto-Novo', 'individual', 'Donnée de démonstration uniquement.'),
  ('a2000000-0000-4000-8000-000000000002', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'FICTIF - Papeterie Arc-en-ciel', '+229 01 00 00 04', 'papeterie.arc@example.test', 'Adresse fictive, Parakou', 'company', 'Donnée de démonstration uniquement.')
on conflict (id) do nothing;

insert into public.products (id, business_id, name, description, price, purchase_price, unit, product_type, reference, category)
values
  ('b1000000-0000-4000-8000-000000000001', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'FICTIF - Conseil informatique', 'Prestation de démonstration', 12500, 0, 'heure', 'service', 'TEST-SVC-001', 'other'),
  ('b1000000-0000-4000-8000-000000000002', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'FICTIF - Assistance technique', 'Prestation de démonstration', 15000, 0, 'forfait', 'service', 'TEST-SVC-002', 'other'),
  ('b2000000-0000-4000-8000-000000000001', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'FICTIF - Fournitures de bureau', 'Article de démonstration', 45000, 28000, 'lot', 'product', 'TEST-PRD-001', 'other'),
  ('b2000000-0000-4000-8000-000000000002', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'FICTIF - Impression de documents', 'Prestation de démonstration', 18000, 0, 'forfait', 'service', 'TEST-SVC-003', 'other')
on conflict (id) do nothing;

insert into public.invoices (
  id, business_id, client_id, invoice_number, currency, invoice_type,
  issue_date, due_date, status, subtotal, discount, tax, total,
  reg_fiscal_emetteur, benin_document_type
)
values
  ('c1000000-0000-4000-8000-000000000001', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'a1000000-0000-4000-8000-000000000001', 'TEST-2026-0001', 'XOF', 'STANDARD', current_date - 5, current_date + 10, 'PAID', 25000, 0, 0, 25000, 'TPS', 'recu_vente'),
  ('c1000000-0000-4000-8000-000000000002', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'a1000000-0000-4000-8000-000000000002', 'TEST-2026-0002', 'XOF', 'PROFORMA', current_date, current_date + 14, 'DRAFT', 15000, 0, 0, 15000, 'TPS', 'proforma'),
  ('c1000000-0000-4000-8000-000000000003', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'a1000000-0000-4000-8000-000000000001', 'TEST-2026-0003', 'XOF', 'STANDARD', current_date - 1, current_date + 14, 'SENT', 12500, 0, 0, 12500, null, 'facture_interne'),
  ('c2000000-0000-4000-8000-000000000001', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'a2000000-0000-4000-8000-000000000001', 'TEST-2026-0001', 'XOF', 'STANDARD', current_date - 3, current_date + 12, 'PAID', 45000, 0, 0, 45000, 'REEL', 'recu_vente'),
  ('c2000000-0000-4000-8000-000000000002', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'a2000000-0000-4000-8000-000000000002', 'TEST-2026-0002', 'XOF', 'STANDARD', current_date, current_date + 14, 'DRAFT', 18000, 0, 0, 18000, 'REEL', 'facture_interne')
on conflict (id) do nothing;

insert into public.invoice_items (id, invoice_id, product_id, description, quantity, unit_price)
values
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'FICTIF - Conseil informatique', 2, 12500),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'FICTIF - Assistance technique', 1, 15000),
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'FICTIF - Conseil informatique', 1, 12500),
  ('d2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'FICTIF - Fournitures de bureau', 1, 45000),
  ('d2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'FICTIF - Impression de documents', 1, 18000)
on conflict (id) do nothing;

insert into public.payments (id, business_id, invoice_id, amount, payment_date, method, reference, status)
values
  ('e1000000-0000-4000-8000-000000000001', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'c1000000-0000-4000-8000-000000000001', 25000, current_date - 2, 'cash', 'TEST-PAIEMENT-001', 'reconciled'),
  ('e2000000-0000-4000-8000-000000000001', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'c2000000-0000-4000-8000-000000000001', 45000, current_date - 1, 'cash', 'TEST-PAIEMENT-002', 'reconciled')
on conflict (id) do nothing;

insert into public.expenses (id, business_id, label, amount, expense_date, category, notes, supplier_name, payment_method)
values
  ('f1000000-0000-4000-8000-000000000001', '7f7d18f9-f642-4684-9ff3-1b758726f322', 'FICTIF - Connexion internet', 8000, current_date - 2, 'other', 'Dépense de démonstration uniquement.', 'FICTIF - Fournisseur test', 'cash'),
  ('f2000000-0000-4000-8000-000000000001', 'afeca247-45e8-4e0f-bfec-442d3145a6cc', 'FICTIF - Achat de fournitures', 12000, current_date - 1, 'other', 'Dépense de démonstration uniquement.', 'FICTIF - Fournisseur test', 'cash')
on conflict (id) do nothing;

commit;
