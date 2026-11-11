create or replace function public.get_purchase_status_counts(
  p_business_id uuid,
  p_query text default null,
  p_supplier_id uuid default null,
  p_from_date date default null,
  p_to_date date default null
)
returns table (status text, purchase_count bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with statuses(status) as (
    values ('ALL'), ('UNPAID'), ('PARTIALLY_PAID'), ('PAID'), ('VOIDED')
  ),
  filtered as (
    select p.id, p.status, p.voided_at
      from public.purchases p
      join public.suppliers s on s.id = p.supplier_id and s.business_id = p.business_id
     where p.business_id = p_business_id
       and public.is_business_member(p_business_id, 'viewer')
       and (p_supplier_id is null or p.supplier_id = p_supplier_id)
       and (p_from_date is null or p.purchase_date >= p_from_date)
       and (p_to_date is null or p.purchase_date <= p_to_date)
       and (
         nullif(trim(p_query), '') is null
         or position(lower(trim(p_query)) in lower(p.purchase_number)) > 0
         or position(lower(trim(p_query)) in lower(coalesce(p.supplier_invoice_number, ''))) > 0
         or position(lower(trim(p_query)) in lower(s.name)) > 0
       )
  )
  select statuses.status, count(filtered.id)::bigint
    from statuses
    left join filtered
      on statuses.status = 'ALL'
      or (statuses.status = 'VOIDED' and filtered.voided_at is not null)
      or (
        statuses.status in ('UNPAID', 'PARTIALLY_PAID', 'PAID')
        and filtered.voided_at is null
        and filtered.status = statuses.status
      )
   group by statuses.status
   order by case statuses.status
     when 'ALL' then 0
     when 'UNPAID' then 1
     when 'PARTIALLY_PAID' then 2
     when 'PAID' then 3
     else 4
   end;
$$;

revoke all on function public.get_purchase_status_counts(uuid, text, uuid, date, date) from public, anon;
grant execute on function public.get_purchase_status_counts(uuid, text, uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
