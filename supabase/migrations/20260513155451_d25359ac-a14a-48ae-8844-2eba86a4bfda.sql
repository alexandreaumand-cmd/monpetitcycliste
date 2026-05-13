create table if not exists public.transactional_email_overrides (
  template_key text primary key,
  subject text,
  intro_html text,
  cta_label text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.transactional_email_overrides enable row level security;

create policy "Superadmins manage transactional overrides"
  on public.transactional_email_overrides
  for all
  to authenticated
  using (is_superadmin())
  with check (is_superadmin());

create policy "Service role reads transactional overrides"
  on public.transactional_email_overrides
  for select
  using (auth.role() = 'service_role');

create or replace function public.touch_transactional_email_overrides()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_transactional_overrides on public.transactional_email_overrides;
create trigger trg_touch_transactional_overrides
  before update on public.transactional_email_overrides
  for each row execute function public.touch_transactional_email_overrides();