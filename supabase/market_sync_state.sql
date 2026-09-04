create table if not exists public.market_sync_state (
  id bigint generated always as identity primary key,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  sync_type text not null
    check (
      sync_type in (
        'instrument',
        'fx'
      )
    ),

  sync_key text not null,

  last_successful_sync_date date not null,

  updated_at timestamptz not null
    default now(),

  unique (
    user_id,
    sync_type,
    sync_key
  )
);


alter table public.market_sync_state
enable row level security;


drop policy if exists
"users read own market sync state"
on public.market_sync_state;

drop policy if exists
"users insert own market sync state"
on public.market_sync_state;

drop policy if exists
"users update own market sync state"
on public.market_sync_state;


create policy
"users read own market sync state"
on public.market_sync_state
for select
to authenticated
using (
  auth.uid() = user_id
);


create policy
"users insert own market sync state"
on public.market_sync_state
for insert
to authenticated
with check (
  auth.uid() = user_id
);


create policy
"users update own market sync state"
on public.market_sync_state
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);