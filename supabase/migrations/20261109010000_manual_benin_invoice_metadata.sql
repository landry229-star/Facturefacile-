create or replace function public.save_benin_invoice_metadata(
  p_business_id uuid,
  p_invoice_id uuid,
  p_reg_fiscal_emetteur text,
  p_benin_document_type text,
  p_dgi_nim text,
  p_dgi_counters text,
  p_dgi_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invoice_row public.invoices%rowtype;
  nim_value text := nullif(btrim(p_dgi_nim), '');
  counters_value text := nullif(btrim(p_dgi_counters), '');
  signature_value text := nullif(btrim(p_dgi_signature), '');
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if not exists (
    select 1
      from public.businesses b
     where b.id = p_business_id
       and b.owner_id = auth.uid()
  ) then
    raise exception 'Seul le propriétaire de l’entreprise peut modifier ces informations.';
  end if;

  if p_reg_fiscal_emetteur is not null
     and p_reg_fiscal_emetteur not in ('TPS', 'REEL') then
    raise exception 'Régime fiscal invalide.';
  end if;

  if p_benin_document_type is not null
     and p_benin_document_type not in ('proforma', 'recu_vente', 'bon_livraison', 'facture_interne') then
    raise exception 'Type de document invalide.';
  end if;

  if num_nonnulls(nim_value, counters_value, signature_value) not in (0, 3) then
    raise exception 'Le NIM, le compteur et la signature doivent être renseignés ensemble.';
  end if;

  if length(nim_value) > 50 or length(counters_value) > 50 or length(signature_value) > 100 then
    raise exception 'Une référence e-MECeF dépasse la longueur autorisée.';
  end if;

  select i.*
    into invoice_row
    from public.invoices i
   where i.id = p_invoice_id
     and i.business_id = p_business_id
   for update;

  if not found then
    raise exception 'Facture introuvable dans cette entreprise.';
  end if;

  if invoice_row.status in ('DRAFT', 'CANCELLED') or invoice_row.invoice_type = 'PROFORMA' then
    raise exception 'Les références e-MECeF ne peuvent être liées qu’à un document émis et non proforma.';
  end if;

  if p_benin_document_type = 'proforma' and nim_value is not null then
    raise exception 'Une facture proforma ne peut pas recevoir de références e-MECeF dans ce module.';
  end if;

  update public.invoices
     set reg_fiscal_emetteur = p_reg_fiscal_emetteur,
         benin_document_type = p_benin_document_type,
         dgi_nim = nim_value,
         dgi_counters = counters_value,
         dgi_signature = signature_value,
         is_dgi_mock = false,
         normalized_at = null,
         updated_at = now()
   where id = p_invoice_id
     and business_id = p_business_id;

  return jsonb_build_object(
    'success', true,
    'is_dgi_mock', false,
    'references_saved', nim_value is not null
  );
end;
$$;

revoke all on function public.save_benin_invoice_metadata(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.save_benin_invoice_metadata(uuid, uuid, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
