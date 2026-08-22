-- VALLEY CROWN production Supabase schema
-- Run this in the Supabase SQL Editor for the production project.
-- Safe to re-run: policies are dropped/recreated.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(10,2) not null check (price >= 0),
  sale_price numeric(10,2) check (sale_price is null or (sale_price >= 0 and sale_price <= price)),
  material text,
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  sku text,
  featured boolean not null default false,
  new_arrival boolean not null default false,
  bestseller boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 7),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text,
  phone text,
  address text,
  total numeric(10,2) not null default 0 check (total >= 0),
  status text not null default 'New' check (status in ('New','Confirmed','Processing','Shipped','Delivered','Cancelled')),
  notes text,
  items_summary text,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists items_summary text;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  size text,
  color text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists product_images_product_idx on public.product_images(product_id, sort_order);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);

-- Keep updated_at current without requiring frontend code to manage it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.site_settings;
create trigger settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

-- RLS is mandatory for every exposed public table.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;

-- Remove old policies so this script can be safely re-run.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('categories','products','product_images','orders','order_items','site_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Public storefront reads only active catalog/settings data.
create policy "public_read_active_categories"
on public.categories for select to anon, authenticated
using (status = 'active');

create policy "public_read_active_products"
on public.products for select to anon, authenticated
using (status = 'active');

create policy "public_read_active_product_images"
on public.product_images for select to anon, authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_images.product_id and p.status = 'active'
));

create policy "public_read_site_settings"
on public.site_settings for select to anon, authenticated
using (true);

-- Admin authorization is based ONLY on app_metadata, never user_metadata.
create policy "admin_manage_categories"
on public.categories for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admin_manage_products"
on public.products for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admin_manage_product_images"
on public.product_images for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admin_manage_orders"
on public.orders for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admin_manage_order_items"
on public.order_items for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "admin_manage_site_settings"
on public.site_settings for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Storage: public product images, admin-only writes.
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public_read_product_images" on storage.objects;
drop policy if exists "admin_insert_product_images" on storage.objects;
drop policy if exists "admin_update_product_images" on storage.objects;
drop policy if exists "admin_delete_product_images" on storage.objects;

create policy "public_read_product_images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'products');

create policy "admin_insert_product_images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'products'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "admin_update_product_images"
on storage.objects for update to authenticated
using (
  bucket_id = 'products'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
)
with check (
  bucket_id = 'products'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "admin_delete_product_images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'products'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);
