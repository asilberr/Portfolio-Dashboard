alter table public.price_snapshots
enable row level security;

drop policy if exists
"authenticated users read price snapshots"
on public.price_snapshots;

drop policy if exists
"users insert price snapshots for own instruments"
on public.price_snapshots;

create policy
"authenticated users read price snapshots"
on public.price_snapshots
for select
to authenticated
using (true);

create policy
"users insert price snapshots for own instruments"
on public.price_snapshots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.positions pos
    join public.portfolios p
      on p.id = pos.portfolio_id
    where
      pos.instrument_id =
        price_snapshots.instrument_id
      and p.user_id = auth.uid()
  )
);