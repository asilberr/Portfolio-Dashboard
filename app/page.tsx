import Link from "next/link";

import {
  BarChart3,
  Download,
  Gauge,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { redirect } from "next/navigation";

import { PortfolioChart } from "@/components/PortfolioChart";
import { LogoutButton } from "@/components/logout-button";
import { RefreshPricesButton } from "@/components/refresh-prices-button";
import { createClient } from "@/lib/supabase/server";
import { syncMarketData } from "@/app/market-data/actions";

import {
  generatePortfolioReview,
} from "@/app/portfolio-review/actions";

import {
  GEMINI_DAILY_LIMIT,
  GEMINI_PROVIDER,
} from "@/lib/gemini/config";

import {
  ALPHA_VANTAGE_DAILY_LIMIT,
  ALPHA_VANTAGE_PROVIDER,
} from "@/lib/market-data/alpha-vantage";

type HomeProps = {
  searchParams?: Promise<{
    marketSuccess?: string;
    marketError?: string;
    reviewSuccess?: string;
    reviewError?: string;
  }>;
};

type DashboardPosition = {
  id: string;
  instrument_id: string;

  quantity:
    | number
    | string;

  average_cost:
    | number
    | string
    | null;

  cost_currency:
    | string
    | null;

  portfolios:
    | {
        name: string;
        bank_name:
          | string
          | null;
      }
    | {
        name: string;
        bank_name:
          | string
          | null;
      }[]
    | null;

  instruments:
    | {
        id: string;
        name: string;
        symbol:
          | string
          | null;
        asset_type: string;
        currency: string;
      }
    | {
        id: string;
        name: string;
        symbol:
          | string
          | null;
        asset_type: string;
        currency: string;
      }[]
    | null;
};

type HistoricalTransaction = {
  instrument_id:
    | string
    | null;

  transaction_type: string;

  trade_date: string;

  quantity:
    | number
    | string
    | null;

  price_per_unit:
    | number
    | string
    | null;

  currency: string;

  instruments:
    | {
        id: string;
        name: string;
        symbol:
          | string
          | null;
        asset_type: string;
        currency: string;
      }
    | {
        id: string;
        name: string;
        symbol:
          | string
          | null;
        asset_type: string;
        currency: string;
      }[]
    | null;
};

type PriceSnapshot = {
  instrument_id: string;

  price:
    | number
    | string;

  currency: string;

  captured_at: string;
};

type FxSnapshot = {
  from_currency: string;

  to_currency: string;

  rate:
    | number
    | string;

  captured_at: string;
};

type MarketPosition = {
  id: string;

  instrumentId: string;

  name: string;

  symbol:
    | string
    | null;

  depot: string;

  assetType: string;

  quantity: number;

  averageCost: number;

  costCurrency: string;

  marketCurrency: string;

  latestPrice:
    | number
    | null;

  latestFx:
    | number
    | null;

  monthPrice:
    | number
    | null;

  monthFx:
    | number
    | null;

  latestDate:
    | string
    | null;

  investedNative: number;

  investedApproxEur:
    | number
    | null;

  marketValueNative:
    | number
    | null;

  marketValueEur:
    | number
    | null;

  profitLossEur:
    | number
    | null;

  profitLossPercent:
    | number
    | null;

  monthChangeEur:
    | number
    | null;
};

type PortfolioChartTransaction = {
  type:
    | "buy"
    | "sell";

  instrumentName: string;

  symbol:
    | string
    | null;

  quantity: number;

  pricePerUnit:
    | number
    | null;

  currency: string;
};

type PortfolioChartPoint = {
  date: string;

  rawDate: string;

  value: number;

  transactions:
    PortfolioChartTransaction[];
};

type MarketMoverRow = {
  id: string;

  market_date: string;

  category:
    | "gainer"
    | "loser";

  rank: number;

  ticker: string;

  price:
    | number
    | string;

  change_amount:
    | number
    | string;

  change_percentage:
    | number
    | string;

  volume:
    | number
    | string;

  source: string;
};

type PortfolioReviewSource = {
  index?: number;

  title?: string;

  url?: string;
};

type PortfolioReviewRow = {
  id: string;

  created_at: string;

  model: string;

  portfolio_value_eur:
    | number
    | string
    | null;

  invested_value_eur:
    | number
    | string
    | null;

  profit_loss_eur:
    | number
    | string
    | null;

  profit_loss_percent:
    | number
    | string
    | null;

  position_count: number;

  review_text: string;

  review_data:
    | Record<string, unknown>
    | null;

  sources:
    | PortfolioReviewSource[]
    | null;

  status: string;
};

export default async function Home(
  props: HomeProps
) {
  const searchParams =
    await props.searchParams;

  const supabase =
    await createClient();

  const {
    data: authData,
    error: authError,
  } =
    await supabase.auth.getClaims();

  const userId =
    authData?.claims?.sub;

  if (
    authError ||
    !userId
  ) {
    redirect("/login");
  }

  const {
    data: portfolios,
  } = await supabase
    .from("portfolios")
    .select(
      "id, name, bank_name"
    )
    .eq(
      "user_id",
      userId
    );

  /*
   * AKTUELLE POSITIONEN
   */
  const {
    data: positionData,
  } = await supabase
    .from("positions")
    .select(`
      id,
      instrument_id,
      quantity,
      average_cost,
      cost_currency,
      portfolios (
        name,
        bank_name
      ),
      instruments (
        id,
        name,
        symbol,
        asset_type,
        currency
      )
    `)
    .order(
      "updated_at",
      {
        ascending: false,
      }
    );

  const positions =
    (positionData as
      | DashboardPosition[]
      | null) ?? [];

  /*
   * BUY-/SELL-TRANSAKTIONEN
   */
  const {
    data: transactionData,
    error: transactionError,
  } = await supabase
    .from("transactions")
    .select(`
      instrument_id,
      transaction_type,
      trade_date,
      quantity,
      price_per_unit,
      currency,
      instruments (
        id,
        name,
        symbol,
        asset_type,
        currency
      )
    `)
    .eq(
      "user_id",
      userId
    )
    .in(
      "transaction_type",
      [
        "buy",
        "sell",
      ]
    )
    .order(
      "trade_date",
      {
        ascending: true,
      }
    );

  if (
    transactionError
  ) {
    console.error(
      "Historical transaction load error:",
      transactionError
    );
  }

  const historicalTransactions =
    (transactionData as
      | HistoricalTransaction[]
      | null) ?? [];

  /*
   * INSTRUMENTE AUS POSITIONEN
   * UND HISTORISCHEN TRANSAKTIONEN
   */
  const currentInstrumentIds =
    positions.map(
      (position) =>
        position.instrument_id
    );

  const historicalInstrumentIds =
    historicalTransactions
      .map(
        (transaction) =>
          transaction.instrument_id
      )
      .filter(
        (
          instrumentId
        ): instrumentId is string =>
          Boolean(
            instrumentId
          )
      );

  const instrumentIds =
    Array.from(
      new Set([
        ...currentInstrumentIds,
        ...historicalInstrumentIds,
      ])
    );

  /*
   * HISTORISCHE PREISE
   */
  let priceSnapshots:
    PriceSnapshot[] = [];

  if (
    instrumentIds.length >
    0
  ) {
    const {
      data: snapshotData,
    } = await supabase
      .from(
        "price_snapshots"
      )
      .select(`
        instrument_id,
        price,
        currency,
        captured_at
      `)
      .in(
        "instrument_id",
        instrumentIds
      )
      .order(
        "captured_at",
        {
          ascending: false,
        }
      );

    priceSnapshots =
      (snapshotData as
        | PriceSnapshot[]
        | null) ?? [];
  }

  /*
   * MARKTWÄHRUNGEN
   */
  const currentMarketCurrencies =
    positions.map(
      (position) => {
        const instrument =
          getRelation(
            position.instruments
          );

        return (
          instrument?.currency ??
          "EUR"
        )
          .trim()
          .toUpperCase();
      }
    );

  const historicalMarketCurrencies =
    historicalTransactions.map(
      (transaction) => {
        const instrument =
          getRelation(
            transaction.instruments
          );

        return (
          instrument?.currency ??
          "EUR"
        )
          .trim()
          .toUpperCase();
      }
    );

  const currencies =
    Array.from(
      new Set([
        ...currentMarketCurrencies,
        ...historicalMarketCurrencies,
      ])
    ).filter(
      (currency) =>
        currency !== "EUR"
    );

  /*
   * EINSTANDSWÄHRUNGEN
   */
  const costCurrencies =
    Array.from(
      new Set(
        positions
          .map(
            (position) =>
              (
                position.cost_currency ??
                "EUR"
              )
                .trim()
                .toUpperCase()
          )
          .filter(
            (currency) =>
              currency !==
              "EUR"
          )
      )
    );

  const allFxCurrencies =
    Array.from(
      new Set([
        ...currencies,
        ...costCurrencies,
      ])
    );

  /*
   * FX-HISTORIE
   */
  let fxSnapshots:
    FxSnapshot[] = [];

  if (
    allFxCurrencies.length >
    0
  ) {
    const {
      data: fxData,
    } = await supabase
      .from(
        "fx_snapshots"
      )
      .select(`
        from_currency,
        to_currency,
        rate,
        captured_at
      `)
      .eq(
        "user_id",
        userId
      )
      .eq(
        "to_currency",
        "EUR"
      )
      .in(
        "from_currency",
        allFxCurrencies
      )
      .order(
        "captured_at",
        {
          ascending: false,
        }
      );

    fxSnapshots =
      (fxData as
        | FxSnapshot[]
        | null) ?? [];
  }

  /*
   * PREISE NACH INSTRUMENT
   */
  const snapshotsByInstrument =
    new Map<
      string,
      PriceSnapshot[]
    >();

  for (
    const snapshot
    of priceSnapshots
  ) {
    const current =
      snapshotsByInstrument.get(
        snapshot.instrument_id
      ) ?? [];

    current.push(
      snapshot
    );

    snapshotsByInstrument.set(
      snapshot.instrument_id,
      current
    );
  }

  /*
   * FX NACH WÄHRUNG
   */
  const fxByCurrency =
    new Map<
      string,
      FxSnapshot[]
    >();

  for (
    const snapshot
    of fxSnapshots
  ) {
    const currency =
      snapshot.from_currency
        .trim()
        .toUpperCase();

    const current =
      fxByCurrency.get(
        currency
      ) ?? [];

    current.push(
      snapshot
    );

    fxByCurrency.set(
      currency,
      current
    );
  }

  /*
   * AKTUELLE POSITIONEN
   */
  const marketPositions:
    MarketPosition[] =
    positions.map(
      (position) => {
        const instrument =
          getRelation(
            position.instruments
          );

        const portfolio =
          getRelation(
            position.portfolios
          );

        const quantity =
          numeric(
            position.quantity
          );

        const averageCost =
          numeric(
            position.average_cost
          );

        const marketCurrency =
          (
            instrument?.currency ??
            "EUR"
          )
            .trim()
            .toUpperCase();

        const costCurrency =
          (
            position.cost_currency ??
            "EUR"
          )
            .trim()
            .toUpperCase();

        const snapshots =
          snapshotsByInstrument.get(
            position.instrument_id
          ) ?? [];

        const latest =
          snapshots[0] ??
          null;

        const monthOld =
          findMonthOldPriceSnapshot(
            snapshots
          );

        const latestPrice =
          latest
            ? numeric(
                latest.price
              )
            : null;

        const monthPrice =
          monthOld
            ? numeric(
                monthOld.price
              )
            : null;

        const latestFx =
          getLatestFxRate(
            marketCurrency,
            fxByCurrency
          );

        const monthFx =
          monthOld
            ? getFxRateNearDate(
                marketCurrency,
                monthOld.captured_at,
                fxByCurrency
              )
            : null;

        const costFx =
          getLatestFxRate(
            costCurrency,
            fxByCurrency
          );

        const investedNative =
          quantity *
          averageCost;

        const investedApproxEur =
          costFx !== null
            ? investedNative *
              costFx
            : null;

        const marketValueNative =
          latestPrice !== null
            ? quantity *
              latestPrice
            : null;

        const marketValueEur =
          marketValueNative !==
            null &&
          latestFx !== null
            ? marketValueNative *
              latestFx
            : null;

        const profitLossEur =
          marketValueEur !==
            null &&
          investedApproxEur !==
            null
            ? marketValueEur -
              investedApproxEur
            : null;

        const profitLossPercent =
          profitLossEur !== null &&
          investedApproxEur !==
            null &&
          investedApproxEur > 0
            ? (
                profitLossEur /
                investedApproxEur
              ) *
              100
            : null;

        const latestUnitEur =
          latestPrice !== null &&
          latestFx !== null
            ? latestPrice *
              latestFx
            : null;

        const monthUnitEur =
          monthPrice !== null &&
          monthFx !== null
            ? monthPrice *
              monthFx
            : null;

        const monthChangeEur =
          latestUnitEur !== null &&
          monthUnitEur !== null &&
          monthUnitEur > 0
            ? (
                (
                  latestUnitEur -
                  monthUnitEur
                ) /
                monthUnitEur
              ) *
              100
            : null;

        return {
          id:
            position.id,

          instrumentId:
            position.instrument_id,

          name:
            instrument?.name ??
            "Unbekannt",

          symbol:
            instrument?.symbol ??
            null,

          depot:
            portfolio?.bank_name ??
            portfolio?.name ??
            "–",

          assetType:
            instrument?.asset_type ??
            "unknown",

          quantity,

          averageCost,

          costCurrency,

          marketCurrency,

          latestPrice,

          latestFx,

          monthPrice,

          monthFx,

          latestDate:
            latest?.captured_at ??
            null,

          investedNative,

          investedApproxEur,

          marketValueNative,

          marketValueEur,

          profitLossEur,

          profitLossPercent,

          monthChangeEur,
        };
      }
    );

  /*
   * SYMBOLE IM EIGENEN DEPOT
   */
  const portfolioSymbols =
    new Set(
      marketPositions
        .map(
          (position) =>
            position.symbol
              ?.trim()
              .toUpperCase()
        )
        .filter(
          (
            symbol
          ): symbol is string =>
            Boolean(
              symbol
            )
        )
    );

  /*
   * HISTORISCHER DEPOTWERT
   */
  const portfolioChartData =
    buildPortfolioChartData(
      historicalTransactions,
      snapshotsByInstrument,
      fxByCurrency
    );

  const marketValueEur =
    marketPositions.reduce(
      (
        sum,
        position
      ) =>
        sum +
        (
          position.marketValueEur ??
          0
        ),
      0
    );

  const investedApproxEur =
    marketPositions.reduce(
      (
        sum,
        position
      ) =>
        sum +
        (
          position.investedApproxEur ??
          0
        ),
      0
    );

  const totalProfitLoss =
    marketValueEur -
    investedApproxEur;

  const totalProfitLossPercent =
    investedApproxEur >
    0
      ? (
          totalProfitLoss /
          investedApproxEur
        ) *
        100
      : 0;

  const positionsWithPrice =
    marketPositions.filter(
      (position) =>
        position.marketValueEur !==
        null
    );

  /*
   * TOPS / FLOPS IM EIGENEN DEPOT
   */
  const topPositions =
    marketPositions
      .filter(
        (
          position
        ): position is MarketPosition & {
          monthChangeEur: number;
        } =>
          position.monthChangeEur !==
          null
      )
      .sort(
        (a, b) =>
          b.monthChangeEur -
          a.monthChangeEur
      )
      .slice(
        0,
        3
      );

  const flopPositions =
    marketPositions
      .filter(
        (
          position
        ): position is MarketPosition & {
          monthChangeEur: number;
        } =>
          position.monthChangeEur !==
          null
      )
      .sort(
        (a, b) =>
          a.monthChangeEur -
          b.monthChangeEur
      )
      .slice(
        0,
        3
      );

  /*
   * PORTFOLIO-MIX
   */
  const allocationTotals:
    Record<
      string,
      number
    > = {
      stock: 0,
      etf: 0,
      fund: 0,
      cash: 0,
    };

  for (
    const position
    of marketPositions
  ) {
    allocationTotals[
      position.assetType
    ] =
      (
        allocationTotals[
          position.assetType
        ] ?? 0
      ) +
      (
        position.marketValueEur ??
        position.investedApproxEur ??
        0
      );
  }

  const allocationTotal =
    Object.values(
      allocationTotals
    ).reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    );

  const allocation =
    [
      {
        label: "ETFs",

        value:
          allocationPercent(
            allocationTotals.etf,
            allocationTotal
          ),
      },
      {
        label:
          "Einzeltitel",

        value:
          allocationPercent(
            allocationTotals.stock,
            allocationTotal
          ),
      },
      {
        label: "Fonds",

        value:
          allocationPercent(
            allocationTotals.fund,
            allocationTotal
          ),
      },
      {
        label: "Cash",

        value:
          allocationPercent(
            allocationTotals.cash,
            allocationTotal
          ),
      },
    ].filter(
      (item) =>
        item.value > 0
    );

  /*
   * MARKET MOVERS
   */
  const {
    data:
      latestMoverDateData,
    error:
      latestMoverDateError,
  } = await supabase
    .from(
      "market_movers"
    )
    .select(
      "market_date"
    )
    .eq(
      "user_id",
      userId
    )
    .eq(
      "source",
      ALPHA_VANTAGE_PROVIDER
    )
    .order(
      "market_date",
      {
        ascending: false,
      }
    )
    .limit(1);

  if (
    latestMoverDateError
  ) {
    console.error(
      "Market Movers date load error:",
      latestMoverDateError
    );
  }

  const latestMarketMoverDate =
    latestMoverDateData?.[0]
      ?.market_date ??
    null;

  let marketMovers:
    MarketMoverRow[] = [];

  if (
    latestMarketMoverDate
  ) {
    const {
      data:
        marketMoverData,
      error:
        marketMoverError,
    } = await supabase
      .from(
        "market_movers"
      )
      .select(`
        id,
        market_date,
        category,
        rank,
        ticker,
        price,
        change_amount,
        change_percentage,
        volume,
        source
      `)
      .eq(
        "user_id",
        userId
      )
      .eq(
        "market_date",
        latestMarketMoverDate
      )
      .eq(
        "source",
        ALPHA_VANTAGE_PROVIDER
      )
      .order(
        "rank",
        {
          ascending: true,
        }
      );

    if (
      marketMoverError
    ) {
      console.error(
        "Market Movers load error:",
        marketMoverError
      );
    }

    marketMovers =
      (marketMoverData as
        | MarketMoverRow[]
        | null) ?? [];
  }

  const topGainers =
    marketMovers
      .filter(
        (mover) =>
          mover.category ===
          "gainer"
      )
      .sort(
        (a, b) =>
          a.rank -
          b.rank
      );

  const topLosers =
    marketMovers
      .filter(
        (mover) =>
          mover.category ===
          "loser"
      )
      .sort(
        (a, b) =>
          a.rank -
          b.rank
      );

  /*
   * LETZTEN KI-REVIEW LADEN
   */
  const {
    data: reviewData,
    error: reviewLoadError,
  } = await supabase
    .from(
      "portfolio_reviews"
    )
    .select(`
      id,
      created_at,
      model,
      portfolio_value_eur,
      invested_value_eur,
      profit_loss_eur,
      profit_loss_percent,
      position_count,
      review_text,
      review_data,
      sources,
      status
    `)
    .eq(
      "user_id",
      userId
    )
    .eq(
      "status",
      "completed"
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1);

  if (
    reviewLoadError
  ) {
    console.error(
      "Portfolio review load error:",
      reviewLoadError
    );
  }

  const latestReview =
    (
      reviewData as
        | PortfolioReviewRow[]
        | null
    )?.[0] ??
    null;

  /*
   * API-CREDITS
   */
  const today =
    berlinDateString();

  const {
    data:
      alphaUsageData,
  } = await supabase
    .from("api_usage")
    .select(
      "request_count"
    )
    .eq(
      "user_id",
      userId
    )
    .eq(
      "provider",
      ALPHA_VANTAGE_PROVIDER
    )
    .eq(
      "usage_date",
      today
    )
    .maybeSingle();

  const alphaApiRequests =
    Number(
      alphaUsageData
        ?.request_count ??
      0
    );

  const alphaApiRemaining =
    Math.max(
      0,
      ALPHA_VANTAGE_DAILY_LIMIT -
        alphaApiRequests
    );

  const alphaUsagePercent =
    Math.min(
      100,
      (
        alphaApiRequests /
        ALPHA_VANTAGE_DAILY_LIMIT
      ) *
        100
    );

  const {
    data:
      geminiUsageData,
  } = await supabase
    .from("api_usage")
    .select(
      "request_count"
    )
    .eq(
      "user_id",
      userId
    )
    .eq(
      "provider",
      GEMINI_PROVIDER
    )
    .eq(
      "usage_date",
      today
    )
    .maybeSingle();

  const geminiApiRequests =
    Number(
      geminiUsageData
        ?.request_count ??
      0
    );

  const geminiApiRemaining =
    Math.max(
      0,
      GEMINI_DAILY_LIMIT -
        geminiApiRequests
    );

  const geminiUsagePercent =
    Math.min(
      100,
      (
        geminiApiRequests /
        GEMINI_DAILY_LIMIT
      ) *
        100
    );

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>
            DepotCockpit
          </h1>

          <p>
            Alle Depots,
            Positionen und Reports
            in einer Übersicht.
          </p>
        </div>

        <div className="actions">
          <Link
            href="/depots"
            className="button"
          >
            <WalletCards
              size={16}
            />

            Depots
          </Link>

          <Link
            href="/positions"
            className="button primary"
          >
            <Plus
              size={16}
            />

            Position
          </Link>

          <Link
            href="/transactions"
            className="button"
          >
            <ReceiptText
              size={16}
            />

            Transaktionen
          </Link>

          <RefreshPricesButton
            action={
              syncMarketData
            }
          />

<Link
  href="/reports"
  className="button"
>
  <Download
    size={16}
  />

  Reports
</Link>

          <LogoutButton />
        </div>
      </div>

      <section
        style={{
          display:
            "flex",

          justifyContent:
            "flex-end",

          alignItems:
            "stretch",

          gap:
            10,

          flexWrap:
            "wrap",

          marginBottom:
            16,
        }}
      >
        <CreditCard
          label="Alpha Vantage"
          used={
            alphaApiRequests
          }
          limit={
            ALPHA_VANTAGE_DAILY_LIMIT
          }
          remaining={
            alphaApiRemaining
          }
          usagePercent={
            alphaUsagePercent
          }
        />

        <CreditCard
          label="Gemini"
          used={
            geminiApiRequests
          }
          limit={
            GEMINI_DAILY_LIMIT
          }
          remaining={
            geminiApiRemaining
          }
          usagePercent={
            geminiUsagePercent
          }
        />
      </section>

      {searchParams
        ?.marketSuccess && (
        <MessageBox
          type="success"
          text={
            searchParams.marketSuccess
          }
        />
      )}

      {searchParams
        ?.marketError && (
        <MessageBox
          type="error"
          text={
            searchParams.marketError
          }
        />
      )}

      {searchParams
        ?.reviewSuccess && (
        <MessageBox
          type="success"
          text={
            searchParams.reviewSuccess
          }
        />
      )}

      {searchParams
        ?.reviewError && (
        <MessageBox
          type="error"
          text={
            searchParams.reviewError
          }
        />
      )}

      <section className="grid kpis">
        <div className="card">
          <div className="kpi-label">
            Gesamtwert
          </div>

          <div className="kpi-value">
            {positionsWithPrice.length >
            0
              ? formatMoney(
                  marketValueEur
                )
              : "–"}
          </div>

          <div className="delta">
            {
              positionsWithPrice.length
            }
            {" / "}
            {
              marketPositions.length
            }
            {" Positionen bewertet"}
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">
            Einstand ca.
          </div>

          <div className="kpi-value">
            {formatMoney(
              investedApproxEur
            )}
          </div>

          <div className="delta">
            Fremdwährungen zum
            aktuellen FX-Kurs
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">
            Gewinn / Verlust
          </div>

          <div
            className="kpi-value"
            style={{
              color:
                totalProfitLoss >=
                0
                  ? "#0b8f55"
                  : "#c74646",
            }}
          >
            {totalProfitLoss >=
            0
              ? "+"
              : ""}

            {formatMoney(
              totalProfitLoss
            )}
          </div>

          <div
            className={
              totalProfitLoss >=
              0
                ? "delta positive"
                : "delta negative"
            }
          >
            {totalProfitLossPercent >=
            0
              ? "+"
              : ""}

            {totalProfitLossPercent.toLocaleString(
              "de-DE",
              {
                minimumFractionDigits:
                  2,

                maximumFractionDigits:
                  2,
              }
            )}
            %
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">
            Depots / Positionen
          </div>

          <div className="kpi-value">
            {portfolios
              ?.length ??
              0}

            {" / "}

            {
              marketPositions.length
            }
          </div>

          <div className="delta">
            Depots · Positionen
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>
            Wertentwicklung gesamt
          </h2>

          {portfolioChartData.length >
          1 ? (
            <>
              <PortfolioChart
                data={
                  portfolioChartData
                }
              />

              <p
                className="meta"
                style={{
                  marginTop:
                    12,

                  lineHeight:
                    1.5,
                }}
              >
                Historischer Wert
                deiner tatsächlich
                gehaltenen
                Wertpapierpositionen
                auf Basis von Käufen,
                Verkäufen,
                Tageskursen und
                Wechselkursen. Cash,
                Dividenden und
                Gebühren sind noch
                nicht enthalten.
              </p>
            </>
          ) : (
            <DashboardEmpty
              title="Noch keine historische Performance"
              text="Für den historischen Depotwert werden Käufe oder Verkäufe sowie passende historische Kursdaten benötigt."
            />
          )}
        </div>

        <div className="card">
          <h2>
            Portfolio-Mix
          </h2>

          {allocation.length >
          0 ? (
            <div className="allocation">
              {allocation.map(
                (item) => (
                  <div
                    key={
                      item.label
                    }
                  >
                    <div
                      className="row"
                      style={{
                        padding:
                          "6px 0",

                        border:
                          0,
                      }}
                    >
                      <span>
                        {
                          item.label
                        }
                      </span>

                      <strong>
                        {item.value.toLocaleString(
                          "de-DE",
                          {
                            maximumFractionDigits:
                              1,
                          }
                        )}
                        %
                      </strong>
                    </div>

                    <div className="bar">
                      <div
                        className="fill"
                        style={{
                          width:
                            `${item.value}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <DashboardEmpty
              title="Noch keine Verteilung"
              text="Die Verteilung entsteht automatisch aus deinen Positionen."
            />
          )}
        </div>
      </section>

      {marketMovers.length >
      0 ? (
        <section
          style={{
            marginBottom:
              20,
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "flex-end",

              gap:
                16,

              marginBottom:
                10,
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    0,

                  color:
                    "#26344f",

                  fontSize:
                    18,
                }}
              >
                Marktbewegungen · USA
              </h2>

              <p
                className="meta"
                style={{
                  margin:
                    "4px 0 0",
                }}
              >
                Größte prozentuale
                Tagesgewinner und
                -verlierer. Sehr
                kleine und volatile
                Titel können daher
                weit oben erscheinen.
              </p>
            </div>

            {latestMarketMoverDate && (
              <span
                className="badge"
              >
                Stand{" "}
                {formatGermanDate(
                  latestMarketMoverDate
                )}
              </span>
            )}
          </div>

          <div className="grid two">
            <MarketMoverCard
              title="Top Gewinner"
              type="gainer"
              movers={
                topGainers
              }
              portfolioSymbols={
                portfolioSymbols
              }
            />

            <MarketMoverCard
              title="Top Verlierer"
              type="loser"
              movers={
                topLosers
              }
              portfolioSymbols={
                portfolioSymbols
              }
            />
          </div>
        </section>
      ) : (
        <section
          className="card"
          style={{
            marginBottom:
              20,
          }}
        >
          <h2>
            Marktbewegungen · USA
          </h2>

          <DashboardEmpty
            title="Noch keine Market Movers"
            text="Klicke auf Kurse aktualisieren. Die Gewinner und Verlierer werden einmal täglich geladen."
          />
        </section>
      )}

<section
  className="card"
  style={{
    marginBottom: 20,
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 18,
      flexWrap: "wrap",
      marginBottom: latestReview ? 18 : 0,
    }}
  >
    <div>
      <h2
        style={{
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Sparkles size={18} />

        KI-Portfolio-Review
      </h2>

      <p
        className="meta"
        style={{
          margin: "6px 0 0",
          lineHeight: 1.5,
        }}
      >
        Analyse deiner Portfolio-Kennzahlen mit aktuellen,
        recherchierten Nachrichten.
      </p>
    </div>

    <form action={generatePortfolioReview}>
      <button
        type="submit"
        className={
          latestReview
            ? "button"
            : "button primary"
        }
      >
        {latestReview ? (
          <RefreshCw size={15} />
        ) : (
          <Sparkles size={15} />
        )}

        {latestReview
          ? "Review aktualisieren"
          : "KI-Review erstellen"}
      </button>
    </form>
  </div>

  {latestReview ? (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <span className="badge">
          {latestReview.model}
        </span>

        <span className="meta">
          Erstellt{" "}
          {formatDateTime(
            latestReview.created_at
          )}
        </span>

        <span className="meta">
          ·
        </span>

        <span className="meta">
          {latestReview.position_count}
          {" Positionen"}
        </span>

        {latestReview.portfolio_value_eur !==
          null && (
          <>
            <span className="meta">
              ·
            </span>

            <span className="meta">
              Depotwert{" "}
              {formatMoney(
                numeric(
                  latestReview.portfolio_value_eur
                )
              )}
            </span>
          </>
        )}
      </div>

      <ReviewContent
        text={
          latestReview.review_text
        }
      />

      {Array.isArray(
        latestReview.sources
      ) &&
        latestReview.sources.length >
          0 && (
          <details
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop:
                "1px solid #e7eaf0",
            }}
          >
            <summary
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "#697386",
                fontSize: 12,
                fontWeight: 650,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              Quellen anzeigen
              <span
                style={{
                  color: "#929aa7",
                  fontWeight: 500,
                }}
              >
                (
                {
                  latestReview
                    .sources.length
                }
                )
              </span>
            </summary>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 12,
                paddingLeft: 2,
              }}
            >
              {latestReview.sources.map(
                (
                  source,
                  index
                ) => {
                  if (!source.url) {
                    return null;
                  }

                  return (
                    <a
                      key={`${source.url}-${index}`}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color:
                          "#3759a8",
                        fontSize: 12,
                        lineHeight: 1.45,
                        textDecoration:
                          "none",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {source.title ??
                        source.url}
                    </a>
                  );
                }
              )}
            </div>
          </details>
        )}
    </>
  ) : (
    <DashboardEmpty
      title="Noch kein KI-Review"
      text="Erstelle deinen ersten Review. Gemini analysiert die aktuellen Depotkennzahlen und recherchiert relevante aktuelle Nachrichten."
    />
  )}
</section>

      <section className="grid three">
        <div className="card">
          <h2>
            Tops des Monats
          </h2>

          {topPositions.length >
          0 ? (
            topPositions.map(
              (position) => (
                <PerformanceRow
                  key={
                    position.id
                  }
                  position={
                    position
                  }
                />
              )
            )
          ) : (
            <DashboardEmpty
              title="Noch keine Monatsdaten"
              text="Synchronisiere die Kurs- und FX-Daten."
            />
          )}
        </div>

        <div className="card">
          <h2>
            Flops des Monats
          </h2>

          {flopPositions.length >
          0 ? (
            flopPositions.map(
              (position) => (
                <PerformanceRow
                  key={
                    position.id
                  }
                  position={
                    position
                  }
                />
              )
            )
          ) : (
            <DashboardEmpty
              title="Noch keine Monatsdaten"
              text="Nach dem Datenabruf erscheint hier die EUR-Monatsperformance."
            />
          )}
        </div>

        <div className="card">
          <h2>
            <Sparkles
              size={17}
            />

            Review-Historie
          </h2>

          {latestReview ? (
            <>
              <p className="review">
                Der aktuelle Review
                ist gespeichert. Jede
                Aktualisierung erzeugt
                einen neuen Eintrag,
                sodass wir als
                nächsten Schritt eine
                echte Review-Historie
                aufbauen können.
              </p>

              <span className="badge">
                {
                  formatDateTime(
                    latestReview.created_at
                  )
                }
              </span>
            </>
          ) : (
            <p className="review">
              Sobald der erste
              KI-Review erstellt
              wurde, liegt er
              dauerhaft in
              Supabase.
            </p>
          )}
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap:
                12,

              marginBottom:
                8,
            }}
          >
            <h2
              style={{
                margin:
                  0,
              }}
            >
              Positionen
            </h2>

            <Link
              href="/positions"
              className="button"
            >
              <BarChart3
                size={15}
              />

              Verwalten
            </Link>
          </div>

          {marketPositions.length ===
          0 ? (
            <DashboardEmpty
              title="Noch keine Positionen"
              text="Füge deine erste Position hinzu."
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>
                    Titel
                  </th>

                  <th>
                    Depot
                  </th>

                  <th className="align-right">
                    Stück
                  </th>

                  <th className="align-right">
                    Kurs
                  </th>

                  <th className="align-right">
                    Wert EUR
                  </th>

                  <th className="align-right">
                    G/V
                  </th>
                </tr>
              </thead>

              <tbody>
                {marketPositions.map(
                  (
                    position
                  ) => (
                    <tr
                      key={
                        position.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            position.name
                          }
                        </strong>

                        <div className="meta">
                          {position.symbol ??
                            assetTypeLabel(
                              position.assetType
                            )}
                        </div>
                      </td>

                      <td>
                        {
                          position.depot
                        }
                      </td>

                      <td className="align-right">
                        {formatQuantity(
                          position.quantity
                        )}
                      </td>

                      <td className="align-right">
                        {position.latestPrice !==
                        null
                          ? formatMoney(
                              position.latestPrice,
                              position.marketCurrency
                            )
                          : "–"}
                      </td>

                      <td className="align-right">
                        <strong>
                          {position.marketValueEur !==
                          null
                            ? formatMoney(
                                position.marketValueEur
                              )
                            : "–"}
                        </strong>
                      </td>

                      <td className="align-right">
                        {position.profitLossEur !==
                          null &&
                        position.profitLossPercent !==
                          null ? (
                          <strong
                            className={
                              position.profitLossEur >=
                              0
                                ? "positive"
                                : "negative"
                            }
                          >
                            {position.profitLossEur >=
                            0
                              ? "+"
                              : ""}

                            {formatMoney(
                              position.profitLossEur
                            )}

                            <div className="meta">
                              {position.profitLossPercent >=
                              0
                                ? "+"
                                : ""}

                              {position.profitLossPercent.toLocaleString(
                                "de-DE",
                                {
                                  maximumFractionDigits:
                                    2,
                                }
                              )}
                              %
                            </div>
                          </strong>
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>
            Wochenreports
          </h2>

          <DashboardEmpty
            title="Noch keine Reports"
            text="Die Reports bauen wir auf den echten Kurs- und FX-Daten auf."
          />
        </div>
      </section>
    </main>
  );
}

function CreditCard({
  label,
  used,
  limit,
  remaining,
  usagePercent,
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  usagePercent: number;
}) {
  return (
    <div
      style={{
        minWidth:
          190,

        padding:
          "10px 13px",

        border:
          "1px solid #e7eaf0",

        borderRadius:
          12,

        background:
          "#ffffff",
      }}
      title={`Heute verwendete ${label}-API-Aufrufe`}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          gap:
            12,
        }}
      >
        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              7,
          }}
        >
          <Gauge
            size={15}
          />

          <span
            style={{
              color:
                "#697386",

              fontSize:
                11,

              fontWeight:
                600,
            }}
          >
            {label}
          </span>
        </div>

        <strong
          style={{
            fontSize:
              12,
          }}
        >
          {used}
          {" / "}
          {limit}
        </strong>
      </div>

      <div
        className="bar"
        style={{
          marginTop:
            8,
        }}
      >
        <div
          className="fill"
          style={{
            width:
              `${usagePercent}%`,
          }}
        />
      </div>

      <div
        style={{
          marginTop:
            6,

          color:
            remaining <=
            Math.max(
              5,
              Math.floor(
                limit *
                  0.1
              )
            )
              ? "#c74646"
              : "#929aa7",

          fontSize:
            10,
        }}
      >
        Noch{" "}
        {remaining} Requests
        heute
      </div>
    </div>
  );
}

function MessageBox({
  type,
  text,
}: {
  type:
    | "success"
    | "error";

  text: string;
}) {
  const success =
    type ===
    "success";

  return (
    <div
      style={{
        marginBottom:
          16,

        padding:
          "13px 16px",

        border:
          success
            ? "1px solid #cdebd9"
            : "1px solid #ffd8d8",

        borderRadius:
          12,

        background:
          success
            ? "#effaf3"
            : "#fff5f5",

        color:
          success
            ? "#137044"
            : "#aa3030",

        fontSize:
          13,
      }}
    >
      {text}
    </div>
  );
}

function ReviewContent({
  text,
}: {
  text: string;
}) {
  const lines = text.split(
    "\n"
  );

  const summaryStart =
    lines.findIndex((line) => {
      const normalized =
        line
          .trim()
          .toLowerCase();

      return (
        normalized ===
          "## kurzfazit" ||
        normalized ===
          "### kurzfazit"
      );
    });

  let summaryLines:
    string[] = [];

  let detailLines:
    string[] = [];

  if (summaryStart >= 0) {
    const nextHeading =
      lines.findIndex(
        (line, index) =>
          index >
            summaryStart &&
          line
            .trim()
            .startsWith(
              "## "
            )
      );

    const summaryEnd =
      nextHeading >= 0
        ? nextHeading
        : lines.length;

    summaryLines =
      lines.slice(
        summaryStart,
        summaryEnd
      );

    detailLines = [
      ...lines.slice(
        0,
        summaryStart
      ),
      ...lines.slice(
        summaryEnd
      ),
    ].filter(
      (line) =>
        line.trim()
          .length > 0
    );
  } else {
    const firstHeading =
      lines.findIndex(
        (line) =>
          line
            .trim()
            .startsWith(
              "## "
            )
      );

    if (firstHeading > 0) {
      summaryLines =
        lines.slice(
          0,
          firstHeading
        );

      detailLines =
        lines.slice(
          firstHeading
        );
    } else {
      summaryLines =
        lines.slice(
          0,
          Math.min(
            3,
            lines.length
          )
        );

      detailLines =
        lines.slice(
          Math.min(
            3,
            lines.length
          )
        );
    }
  }

  const renderInlineText = (
    value: string
  ) => {
    const parts =
      value.split(
        /(\*\*.+?\*\*)/g
      );

    return parts.map(
      (
        part,
        index
      ) => {
        if (
          part.startsWith(
            "**"
          ) &&
          part.endsWith(
            "**"
          )
        ) {
          return (
            <strong
              key={
                index
              }
              style={{
                color:
                  "#26344f",
                fontWeight:
                  700,
              }}
            >
              {part.slice(
                2,
                -2
              )}
            </strong>
          );
        }

        return part;
      }
    );
  };

  const renderLines = (
    content:
      string[]
  ) => {
    return content.map(
      (
        rawLine,
        index
      ) => {
        const line =
          rawLine.trim();

        if (!line) {
          return (
            <div
              key={
                index
              }
              style={{
                height: 8,
              }}
            />
          );
        }

        if (
          line
            .toLowerCase()
            .startsWith(
              "## kurzfazit"
            ) ||
          line
            .toLowerCase()
            .startsWith(
              "### kurzfazit"
            )
        ) {
          return (
            <div
              key={
                index
              }
              style={{
                marginBottom:
                  8,
                color:
                  "#697386",
                fontSize:
                  11,
                fontWeight:
                  700,
                letterSpacing:
                  "0.06em",
                textTransform:
                  "uppercase",
              }}
            >
              Kurzfazit
            </div>
          );
        }

        if (
          line.startsWith(
            "## "
          )
        ) {
          return (
            <h3
              key={
                index
              }
              style={{
                margin:
                  "18px 0 7px",
                color:
                  "#26344f",
                fontSize: 15,
              }}
            >
              {renderInlineText(
                line.slice(
                  3
                )
              )}
            </h3>
          );
        }

        if (
          line.startsWith(
            "### "
          )
        ) {
          return (
            <h4
              key={
                index
              }
              style={{
                margin:
                  "14px 0 6px",
                color:
                  "#26344f",
                fontSize: 13,
              }}
            >
              {renderInlineText(
                line.slice(
                  4
                )
              )}
            </h4>
          );
        }

        if (
          line.startsWith(
            "- "
          ) ||
          line.startsWith(
            "* "
          )
        ) {
          return (
            <div
              key={
                index
              }
              style={{
                display:
                  "flex",
                gap: 8,
                margin:
                  "4px 0",
              }}
            >
              <span
                style={{
                  color:
                    "#929aa7",
                }}
              >
                •
              </span>

              <span>
                {renderInlineText(
                  line.slice(
                    2
                  )
                )}
              </span>
            </div>
          );
        }

        return (
          <p
            key={index}
            style={{
              margin:
                "6px 0",
            }}
          >
            {renderInlineText(
              line
            )}
          </p>
        );
      }
    );
  };

  return (
    <div
      style={{
        color:
          "#3d4657",
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      <div
        style={{
          padding:
            "14px 16px",
          border:
            "1px solid #e7eaf0",
          borderRadius: 12,
          background:
            "#f8f9fb",
        }}
      >
        {renderLines(
          summaryLines
        )}
      </div>

      {detailLines.length >
        0 && (
        <details
          style={{
            marginTop: 12,
          }}
        >
          <summary
            style={{
              color:
                "#3759a8",
              fontSize: 12,
              fontWeight: 650,
              cursor:
                "pointer",
              userSelect:
                "none",
            }}
          >
            Detaillierte Analyse
            anzeigen
          </summary>

          <div
            style={{
              marginTop: 14,
            }}
          >
            {renderLines(
              detailLines
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function MarketMoverCard({
  title,
  type,
  movers,
  portfolioSymbols,
}: {
  title: string;

  type:
    | "gainer"
    | "loser";

  movers:
    MarketMoverRow[];

  portfolioSymbols:
    Set<string>;
}) {
  const visibleMovers =
    movers.slice(
      0,
      5
    );

  const hiddenMovers =
    movers.slice(
      5
    );

  const positive =
    type ===
    "gainer";

  return (
    <div className="card">
      <h2>
        {positive ? (
          <TrendingUp
            size={18}
            style={{
              color:
                "#0b8f55",
            }}
          />
        ) : (
          <TrendingDown
            size={18}
            style={{
              color:
                "#c74646",
            }}
          />
        )}

        {title}
      </h2>

      {visibleMovers.length >
      0 ? (
        <>
          <div>
            {visibleMovers.map(
              (mover) => (
                <MarketMoverItem
                  key={
                    mover.id
                  }
                  mover={
                    mover
                  }
                  isInPortfolio={
                    portfolioSymbols.has(
                      mover.ticker
                        .trim()
                        .toUpperCase()
                    )
                  }
                />
              )
            )}
          </div>

          {hiddenMovers.length >
            0 && (
            <details
              style={{
                marginTop:
                  8,

                borderTop:
                  "1px solid #edf0f4",

                paddingTop:
                  8,
              }}
            >
              <summary
                style={{
                  cursor:
                    "pointer",

                  color:
                    "#697386",

                  fontSize:
                    11,

                  fontWeight:
                    700,

                  userSelect:
                    "none",

                  padding:
                    "6px 0",
                }}
              >
                Plätze 6–
                {movers.length} anzeigen
              </summary>

              <div
                style={{
                  marginTop:
                    4,
                }}
              >
                {hiddenMovers.map(
                  (mover) => (
                    <MarketMoverItem
                      key={
                        mover.id
                      }
                      mover={
                        mover
                      }
                      isInPortfolio={
                        portfolioSymbols.has(
                          mover.ticker
                            .trim()
                            .toUpperCase()
                        )
                      }
                    />
                  )
                )}
              </div>
            </details>
          )}
        </>
      ) : (
        <DashboardEmpty
          title={
            positive
              ? "Keine Gewinner"
              : "Keine Verlierer"
          }
          text="Für diesen Markttag wurden keine Daten gespeichert."
        />
      )}
    </div>
  );
}

function MarketMoverItem({
  mover,
  isInPortfolio,
}: {
  mover: MarketMoverRow;
  isInPortfolio: boolean;
}) {
  const changePercentage =
    numeric(
      mover.change_percentage
    );

  const positive =
    mover.category ===
    "gainer";

  return (
    <div
      className="row"
      style={{
        padding:
          "10px 0",
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          gap:
            11,

          minWidth:
            0,
        }}
      >
        <span
          style={{
            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            width:
              26,

            height:
              26,

            flexShrink:
              0,

            borderRadius:
              8,

            background:
              positive
                ? "#effaf3"
                : "#fff3f3",

            color:
              positive
                ? "#137044"
                : "#aa3030",

            fontSize:
              10,

            fontWeight:
              700,
          }}
        >
          #{mover.rank}
        </span>

        <div
          style={{
            minWidth:
              0,
          }}
        >
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                7,

              flexWrap:
                "wrap",
            }}
          >
            <div className="symbol">
              {mover.ticker}
            </div>

            {isInPortfolio && (
              <span
                style={{
                  padding:
                    "2px 6px",

                  borderRadius:
                    999,

                  background:
                    "#eef3ff",

                  color:
                    "#314d8d",

                  fontSize:
                    9,

                  fontWeight:
                    700,

                  whiteSpace:
                    "nowrap",
                }}
              >
                Im Depot
              </span>
            )}
          </div>

          <div className="meta">
            {formatMoney(
              numeric(
                mover.price
              ),
              "USD"
            )}

            {" · Vol. "}

            {formatVolume(
              numeric(
                mover.volume
              )
            )}
          </div>
        </div>
      </div>

      <strong
        className={
          positive
            ? "positive"
            : "negative"
        }
        style={{
          flexShrink:
            0,
        }}
      >
        {changePercentage >=
        0
          ? "+"
          : ""}

        {changePercentage.toLocaleString(
          "de-DE",
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        )}
        %
      </strong>
    </div>
  );
}

function PerformanceRow({
  position,
}: {
  position:
    MarketPosition & {
      monthChangeEur: number;
    };
}) {
  return (
    <div className="row">
      <div>
        <div className="symbol">
          {position.name}
        </div>

        <div className="meta">
          {position.depot}
          {" · "}
          {position.symbol ??
            "–"}
        </div>
      </div>

      <strong
        className={
          position.monthChangeEur >=
          0
            ? "positive"
            : "negative"
        }
      >
        {position.monthChangeEur >=
        0
          ? "+"
          : ""}

        {position.monthChangeEur.toLocaleString(
          "de-DE",
          {
            maximumFractionDigits:
              2,
          }
        )}
        %
      </strong>
    </div>
  );
}

function buildPortfolioChartData(
  transactions:
    HistoricalTransaction[],
  snapshotsByInstrument: Map<
    string,
    PriceSnapshot[]
  >,
  fxByCurrency: Map<
    string,
    FxSnapshot[]
  >
): PortfolioChartPoint[] {
  const orderedTransactions =
    transactions
      .filter(
        (transaction) =>
          (
            transaction.transaction_type ===
              "buy" ||
            transaction.transaction_type ===
              "sell"
          ) &&
          Boolean(
            transaction.instrument_id
          ) &&
          numeric(
            transaction.quantity
          ) > 0
      )
      .sort(
        (a, b) =>
          a.trade_date.localeCompare(
            b.trade_date
          )
      );

  if (
    orderedTransactions.length ===
    0
  ) {
    return [];
  }

  const firstTradeDate =
    orderedTransactions[0]
      .trade_date;

  const dates =
    Array.from(
      new Set(
        Array.from(
          snapshotsByInstrument.values()
        )
          .flat()
          .map(
            (snapshot) =>
              snapshot.captured_at.slice(
                0,
                10
              )
          )
          .filter(
            (date) =>
              date >=
              firstTradeDate
          )
      )
    ).sort();

  if (
    dates.length ===
    0
  ) {
    return [];
  }

  const transactionsByDate =
    new Map<
      string,
      PortfolioChartTransaction[]
    >();

  for (
    const transaction
    of orderedTransactions
  ) {
    const instrument =
      getRelation(
        transaction.instruments
      );

    const quantity =
      numeric(
        transaction.quantity
      );

    const rawPrice =
      transaction.price_per_unit;

    const pricePerUnit =
      rawPrice === null
        ? null
        : numeric(
            rawPrice
          );

    const currency =
      (
        transaction.currency ||
        instrument?.currency ||
        "EUR"
      )
        .trim()
        .toUpperCase();

    const item:
      PortfolioChartTransaction =
      {
        type:
          transaction.transaction_type ===
          "sell"
            ? "sell"
            : "buy",

        instrumentName:
          instrument?.name ??
          "Unbekannt",

        symbol:
          instrument?.symbol ??
          null,

        quantity,

        pricePerUnit,

        currency,
      };

    const current =
      transactionsByDate.get(
        transaction.trade_date
      ) ?? [];

    current.push(
      item
    );

    transactionsByDate.set(
      transaction.trade_date,
      current
    );
  }

  const holdings =
    new Map<
      string,
      number
    >();

  const result:
    PortfolioChartPoint[] =
    [];

  let transactionIndex =
    0;

  for (
    const date
    of dates
  ) {
    while (
      transactionIndex <
        orderedTransactions.length &&
      orderedTransactions[
        transactionIndex
      ].trade_date <=
        date
    ) {
      const transaction =
        orderedTransactions[
          transactionIndex
        ];

      const instrumentId =
        transaction.instrument_id;

      if (
        instrumentId
      ) {
        const quantity =
          numeric(
            transaction.quantity
          );

        const currentQuantity =
          holdings.get(
            instrumentId
          ) ?? 0;

        if (
          transaction.transaction_type ===
          "buy"
        ) {
          holdings.set(
            instrumentId,
            currentQuantity +
              quantity
          );
        }

        if (
          transaction.transaction_type ===
          "sell"
        ) {
          holdings.set(
            instrumentId,
            Math.max(
              0,
              currentQuantity -
                quantity
            )
          );
        }
      }

      transactionIndex +=
        1;
    }

    const activeHoldings =
      Array.from(
        holdings.entries()
      ).filter(
        (
          [
            _instrumentId,
            quantity,
          ]
        ) =>
          quantity >
          0.0000000001
      );

    if (
      activeHoldings.length ===
      0
    ) {
      continue;
    }

    let totalValueEur =
      0;

    let complete =
      true;

    for (
      const [
        instrumentId,
        quantity,
      ] of activeHoldings
    ) {
      const snapshots =
        snapshotsByInstrument.get(
          instrumentId
        ) ?? [];

      const priceSnapshot =
        findPriceSnapshotOnOrBefore(
          snapshots,
          date
        );

      if (
        !priceSnapshot
      ) {
        complete =
          false;

        break;
      }

      const price =
        numeric(
          priceSnapshot.price
        );

      const currency =
        (
          priceSnapshot.currency ||
          "EUR"
        )
          .trim()
          .toUpperCase();

      const fx =
        getFxRateOnOrBefore(
          currency,
          date,
          fxByCurrency
        );

      if (
        fx === null
      ) {
        complete =
          false;

        break;
      }

      totalValueEur +=
        quantity *
        price *
        fx;
    }

    if (
      complete &&
      totalValueEur >
        0
    ) {
      result.push({
        date:
          formatChartDate(
            date
          ),

        rawDate:
          date,

        value:
          Math.round(
            totalValueEur *
              100
          ) /
          100,

        transactions:
          transactionsByDate.get(
            date
          ) ?? [],
      });
    }
  }

  return result;
}

function findPriceSnapshotOnOrBefore(
  snapshots:
    PriceSnapshot[],
  date: string
): PriceSnapshot | null {
  const target =
    endOfUtcDay(
      date
    );

  let best:
    PriceSnapshot | null =
    null;

  let bestTime =
    Number.NEGATIVE_INFINITY;

  for (
    const snapshot
    of snapshots
  ) {
    const snapshotTime =
      new Date(
        snapshot.captured_at
      ).getTime();

    if (
      snapshotTime <=
        target &&
      snapshotTime >
        bestTime
    ) {
      best =
        snapshot;

      bestTime =
        snapshotTime;
    }
  }

  return best;
}

function getFxRateOnOrBefore(
  currency: string,
  date: string,
  fxByCurrency: Map<
    string,
    FxSnapshot[]
  >
): number | null {
  if (
    currency === "EUR"
  ) {
    return 1;
  }

  const snapshots =
    fxByCurrency.get(
      currency
    ) ?? [];

  if (
    snapshots.length ===
    0
  ) {
    return null;
  }

  const target =
    endOfUtcDay(
      date
    );

  let best:
    FxSnapshot | null =
    null;

  let bestTime =
    Number.NEGATIVE_INFINITY;

  for (
    const snapshot
    of snapshots
  ) {
    const snapshotTime =
      new Date(
        snapshot.captured_at
      ).getTime();

    if (
      snapshotTime <=
        target &&
      snapshotTime >
        bestTime
    ) {
      best =
        snapshot;

      bestTime =
        snapshotTime;
    }
  }

  return best
    ? numeric(
        best.rate
      )
    : null;
}

function getLatestFxRate(
  currency: string,
  fxByCurrency: Map<
    string,
    FxSnapshot[]
  >
): number | null {
  if (
    currency === "EUR"
  ) {
    return 1;
  }

  const snapshots =
    fxByCurrency.get(
      currency
    ) ?? [];

  const latest =
    snapshots[0] ??
    null;

  return latest
    ? numeric(
        latest.rate
      )
    : null;
}

function getFxRateNearDate(
  currency: string,
  date: string,
  fxByCurrency: Map<
    string,
    FxSnapshot[]
  >
): number | null {
  if (
    currency === "EUR"
  ) {
    return 1;
  }

  const dateOnly =
    date.slice(
      0,
      10
    );

  return getFxRateOnOrBefore(
    currency,
    dateOnly,
    fxByCurrency
  );
}

function findMonthOldPriceSnapshot(
  snapshots:
    PriceSnapshot[]
): PriceSnapshot | null {
  if (
    snapshots.length <
    2
  ) {
    return null;
  }

  const latest =
    snapshots[0];

  const latestDate =
    new Date(
      latest.captured_at
    );

  const target =
    new Date(
      latestDate
    );

  target.setUTCMonth(
    target.getUTCMonth() -
      1
  );

  let best:
    PriceSnapshot | null =
    null;

  let smallestDistance =
    Number.POSITIVE_INFINITY;

  for (
    const snapshot
    of snapshots
  ) {
    const timestamp =
      new Date(
        snapshot.captured_at
      ).getTime();

    if (
      timestamp >
      latestDate.getTime()
    ) {
      continue;
    }

    const distance =
      Math.abs(
        timestamp -
        target.getTime()
      );

    if (
      distance <
      smallestDistance
    ) {
      smallestDistance =
        distance;

      best =
        snapshot;
    }
  }

  return best;
}

function getRelation<T>(
  relation:
    | T
    | T[]
    | null
): T | null {
  if (
    !relation
  ) {
    return null;
  }

  if (
    Array.isArray(
      relation
    )
  ) {
    return (
      relation[0] ??
      null
    );
  }

  return relation;
}

function numeric(
  value:
    | number
    | string
    | null
    | undefined
) {
  const result =
    Number(
      value
    );

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}

function allocationPercent(
  value: number,
  total: number
) {
  if (
    total <= 0
  ) {
    return 0;
  }

  return (
    value /
    total
  ) *
    100;
}

function formatMoney(
  value: number,
  currency =
    "EUR"
) {
  try {
    return new Intl.NumberFormat(
      "de-DE",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          2,
      }
    ).format(
      value
    );
  } catch {
    return `${value.toLocaleString(
      "de-DE",
      {
        maximumFractionDigits:
          2,
      }
    )} ${currency}`;
  }
}

function formatQuantity(
  value: number
) {
  return new Intl.NumberFormat(
    "de-DE",
    {
      maximumFractionDigits:
        8,
    }
  ).format(
    value
  );
}

function formatVolume(
  value: number
) {
  return new Intl.NumberFormat(
    "de-DE",
    {
      notation:
        "compact",

      maximumFractionDigits:
        1,
    }
  ).format(
    value
  );
}

function formatChartDate(
  value: string
) {
  const date =
    parseDateOnly(
      value
    );

  if (
    !date
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      day:
        "2-digit",

      month:
        "2-digit",
    }
  ).format(
    date
  );
}

function formatGermanDate(
  value: string
) {
  const date =
    parseDateOnly(
      value
    );

  if (
    !date
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",
    }
  ).format(
    date
  );
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",

      timeZone:
        "Europe/Berlin",
    }
  ).format(
    date
  );
}

function parseDateOnly(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(
        Number
      );

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
}

function endOfUtcDay(
  date: string
) {
  const parsed =
    parseDateOnly(
      date
    );

  if (
    !parsed
  ) {
    return Number.NaN;
  }

  parsed.setUTCHours(
    23,
    59,
    59,
    999
  );

  return parsed.getTime();
}

function assetTypeLabel(
  value: string
) {
  switch (
    value
  ) {
    case "stock":
      return "Aktie";

    case "etf":
      return "ETF";

    case "fund":
      return "Fonds";

    case "cash":
      return "Cash";

    default:
      return value;
  }
}

function berlinDateString() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/Berlin",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;

  return `${year}-${month}-${day}`;
}

function DashboardEmpty({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <strong>
        {title}
      </strong>

      <p>
        {text}
      </p>
    </div>
  );
}