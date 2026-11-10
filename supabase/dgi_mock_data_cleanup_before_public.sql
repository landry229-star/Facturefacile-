-- PRE-LAUNCH CLEANUP ONLY.
-- Run against the intended Supabase project after disabling
-- VITE_DGI_MOCK_IFU_LOOKUP_ENABLED and before opening the app to the public.
-- This removes every row from the mock-only registry but keeps its table/schema.
-- Do not put real DGI data in this table.

begin;

delete from public.dgi_mock_ifu_registry;

update public.invoices
   set dgi_nim = null,
       dgi_signature = null,
       dgi_counters = null,
       is_dgi_mock = false,
       normalized_at = null
 where is_dgi_mock = true;

drop function if exists public.simulate_dgi_normalisation(uuid);

commit;
