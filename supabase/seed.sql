-- =============================================================================
-- Optional demo data.
-- Run AFTER schema.sql and AFTER you have signed up at least one user.
-- Everything is attached to the oldest user in auth.users.
-- =============================================================================

do $$
declare
  v_owner      uuid;
  v_acme       uuid;
  v_northwind  uuid;
  v_ada        uuid;
  v_grace      uuid;
  v_deal       uuid;
begin
  select id into v_owner from auth.users order by created_at limit 1;

  if v_owner is null then
    raise exception 'No users found. Sign up in the app first, then re-run this seed.';
  end if;

  insert into public.companies (owner_id, name, domain, industry, phone)
  values (v_owner, 'Acme Industrial', 'acme.example', 'Manufacturing', '+34 900 111 222')
  returning id into v_acme;

  insert into public.companies (owner_id, name, domain, industry, phone)
  values (v_owner, 'Northwind Logistics', 'northwind.example', 'Logistics', '+34 900 333 444')
  returning id into v_northwind;

  insert into public.contacts (owner_id, company_id, first_name, last_name, email, phone, job_title, status)
  values (v_owner, v_acme, 'Ada', 'Lovelace', 'ada@acme.example', '+34 600 111 222', 'Head of Operations', 'customer')
  returning id into v_ada;

  insert into public.contacts (owner_id, company_id, first_name, last_name, email, phone, job_title, status)
  values (v_owner, v_northwind, 'Grace', 'Hopper', 'grace@northwind.example', '+34 600 333 444', 'CTO', 'prospect')
  returning id into v_grace;

  insert into public.deals (owner_id, company_id, contact_id, title, value, stage, probability, expected_close_date)
  values (v_owner, v_acme, v_ada, 'Acme — annual supply contract', 48000, 'negotiation', 70,
          current_date + 21)
  returning id into v_deal;

  insert into public.deals (owner_id, company_id, contact_id, title, value, stage, probability, expected_close_date)
  values (v_owner, v_northwind, v_grace, 'Northwind — fleet tracking pilot', 12500, 'qualified', 40,
          current_date + 45);

  insert into public.activities (owner_id, contact_id, company_id, deal_id, type, body)
  values (v_owner, v_ada, v_acme, v_deal, 'call',
          'Reviewed pricing tiers. Ada wants a 3-year option before signing.');

  insert into public.tasks (owner_id, contact_id, deal_id, title, due_date, priority)
  values (v_owner, v_ada, v_deal, 'Send revised 3-year quote', current_date + 2, 'high');

  insert into public.tasks (owner_id, contact_id, title, due_date, priority)
  values (v_owner, v_grace, 'Book pilot kick-off call', current_date + 7, 'medium');
end;
$$;
