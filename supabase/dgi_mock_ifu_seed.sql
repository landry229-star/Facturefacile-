-- PRE-LAUNCH DEMONSTRATION DATA ONLY.
-- Run only after the DGI mock registry has been installed.
-- These identifiers and business details are synthetic, are not DGI records,
-- and must never be shown as official or used for tax/legal purposes.
-- Safe to re-run: existing rows are left unchanged.

insert into public.dgi_mock_ifu_registry
  (ifu, raison_sociale, regime_fiscal, adresse, telephone)
values
  ('9999999990001', 'FICTIF - Atelier Soleil (simulation)', 'TPS', 'Adresse fictive, Cotonou', '+229 00 00 00 01'),
  ('9999999990002', 'FICTIF - Marché des Palmiers (simulation)', 'REEL', 'Adresse fictive, Porto-Novo', '+229 00 00 00 02'),
  ('9999999990003', 'FICTIF - Services Étoile (simulation)', 'TPS', 'Adresse fictive, Abomey-Calavi', '+229 00 00 00 03'),
  ('9999999990004', 'FICTIF - Boutique Aurore (simulation)', 'REEL', 'Adresse fictive, Parakou', '+229 00 00 00 04'),
  ('9999999990005', 'FICTIF - Bâtir Ensemble (simulation)', 'REEL', 'Adresse fictive, Bohicon', '+229 00 00 00 05'),
  ('9999999990006', 'FICTIF - Papeterie Arc-en-ciel (simulation)', 'TPS', 'Adresse fictive, Natitingou', '+229 00 00 00 06'),
  ('9999999990007', 'FICTIF - Transport Lagune (simulation)', 'TPS', 'Adresse fictive, Ouidah', '+229 00 00 00 07'),
  ('9999999990008', 'FICTIF - Numérique Baobab (simulation)', 'REEL', 'Adresse fictive, Djougou', '+229 00 00 00 08')
on conflict (ifu) do nothing;
