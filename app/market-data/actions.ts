"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  ALPHA_VANTAGE_DAILY_LIMIT,
  ALPHA_VANTAGE_PROVIDER,
  fetchDailyFxRates,
  fetchDailyPrices,
  fetchTopGainersLosers,
} from "@/lib/market-data/alpha-vantage";

type PositionInstrumentRow = {
  instrument_id: string;

  instruments:
    | {
        id: string;
        name: string;
        symbol: string | null;
        currency: string;
      }
    | {
        id: string;
        name: string;
        symbol: string | null;
        currency: string;
      }[]
    | null;
};

type InstrumentToSync = {
  id: string;
  name: string;
  symbol: string;
  currency: string;
};

type SyncStateRow = {
  sync_type: string;
  sync_key: string;
  last_successful_sync_date: string;
};

function getRelation<T>(
  relation:
    | T
    | T[]
    | null
): T | null {
  if (!relation) {
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

function redirectError(
  message: string
): never {
  redirect(
    `/?marketError=${encodeURIComponent(
      message
    )}`
  );
}

function isLimitError(
  message: string
) {
  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "daily_api_limit_reached"
    ) ||
    normalized.includes(
      "limit erreicht"
    ) ||
    normalized.includes(
      "api rate limit"
    ) ||
    normalized.includes(
      "frequency"
    )
  );
}

function berlinDateString() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/Berlin",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
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

async function consumeCredit(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    "consume_market_api_credit",
    {
      p_provider:
        ALPHA_VANTAGE_PROVIDER,

      p_daily_limit:
        ALPHA_VANTAGE_DAILY_LIMIT,
    }
  );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return Number(data);
}

async function markSuccessfulSync(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  userId: string,
  syncType:
    | "instrument"
    | "fx",
  syncKey: string,
  today: string
) {
  const {
    error,
  } = await supabase
    .from(
      "market_sync_state"
    )
    .upsert(
      {
        user_id:
          userId,

        sync_type:
          syncType,

        sync_key:
          syncKey,

        last_successful_sync_date:
          today,

        updated_at:
          new Date()
            .toISOString(),
      },
      {
        onConflict:
          "user_id,sync_type,sync_key",
      }
    );

  if (error) {
    throw new Error(
      `Sync-Status konnte nicht gespeichert werden: ${error.message}`
    );
  }
}

export async function syncMarketData() {
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

  const today =
    berlinDateString();

  const {
    data:
      syncStateData,
    error:
      syncStateError,
  } = await supabase
    .from(
      "market_sync_state"
    )
    .select(`
      sync_type,
      sync_key,
      last_successful_sync_date
    `)
    .eq(
      "user_id",
      userId
    );

  if (
    syncStateError
  ) {
    console.error(
      "Sync state error:",
      syncStateError
    );

    redirectError(
      `Sync-Status konnte nicht gelesen werden: ${syncStateError.message}`
    );
  }

  const syncStates =
    (syncStateData as
      | SyncStateRow[]
      | null) ?? [];

  const syncedToday =
    new Set(
      syncStates
        .filter(
          (state) =>
            state.last_successful_sync_date ===
            today
        )
        .map(
          (state) =>
            `${state.sync_type}:${state.sync_key}`
        )
    );

  const {
    data,
    error:
      positionsError,
  } = await supabase
    .from("positions")
    .select(`
      instrument_id,
      instruments (
        id,
        name,
        symbol,
        currency
      )
    `);

  if (
    positionsError
  ) {
    console.error(
      "Market sync positions error:",
      positionsError
    );

    redirectError(
      `Positionen konnten nicht geladen werden: ${positionsError.message}`
    );
  }

  const rows =
    (data as
      | PositionInstrumentRow[]
      | null) ?? [];

  if (
    rows.length === 0
  ) {
    redirectError(
      "Es gibt noch keine Positionen, für die Kurse geladen werden können."
    );
  }

  const instrumentMap =
    new Map<
      string,
      InstrumentToSync
    >();

  const missingSymbols:
    string[] = [];

  const currencies =
    new Set<string>();

  for (
    const row of rows
  ) {
    const instrument =
      getRelation(
        row.instruments
      );

    if (!instrument) {
      continue;
    }

    const currency =
      (
        instrument.currency ||
        "EUR"
      )
        .trim()
        .toUpperCase();

    if (
      currency !== "EUR"
    ) {
      currencies.add(
        currency
      );
    }

    if (
      !instrument.symbol
    ) {
      missingSymbols.push(
        instrument.name
      );

      continue;
    }

    instrumentMap.set(
      instrument.id,
      {
        id:
          instrument.id,

        name:
          instrument.name,

        symbol:
          instrument.symbol
            .trim()
            .toUpperCase(),

        currency,
      }
    );
  }

  const instruments =
    Array.from(
      instrumentMap.values()
    );

  if (
    instruments.length ===
    0
  ) {
    redirectError(
      "Keine Position besitzt einen verwendbaren Ticker."
    );
  }

  let fxSuccessful = 0;

  let securitySuccessful =
    0;

  let marketMoversSuccessful =
    0;

  let marketMoversSkipped =
    0;

  let skipped =
    0;

  const failed:
    string[] = [];

  /*
   * FX-Paare
   */
  for (
    const currency
    of Array.from(
      currencies
    )
  ) {
    const syncKey =
      `${currency}:EUR`;

    const stateKey =
      `fx:${syncKey}`;

    if (
      syncedToday.has(
        stateKey
      )
    ) {
      skipped += 1;

      continue;
    }

    try {
      await consumeCredit(
        supabase
      );

      const rates =
        await fetchDailyFxRates(
          currency,
          "EUR"
        );

      const snapshots =
        rates.map(
          (item) => ({
            user_id:
              userId,

            from_currency:
              currency,

            to_currency:
              "EUR",

            rate:
              item.rate,

            captured_at:
              `${item.date}T20:00:00.000Z`,

            source:
              ALPHA_VANTAGE_PROVIDER,
          })
        );

      const {
        error:
          fxError,
      } = await supabase
        .from(
          "fx_snapshots"
        )
        .upsert(
          snapshots,
          {
            onConflict:
              "user_id,from_currency,to_currency,captured_at,source",

            ignoreDuplicates:
              false,
          }
        );

      if (fxError) {
        throw new Error(
          fxError.message
        );
      }

      await markSuccessfulSync(
        supabase,
        userId,
        "fx",
        syncKey,
        today
      );

      syncedToday.add(
        stateKey
      );

      fxSuccessful += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler";

      console.error(
        `FX sync failed for ${currency}/EUR:`,
        error
      );

      failed.push(
        `${currency}/EUR: ${message}`
      );

      if (
        isLimitError(
          message
        )
      ) {
        break;
      }
    }
  }

  let limitAlreadyReached =
    failed.some(
      (message) =>
        isLimitError(
          message
        )
    );

  /*
   * Wertpapierkurse
   */
  if (
    !limitAlreadyReached
  ) {
    for (
      const instrument
      of instruments
    ) {
      const syncKey =
        instrument.id;

      const stateKey =
        `instrument:${syncKey}`;

      if (
        syncedToday.has(
          stateKey
        )
      ) {
        skipped += 1;

        continue;
      }

      try {
        await consumeCredit(
          supabase
        );

        const prices =
          await fetchDailyPrices(
            instrument.symbol
          );

        const snapshots =
          prices.map(
            (price) => ({
              instrument_id:
                instrument.id,

              price:
                price.price,

              currency:
                instrument.currency,

              captured_at:
                `${price.date}T20:00:00.000Z`,

              source:
                ALPHA_VANTAGE_PROVIDER,
            })
          );

        const {
          error:
            snapshotError,
        } = await supabase
          .from(
            "price_snapshots"
          )
          .upsert(
            snapshots,
            {
              onConflict:
                "instrument_id,captured_at,source",

              ignoreDuplicates:
                false,
            }
          );

        if (
          snapshotError
        ) {
          throw new Error(
            snapshotError.message
          );
        }

        await markSuccessfulSync(
          supabase,
          userId,
          "instrument",
          syncKey,
          today
        );

        syncedToday.add(
          stateKey
        );

        securitySuccessful +=
          1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler";

        console.error(
          `Market sync failed for ${instrument.symbol}:`,
          error
        );

        failed.push(
          `${instrument.name} (${instrument.symbol}): ${message}`
        );

        if (
          isLimitError(
            message
          )
        ) {
          break;
        }
      }
    }
  }

  limitAlreadyReached =
    failed.some(
      (message) =>
        isLimitError(
          message
        )
    );

  /*
   * Top Gewinner / Top Verlierer
   *
   * Die market_movers-Tabelle ist gleichzeitig
   * unser Tages-Cache. Existiert bereits mindestens
   * ein Datensatz für heute, wird kein neuer
   * Alpha-Vantage-Request ausgelöst.
   */
  if (
    !limitAlreadyReached
  ) {
    const {
      data:
        existingMarketMovers,
      error:
        marketMoversCacheError,
    } = await supabase
      .from(
        "market_movers"
      )
      .select(
        "id"
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "market_date",
        today
      )
      .eq(
        "source",
        ALPHA_VANTAGE_PROVIDER
      )
      .limit(1);

    if (
      marketMoversCacheError
    ) {
      console.error(
        "Market Movers cache check failed:",
        marketMoversCacheError
      );

      failed.push(
        `Market Movers Cache: ${marketMoversCacheError.message}`
      );
    } else if (
      existingMarketMovers &&
      existingMarketMovers.length >
        0
    ) {
      marketMoversSkipped =
        1;
    } else {
      try {
        await consumeCredit(
          supabase
        );

        const marketMovers =
          await fetchTopGainersLosers();

        const rowsToUpsert = [
          ...marketMovers.topGainers.map(
            (
              mover,
              index
            ) => ({
              user_id:
                userId,

              market_date:
                today,

              category:
                "gainer",

              rank:
                index + 1,

              ticker:
                mover.ticker,

              price:
                mover.price,

              change_amount:
                mover.changeAmount,

              change_percentage:
                mover.changePercentage,

              volume:
                mover.volume,

              source:
                ALPHA_VANTAGE_PROVIDER,

              updated_at:
                new Date()
                  .toISOString(),
            })
          ),

          ...marketMovers.topLosers.map(
            (
              mover,
              index
            ) => ({
              user_id:
                userId,

              market_date:
                today,

              category:
                "loser",

              rank:
                index + 1,

              ticker:
                mover.ticker,

              price:
                mover.price,

              change_amount:
                mover.changeAmount,

              change_percentage:
                mover.changePercentage,

              volume:
                mover.volume,

              source:
                ALPHA_VANTAGE_PROVIDER,

              updated_at:
                new Date()
                  .toISOString(),
            })
          ),
        ];

        if (
          rowsToUpsert.length ===
          0
        ) {
          throw new Error(
            "Alpha Vantage hat keine Market-Mover-Daten geliefert."
          );
        }

        const {
          error:
            marketMoversError,
        } = await supabase
          .from(
            "market_movers"
          )
          .upsert(
            rowsToUpsert,
            {
              onConflict:
                "user_id,market_date,category,rank,source",

              ignoreDuplicates:
                false,
            }
          );

        if (
          marketMoversError
        ) {
          throw new Error(
            marketMoversError.message
          );
        }

        marketMoversSuccessful =
          1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler";

        console.error(
          "Market Movers sync failed:",
          error
        );

        failed.push(
          `Market Movers: ${message}`
        );
      }
    }
  }

  revalidatePath("/");
  revalidatePath(
    "/positions"
  );

  if (
    fxSuccessful === 0 &&
    securitySuccessful === 0 &&
    marketMoversSuccessful ===
      0 &&
    skipped === 0 &&
    marketMoversSkipped ===
      0
  ) {
    redirectError(
      failed[0] ??
        "Es konnten keine Marktdaten synchronisiert werden."
    );
  }

  const parts:
    string[] = [];

  if (
    securitySuccessful > 0
  ) {
    parts.push(
      `${securitySuccessful} Wertpapier${
        securitySuccessful === 1
          ? ""
          : "e"
      } aktualisiert`
    );
  }

  if (
    fxSuccessful > 0
  ) {
    parts.push(
      `${fxSuccessful} FX-Paar${
        fxSuccessful === 1
          ? ""
          : "e"
      } aktualisiert`
    );
  }

  if (
    marketMoversSuccessful >
    0
  ) {
    parts.push(
      "Marktbewegungen aktualisiert"
    );
  }

  if (
    skipped > 0
  ) {
    parts.push(
      `${skipped} bereits heute aktuell`
    );
  }

  if (
    marketMoversSkipped >
    0
  ) {
    parts.push(
      "Marktbewegungen bereits heute aktuell"
    );
  }

  let message =
    parts.join(", ");

  if (!message) {
    message =
      "Keine Aktualisierung erforderlich";
  }

  message += ".";

  if (
    missingSymbols.length >
    0
  ) {
    message +=
      ` Ohne Ticker: ${missingSymbols.join(
        ", "
      )}.`;
  }

  if (
    failed.length > 0
  ) {
    message +=
      ` ${failed.length} Abruf(e) fehlgeschlagen.`;
  }

  redirect(
    `/?marketSuccess=${encodeURIComponent(
      message
    )}`
  );
}