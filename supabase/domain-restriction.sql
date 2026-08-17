-- =============================================================================
-- Restrict sign-up to @inportgroup.com addresses.
--
-- This MUST live in the database. A check in the React app is only a nicety for
-- the error message: anyone can POST straight to /auth/v1/signup with any email
-- and skip the UI entirely. The trigger below is the actual boundary.
--
-- Applies to new rows only. Accounts already in auth.users are left alone.
-- Idempotent: safe to re-run.
-- =============================================================================

create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Exact domain, case-insensitive. Subdomains are NOT accepted, and taking the
  -- part after "@" avoids look-alikes such as user@evil-inportgroup.com that a
  -- suffix match like '%@inportgroup.com' would be easy to get wrong.
  if lower(split_part(new.email, '@', 2)) <> 'inportgroup.com' then
    raise exception 'Sign-up is restricted to @inportgroup.com email addresses.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_domain on auth.users;
create trigger enforce_email_domain
  before insert on auth.users
  for each row execute function public.enforce_email_domain();
