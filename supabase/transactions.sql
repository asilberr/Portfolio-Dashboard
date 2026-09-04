create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  portfolio_id uuid not null
    references public.portfolios(id)
    on delete cascade,

  instrument_id uuid
    references public.instruments(id),

  transaction_type text not null
    check (
      transaction_type in (
        'buy',
        'sell',
        'dividend',
        'fee',
        'deposit',
        'withdrawal'
      )
    ),

  trade_date date not null,

  quantity numeric,
  price_per_unit numeric,
  amount numeric,

  currency text not null
    default 'EUR',

  notes text,

  created_at timestamptz not null
    default now(),

  check (
    quantity is null
    or quantity > 0
  ),

  check (
    price_per_unit is null
    or price_per_unit >= 0
  ),

  check (
    amount is null
    or amount >= 0
  )
);


create index if not exists
transactions_user_date_idx
on public.transactions (
  user_id,
  trade_date desc
);


create index if not exists
transactions_portfolio_idx
on public.transactions (
  portfolio_id
);


create index if not exists
transactions_instrument_idx
on public.transactions (
  instrument_id
);


alter table public.transactions
enable row level security;


drop policy if exists
"users read own transactions"
on public.transactions;

drop policy if exists
"users insert own transactions"
on public.transactions;


create policy
"users read own transactions"
on public.transactions
for select
to authenticated
using (
  auth.uid() = user_id
);


create policy
"users insert own transactions"
on public.transactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.portfolios p
    where
      p.id = portfolio_id
      and p.user_id = auth.uid()
  )
);


create or replace function
public.record_portfolio_transaction(
  p_portfolio_id uuid,
  p_instrument_id uuid,
  p_transaction_type text,
  p_trade_date date,
  p_quantity numeric,
  p_price_per_unit numeric,
  p_amount numeric,
  p_currency text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;

  v_transaction_id uuid;

  v_existing_position
    public.positions%rowtype;

  v_new_quantity numeric;

  v_new_average_cost numeric;

  v_effective_amount numeric;

  v_currency text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'NOT_AUTHENTICATED';
  end if;


  if not exists (
    select 1
    from public.portfolios p
    where
      p.id = p_portfolio_id
      and p.user_id = v_user_id
  ) then
    raise exception
      'PORTFOLIO_NOT_FOUND';
  end if;


  if p_transaction_type not in (
    'buy',
    'sell',
    'dividend',
    'fee',
    'deposit',
    'withdrawal'
  ) then
    raise exception
      'INVALID_TRANSACTION_TYPE';
  end if;


  v_currency :=
    upper(
      coalesce(
        nullif(
          trim(p_currency),
          ''
        ),
        'EUR'
      )
    );


  if v_currency !~ '^[A-Z]{3}$' then
    raise exception
      'INVALID_CURRENCY';
  end if;


  /*
   * BUY / SELL
   */
  if p_transaction_type in (
    'buy',
    'sell'
  ) then

    if p_instrument_id is null then
      raise exception
        'INSTRUMENT_REQUIRED';
    end if;


    if
      p_quantity is null
      or p_quantity <= 0
    then
      raise exception
        'INVALID_QUANTITY';
    end if;


    if
      p_price_per_unit is null
      or p_price_per_unit < 0
    then
      raise exception
        'INVALID_PRICE';
    end if;


    v_effective_amount :=
      p_quantity
      * p_price_per_unit;


    select *
    into v_existing_position
    from public.positions
    where
      portfolio_id =
        p_portfolio_id
      and instrument_id =
        p_instrument_id
    for update;


    /*
     * KAUF
     */
    if p_transaction_type =
      'buy'
    then

      if found then

        if
          upper(
            coalesce(
              v_existing_position.cost_currency,
              'EUR'
            )
          ) <> v_currency
        then
          raise exception
            'POSITION_CURRENCY_MISMATCH';
        end if;


        v_new_quantity :=
          v_existing_position.quantity
          + p_quantity;


        v_new_average_cost :=
          (
            (
              v_existing_position.quantity
              *
              coalesce(
                v_existing_position.average_cost,
                0
              )
            )
            +
            (
              p_quantity
              *
              p_price_per_unit
            )
          )
          /
          v_new_quantity;


        update public.positions
        set
          quantity =
            v_new_quantity,

          average_cost =
            v_new_average_cost,

          cost_currency =
            v_currency,

          updated_at =
            now()

        where
          id =
            v_existing_position.id;

      else

        insert into public.positions (
          portfolio_id,
          instrument_id,
          quantity,
          average_cost,
          cost_currency,
          updated_at
        )
        values (
          p_portfolio_id,
          p_instrument_id,
          p_quantity,
          p_price_per_unit,
          v_currency,
          now()
        );

      end if;

    end if;


    /*
     * VERKAUF
     */
    if p_transaction_type =
      'sell'
    then

      if not found then
        raise exception
          'POSITION_NOT_FOUND';
      end if;


      if
        p_quantity >
        v_existing_position.quantity
      then
        raise exception
          'INSUFFICIENT_POSITION_QUANTITY';
      end if;


      v_new_quantity :=
        v_existing_position.quantity
        - p_quantity;


      update public.positions
      set
        quantity =
          v_new_quantity,

        updated_at =
          now()

      where
        id =
          v_existing_position.id;

    end if;

  else

    /*
     * CASHFLOW-TYPEN
     */
    if
      p_amount is null
      or p_amount < 0
    then
      raise exception
        'INVALID_AMOUNT';
    end if;


    v_effective_amount :=
      p_amount;

  end if;


  insert into public.transactions (
    user_id,
    portfolio_id,
    instrument_id,
    transaction_type,
    trade_date,
    quantity,
    price_per_unit,
    amount,
    currency,
    notes
  )
  values (
    v_user_id,
    p_portfolio_id,
    p_instrument_id,
    p_transaction_type,
    p_trade_date,
    p_quantity,
    p_price_per_unit,
    v_effective_amount,
    v_currency,
    nullif(
      trim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    )
  )
  returning id
  into v_transaction_id;


  return v_transaction_id;
end;
$$;


grant execute
on function
public.record_portfolio_transaction(
  uuid,
  uuid,
  text,
  date,
  numeric,
  numeric,
  numeric,
  text,
  text
)
to authenticated;