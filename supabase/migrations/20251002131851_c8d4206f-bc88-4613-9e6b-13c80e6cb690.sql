-- Create user_roles table for secure role management
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null,
    created_at timestamp with time zone default now(),
    unique (user_id, role)
);

-- Enable RLS on user_roles
alter table public.user_roles enable row level security;

-- Create security definer function to check roles (prevents RLS recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- RLS policies for user_roles
create policy "Users can view their own roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all roles"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage all roles"
on public.user_roles
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Remove role column from managers table
alter table public.managers drop column if exists role;

-- Update RLS policies for admin operations

-- Auctions: Admins can manage
create policy "Admins can insert auctions"
on public.auctions
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update auctions"
on public.auctions
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Race results: Admins can manage
create policy "Admins can insert race_results"
on public.race_results
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update race_results"
on public.race_results
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Audits: Admins can insert
create policy "Admins can insert audits"
on public.audits
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

-- Rosters: Admins can override
create policy "Admins can insert rosters"
on public.rosters
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete rosters"
on public.rosters
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Function to get current user's roles
create or replace function public.get_my_roles()
returns setof app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = auth.uid()
$$;

-- Helper function to check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
$$;

-- IMPORTANT: To create your first admin user, run this after signing up:
-- Replace 'your-email@example.com' with the email you used to sign up
-- 
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'::app_role
-- FROM auth.users
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (user_id, role) DO NOTHING;