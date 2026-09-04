alter table public.instruments enable row level security;

drop policy if exists "authenticated users read instruments"
on public.instruments;

drop policy if exists "authenticated users create instruments"
on public.instruments;

create policy "authenticated users read instruments"
on public.instruments
for select
to authenticated
using (true);

create policy "authenticated users create instruments"
on public.instruments
for insert
to authenticated
with check (auth.uid() is not null);