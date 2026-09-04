create table if not exists public.market_movers (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  market_date date not null,

  category text not null
    check (
      category in (
        'gainer',
        'loser'
      )
    ),

  rank integer not null
    check (
      rank > 0
    ),

  ticker text not null,

  price numeric not null
    check (
      price > 0
    ),

  change_amount numeric not null,

  change_percentage numeric not null,

  volume bigint not null
    default 0
    check (
      volume >= 0
    ),

  source text not null
    default 'alpha_vantage',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    user_id,
    market_date,
    category,
    rank,
    source
  )
);

create index if not exists
  market_movers_user_date_idx
on public.market_movers (
  user_id,
  market_date desc
);

create index if not exists
  market_movers_user_category_idx
on public.market_movers (
  user_id,
  category,
  market_date desc,
  rank
);

alter table public.market_movers
enable row level security;

drop policy if exists
  "Users can read own market movers"
on public.market_movers;

create policy
  "Users can read own market movers"
on public.market_movers
for select
using (
  auth.uid() = user_id
);

drop policy if exists
  "Users can insert own market movers"
on public.market_movers;

create policy
  "Users can insert own market movers"
on public.market_movers
for insert
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Users can update own market movers"
on public.market_movers;

create policy
  "Users can update own market movers"
on public.market_movers
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Users can delete own market movers"
on public.market_movers;

create policy
  "Users can delete own market movers"
on public.market_movers
for delete
using (
  auth.uid() = user_id
);