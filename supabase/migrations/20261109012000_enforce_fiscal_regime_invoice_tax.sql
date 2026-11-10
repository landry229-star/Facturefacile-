create or replace function public.snapshot_invoice_fiscal_regime()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  taxable_amount numeric;
begin
  select b.fiscal_regime
    into new.reg_fiscal_emetteur
    from public.businesses b
   where b.id = new.business_id;

  if new.reg_fiscal_emetteur in ('TPS', 'REEL') then
    taxable_amount := greatest(
      coalesce(new.subtotal, 0) - least(greatest(coalesce(new.discount, 0), 0), coalesce(new.subtotal, 0)),
      0
    );
    new.tax := case when new.reg_fiscal_emetteur = 'TPS' then 0 else taxable_amount * 0.18 end;
    new.total := taxable_amount + new.tax;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
