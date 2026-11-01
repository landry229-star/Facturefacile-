-- À exécuter dans Supabase SQL Editor avec deux utilisateurs de test.
-- Ces requêtes doivent retourner zéro ligne pour l'utilisateur B.
-- Remplacer les UUID par ceux des comptes de test.
set local role authenticated;
set local request.jwt.claim.sub = 'USER_B_UUID';

select id from public.businesses where owner_id = 'USER_A_UUID';
select id from public.clients where business_id = 'BUSINESS_A_UUID';
select id from public.products where business_id = 'BUSINESS_A_UUID';
select id from public.invoices where business_id = 'BUSINESS_A_UUID';
select id from public.recurring_invoices where business_id = 'BUSINESS_A_UUID';
select id from public.stock_movements where business_id = 'BUSINESS_A_UUID';
select id from public.payments where business_id = 'BUSINESS_A_UUID';
select id from public.business_subscriptions where business_id = 'BUSINESS_A_UUID';
select id from public.subscription_payments where business_id = 'BUSINESS_A_UUID';
select business_id, invoice_year, last_number from public.invoice_counters where business_id = 'BUSINESS_A_UUID';

-- Les insertions inter-entreprises doivent échouer avec une erreur RLS.
insert into public.clients (business_id, name) values ('BUSINESS_A_UUID', 'Tentative interdite');
insert into public.recurring_invoices (business_id, client_id, product_id, frequency, next_issue_date)
values ('BUSINESS_A_UUID', 'CLIENT_A_UUID', 'PRODUCT_A_UUID', 'monthly', current_date);
insert into public.stock_movements (business_id, product_id, quantity, movement_type)
values ('BUSINESS_A_UUID', 'PRODUCT_A_UUID', 1, 'in');
insert into public.invoice_counters (business_id, invoice_year, last_number) values ('BUSINESS_A_UUID', 2026, 1);
insert into public.subscription_payments (business_id, plan, amount) values ('BUSINESS_A_UUID', 'starter', 5000);
update public.subscription_payments
set status = 'completed'
where business_id = 'BUSINESS_A_UUID';

-- Les paiements ne sont jamais modifiables directement depuis le client.
update public.business_subscriptions
set plan = 'pro', monthly_invoice_limit = 500
where business_id = 'BUSINESS_A_UUID';

-- L'appel RPC avec une entreprise étrangère doit également échouer.
select public.next_invoice_number('BUSINESS_A_UUID', 2026);

-- Un membre non propriétaire ne doit pas pouvoir modifier l'abonnement.
select public.update_business_subscription('BUSINESS_A_UUID', 'free', 'active', null);

-- Régression du plan Business et des champs avancés produits.
insert into public.products (
  business_id, name, description, unit, purchase_price, price, product_type
) values (
  'BUSINESS_A_UUID', 'Produit de test', 'Description de test', 'kg', 100, 150, 'product'
);
update public.business_subscriptions
set plan = 'business', monthly_invoice_limit = 2000
where business_id = 'BUSINESS_A_UUID';
