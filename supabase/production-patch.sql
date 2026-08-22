-- Valley Crown production patch for an existing database.
-- Safe to run after the main schema has already been installed.

alter table public.orders add column if not exists items_summary text;

-- Make sure RLS remains enabled on every exposed table used by the storefront/admin.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;

-- Product bucket stays public for reads; writes are still protected by storage.objects RLS.
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;
