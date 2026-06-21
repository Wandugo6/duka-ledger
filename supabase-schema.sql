-- Duka Ledger database schema
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste this -> Run

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  shop text not null,
  date date not null,
  item text not null,
  qty integer not null,
  amount numeric not null,
  employee text not null,
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  from_shop text not null,
  to_shop text not null,
  item text not null,
  qty integer not null,
  employee text not null,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text not null
);

-- Helpful indexes for the date-range + shop filters used by the owner view
create index if not exists sales_date_idx on sales (date);
create index if not exists sales_shop_idx on sales (shop);
create index if not exists transfers_date_idx on transfers (date);
create index if not exists transfers_from_shop_idx on transfers (from_shop);
create index if not exists transfers_to_shop_idx on transfers (to_shop);

-- Row Level Security: this app has no per-user login (just a shared owner PIN
-- checked in the app itself), so we allow the public anon/publishable key to
-- read and write these three tables. Don't put anything more sensitive than
-- shop sales/stock data in this project.
alter table sales enable row level security;
alter table transfers enable row level security;
alter table settings enable row level security;

create policy "Allow all access to sales" on sales
  for all using (true) with check (true);

create policy "Allow all access to transfers" on transfers
  for all using (true) with check (true);

create policy "Allow all access to settings" on settings
  for all using (true) with check (true);
