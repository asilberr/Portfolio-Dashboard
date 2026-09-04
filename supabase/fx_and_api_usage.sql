create table if not exists public.fx_snapshots (
  id bigint generated always as identity primary key,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  from_currency text not null,
  to_currency text not null,

  rate numeric not null,

  captured_at timestamptz not null,

  source text not null,

  unique (
    user_id,
    from_currency,
    to_currency,
    captured_at,
    source
  )
);

create table if not exists public.api_usage (
  id bigint generated always as identity primary key,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  provider text not null,

  usage_date date not null,

  request_count integer not null
    default 0
    check (request_count >= 0),

  updated_at timestamptz not null
    default now(),

  unique (
    user_id,
    provider,
    usage_date
  )
);

alter table public.fx_snapshots
enable row level security;

alter table public.api_usage
enable row level security;


drop policy if exists
"users read own fx snapshots"
on public.fx_snapshots;

drop policy if exists
"users insert own fx snapshots"
on public.fx_snapshots;

drop policy if exists
"users update own fx snapshots"
on public.fx_snapshots;


create policy
"users read own fx snapshots"
on public.fx_snapshots
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy
"users insert own fx snapshots"
on public.fx_snapshots
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy
"users update own fx snapshots"
on public.fx_snapshots
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


drop policy if exists
"users read own api usage"
on public.api_usage;

drop policy if exists
"users insert own api usage"
on public.api_usage;

drop policy if exists
"users update own api usage"
on public.api_usage;


create policy
"users read own api usage"
on public.api_usage
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy
"users insert own api usage"
on public.api_usage
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy
"users update own api usage"
on public.api_usage
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


create or replace function
public.consume_market_api_credit(
  p_provider text,
  p_daily_limit integer
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_today date;
  v_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'NOT_AUTHENTICATED';
  end if;

  v_today :=
    (
      now()
      at time zone 'Europe/Berlin'
    )::date;

  insert into public.api_usage (
    user_id,
    provider,
    usage_date,
    request_count,
    updated_at
  )
  values (
    v_user_id,
    p_provider,
    v_today,
    1,
    now()
  )
  on conflict (
    user_id,
    provider,
    usage_date
  )
  do update
  set
    request_count =
      public.api_usage.request_count + 1,

    updated_at = now()

  where
    public.api_usage.request_count
      < p_daily_limit

  returning
    request_count
  into
    v_count;

  if v_count is null then
    raise exception
      'DAILY_API_LIMIT_REACHED';
  end if;

  return v_count;
end;
$$;

grant execute
on function
public.consume_market_api_credit(
  text,
  integer
)
to authenticated;