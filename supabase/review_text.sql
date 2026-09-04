create table if not exists public.portfolio_reviews (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null
    default now(),

  model text not null,

  portfolio_value_eur numeric,

  invested_value_eur numeric,

  profit_loss_eur numeric,

  profit_loss_percent numeric,

  position_count integer not null
    default 0,

  review_text text not null,

  review_data jsonb not null
    default '{}'::jsonb,

  sources jsonb not null
    default '[]'::jsonb,

  status text not null
    default 'completed'
    check (
      status in (
        'completed',
        'failed'
      )
    )
);

create index if not exists
  portfolio_reviews_user_created_idx
on public.portfolio_reviews (
  user_id,
  created_at desc
);

alter table public.portfolio_reviews
enable row level security;

drop policy if exists
  "Users can read own portfolio reviews"
on public.portfolio_reviews;

create policy
  "Users can read own portfolio reviews"
on public.portfolio_reviews
for select
using (
  auth.uid() = user_id
);

drop policy if exists
  "Users can insert own portfolio reviews"
on public.portfolio_reviews;

create policy
  "Users can insert own portfolio reviews"
on public.portfolio_reviews
for insert
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Users can update own portfolio reviews"
on public.portfolio_reviews;

create policy
  "Users can update own portfolio reviews"
on public.portfolio_reviews
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
  "Users can delete own portfolio reviews"
on public.portfolio_reviews;

create policy
  "Users can delete own portfolio reviews"
on public.portfolio_reviews
for delete
using (
  auth.uid() = user_id
);