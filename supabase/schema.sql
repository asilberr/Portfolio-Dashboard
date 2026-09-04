create extension if not exists pgcrypto;

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bank_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  isin text unique,
  symbol text,
  name text not null,
  asset_type text not null check (asset_type in ('stock','etf','fund','cash')),
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id),
  quantity numeric not null,
  average_cost numeric,
  cost_currency text default 'EUR',
  updated_at timestamptz not null default now(),
  unique(portfolio_id, instrument_id)
);

create table if not exists public.price_snapshots (
  id bigint generated always as identity primary key,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  price numeric not null,
  currency text not null,
  captured_at timestamptz not null,
  source text not null,
  unique(instrument_id, captured_at, source)
);

create table if not exists public.portfolio_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_value_eur numeric not null,
  captured_on date not null,
  unique(user_id, captured_on)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary text,
  storage_path text,
  status text not null default 'ready' check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.reports enable row level security;

create policy "users manage own portfolios" on public.portfolios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own positions" on public.positions for all using (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid())
);
create policy "users read own snapshots" on public.portfolio_snapshots for select using (auth.uid() = user_id);
create policy "users read own reports" on public.reports for select using (auth.uid() = user_id);
