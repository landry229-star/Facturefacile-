alter table public.businesses
  add column if not exists payment_instructions text,
  add column if not exists invoice_legal_notice text;
