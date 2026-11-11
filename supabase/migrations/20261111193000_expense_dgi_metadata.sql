alter table public.expenses
  add column if not exists taxable_amount numeric(12, 2),
  add column if not exists vat_amount numeric(12, 2),
  add column if not exists supplier_tax_id text,
  add column if not exists supplier_invoice_number text,
  add column if not exists qr_code_data text;

alter table public.expenses
  drop constraint if exists expenses_fiscal_amounts_check,
  drop constraint if exists expenses_qr_code_data_length_check;

alter table public.expenses
  add constraint expenses_fiscal_amounts_check
    check (
      (taxable_amount is null and vat_amount is null)
      or (
        taxable_amount is not null
        and vat_amount is not null
        and taxable_amount >= 0
        and vat_amount >= 0
        and abs(taxable_amount + vat_amount - amount) <= 0.02
      )
    ),
  add constraint expenses_qr_code_data_length_check
    check (qr_code_data is null or length(qr_code_data) <= 10000);
