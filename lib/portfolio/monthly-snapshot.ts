import {
    createClient,
  } from "@/lib/supabase/server";
  
  type InstrumentRelation = {
    id: string;
  
    name: string;
  
    symbol:
      | string
      | null;
  
    asset_type: string;
  
    currency: string;
  };
  
  type PositionRow = {
    id: string;
  
    instrument_id: string;
  
    quantity:
      | number
      | string;
  
    instruments:
      | InstrumentRelation
      | InstrumentRelation[]
      | null;
  };
  
  type TransactionRow = {
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
      | InstrumentRelation
      | InstrumentRelation[]
      | null;
  };
  
  type PriceSnapshotRow = {
    instrument_id: string;
  
    price:
      | number
      | string;
  
    currency: string;
  
    captured_at: string;
  };
  
  type FxSnapshotRow = {
    from_currency: string;
  
    to_currency: string;
  
    rate:
      | number
      | string;
  
    captured_at: string;
  };
  
  export type MonthlySnapshotPosition = {
    instrumentId: string;
  
    name: string;
  
    symbol:
      | string
      | null;
  
    assetType: string;
  
    marketCurrency: string;
  
    quantity: number;
  
    startQuantity: number;
  
    startPrice:
      | number
      | null;
  
    endPrice:
      | number
      | null;
  
    startFx:
      | number
      | null;
  
    endFx:
      | number
      | null;
  
    marketValueEur:
      | number
      | null;
  
    startMarketValueEur:
      | number
      | null;
  
    monthlyPerformancePercent:
      | number
      | null;
  
    weightPercent: number;
  };
  
  export type MonthlyPortfolioSnapshot = {
    reportMonth: string;
  
    monthLabel: string;
  
    periodLabel: string;
  
    periodStart: string;
  
    periodEnd: string;
  
    startValuationDate: string;
  
    generatedAt: string;
  
    portfolioName: string;
  
    portfolioValueEur: number;
  
    startPortfolioValueEur: number;
  
    monthlyChangeEur: number;
  
    monthlyReturnPercent: number;
  
    positionCount: number;
  
    returnMethod:
      "modified-dietz-approximation";
  
    positions:
      MonthlySnapshotPosition[];
  };
  
  type CashFlow = {
    date: string;
  
    amountEur: number;
  };
  
  export async function createLastCompletedMonthlySnapshot(
    userId: string
  ): Promise<MonthlyPortfolioSnapshot> {
    const supabase =
      await createClient();
  
    const range =
      getLastCompletedMonthRange();
  
    const {
      data: portfolioData,
    } = await supabase
      .from("portfolios")
      .select(`
        id,
        name
      `)
      .eq(
        "user_id",
        userId
      );
  
    const portfolioName =
      portfolioData?.length ===
      1
        ? portfolioData[0]
            ?.name ??
          "Mein Portfolio"
        : "Gesamtportfolio";
  
    const {
      data: positionData,
      error: positionError,
    } = await supabase
      .from("positions")
      .select(`
        id,
        instrument_id,
        quantity,
        instruments (
          id,
          name,
          symbol,
          asset_type,
          currency
        )
      `);
  
    if (positionError) {
      throw new Error(
        `Positionen konnten nicht geladen werden: ${positionError.message}`
      );
    }
  
    const currentPositions =
      (positionData as
        | PositionRow[]
        | null) ?? [];
  
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
  
    if (transactionError) {
      throw new Error(
        `Transaktionen konnten nicht geladen werden: ${transactionError.message}`
      );
    }
  
    const transactions =
      (transactionData as
        | TransactionRow[]
        | null) ?? [];
  
    /*
     * Instrument-Metadaten sowohl aus aktuellen Positionen
     * als auch aus historischen Transaktionen aufbauen.
     */
    const instrumentMap =
      new Map<
        string,
        InstrumentRelation
      >();
  
    for (
      const position
      of currentPositions
    ) {
      const instrument =
        getRelation(
          position.instruments
        );
  
      if (
        instrument
      ) {
        instrumentMap.set(
          position.instrument_id,
          instrument
        );
      }
    }
  
    for (
      const transaction
      of transactions
    ) {
      const instrumentId =
        transaction.instrument_id;
  
      const instrument =
        getRelation(
          transaction.instruments
        );
  
      if (
        instrumentId &&
        instrument
      ) {
        instrumentMap.set(
          instrumentId,
          instrument
        );
      }
    }
  
    const instrumentIds =
      Array.from(
        instrumentMap.keys()
      );
  
    if (
      instrumentIds.length ===
      0
    ) {
      throw new Error(
        "Für den Monatsreport wurden keine Instrumente gefunden."
      );
    }
  
    /*
     * Historische Preise.
     */
    const {
      data: priceData,
      error: priceError,
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
      .lte(
        "captured_at",
        `${range.periodEnd}T23:59:59.999Z`
      )
      .order(
        "captured_at",
        {
          ascending: false,
        }
      );
  
    if (priceError) {
      throw new Error(
        `Historische Kursdaten konnten nicht geladen werden: ${priceError.message}`
      );
    }
  
    const priceSnapshots =
      (priceData as
        | PriceSnapshotRow[]
        | null) ?? [];
  
    const snapshotsByInstrument =
      new Map<
        string,
        PriceSnapshotRow[]
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
     * Benötigte Währungen sammeln.
     */
    const currencies =
      new Set<string>();
  
    for (
      const instrument
      of instrumentMap.values()
    ) {
      const currency =
        normalizeCurrency(
          instrument.currency
        );
  
      if (
        currency !==
        "EUR"
      ) {
        currencies.add(
          currency
        );
      }
    }
  
    for (
      const transaction
      of transactions
    ) {
      const currency =
        normalizeCurrency(
          transaction.currency
        );
  
      if (
        currency !==
        "EUR"
      ) {
        currencies.add(
          currency
        );
      }
    }
  
    let fxSnapshots:
      FxSnapshotRow[] = [];
  
    if (
      currencies.size >
      0
    ) {
      const {
        data: fxData,
        error: fxError,
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
          Array.from(
            currencies
          )
        )
        .lte(
          "captured_at",
          `${range.periodEnd}T23:59:59.999Z`
        )
        .order(
          "captured_at",
          {
            ascending: false,
          }
        );
  
      if (fxError) {
        throw new Error(
          `Historische FX-Daten konnten nicht geladen werden: ${fxError.message}`
        );
      }
  
      fxSnapshots =
        (fxData as
          | FxSnapshotRow[]
          | null) ?? [];
    }
  
    const fxByCurrency =
      new Map<
        string,
        FxSnapshotRow[]
      >();
  
    for (
      const snapshot
      of fxSnapshots
    ) {
      const currency =
        normalizeCurrency(
          snapshot.from_currency
        );
  
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
     * Aktuelle Mengen als Ausgangspunkt.
     *
     * Von dort rechnen wir Transaktionen rückwärts,
     * um den Bestand am Monatsende und Monatsanfang
     * zu rekonstruieren.
     */
    const currentQuantityByInstrument =
      new Map<
        string,
        number
      >();
  
    for (
      const position
      of currentPositions
    ) {
      currentQuantityByInstrument.set(
        position.instrument_id,
        numeric(
          position.quantity
        )
      );
    }
  
    const quantityAtEnd =
      reconstructQuantitiesAtDate(
        currentQuantityByInstrument,
        transactions,
        range.periodEnd
      );
  
    const quantityAtStart =
      reconstructQuantitiesAtDate(
        currentQuantityByInstrument,
        transactions,
        range.startValuationDate
      );
  
    const relevantInstrumentIds =
      Array.from(
        new Set([
          ...quantityAtEnd.keys(),
          ...quantityAtStart.keys(),
        ])
      );
  
    const snapshotPositions:
      MonthlySnapshotPosition[] =
      [];
  
    for (
      const instrumentId
      of relevantInstrumentIds
    ) {
      const instrument =
        instrumentMap.get(
          instrumentId
        );
  
      if (!instrument) {
        continue;
      }
  
      const endQuantity =
        quantityAtEnd.get(
          instrumentId
        ) ?? 0;
  
      const startQuantity =
        quantityAtStart.get(
          instrumentId
        ) ?? 0;
  
      /*
       * Für den eigentlichen Report interessieren
       * uns die Positionen am Monatsende.
       */
      if (
        endQuantity <=
        0.0000000001
      ) {
        continue;
      }
  
      const snapshots =
        snapshotsByInstrument.get(
          instrumentId
        ) ?? [];
  
      const startPriceSnapshot =
        findSnapshotOnOrBefore(
          snapshots,
          range.startValuationDate
        );
  
      const endPriceSnapshot =
        findSnapshotOnOrBefore(
          snapshots,
          range.periodEnd
        );
  
      const marketCurrency =
        normalizeCurrency(
          instrument.currency
        );
  
      const startPrice =
        startPriceSnapshot
          ? numeric(
              startPriceSnapshot.price
            )
          : null;
  
      const endPrice =
        endPriceSnapshot
          ? numeric(
              endPriceSnapshot.price
            )
          : null;
  
      const startFx =
        getFxRateOnOrBefore(
          marketCurrency,
          range.startValuationDate,
          fxByCurrency
        );
  
      const endFx =
        getFxRateOnOrBefore(
          marketCurrency,
          range.periodEnd,
          fxByCurrency
        );
  
      const startUnitValueEur =
        startPrice !==
          null &&
        startFx !==
          null
          ? startPrice *
            startFx
          : null;
  
      const endUnitValueEur =
        endPrice !==
          null &&
        endFx !==
          null
          ? endPrice *
            endFx
          : null;
  
      const marketValueEur =
        endUnitValueEur !==
        null
          ? endQuantity *
            endUnitValueEur
          : null;
  
      const startMarketValueEur =
        startUnitValueEur !==
        null
          ? startQuantity *
            startUnitValueEur
          : null;
  
      const monthlyPerformancePercent =
        startUnitValueEur !==
          null &&
        endUnitValueEur !==
          null &&
        startUnitValueEur >
          0
          ? (
              (
                endUnitValueEur -
                startUnitValueEur
              ) /
              startUnitValueEur
            ) *
            100
          : null;
  
      snapshotPositions.push({
        instrumentId,
  
        name:
          instrument.name,
  
        symbol:
          instrument.symbol,
  
        assetType:
          instrument.asset_type,
  
        marketCurrency,
  
        quantity:
          round8(
            endQuantity
          ),
  
        startQuantity:
          round8(
            startQuantity
          ),
  
        startPrice:
          nullableRound2(
            startPrice
          ),
  
        endPrice:
          nullableRound2(
            endPrice
          ),
  
        startFx:
          nullableRound6(
            startFx
          ),
  
        endFx:
          nullableRound6(
            endFx
          ),
  
        marketValueEur:
          nullableRound2(
            marketValueEur
          ),
  
        startMarketValueEur:
          nullableRound2(
            startMarketValueEur
          ),
  
        monthlyPerformancePercent:
          nullableRound2(
            monthlyPerformancePercent
          ),
  
        weightPercent:
          0,
      });
    }
  
    const portfolioValueEur =
      snapshotPositions.reduce(
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
  
    /*
     * Startwert für die Modified-Dietz-Näherung:
     * ALLE gehaltenen Wertpapierpositionen zum
     * Bewertungszeitpunkt vor Monatsbeginn.
     */
    let startPortfolioValueEur =
      0;
  
    for (
      const [
        instrumentId,
        quantity,
      ]
      of quantityAtStart.entries()
    ) {
      if (
        quantity <=
        0.0000000001
      ) {
        continue;
      }
  
      const instrument =
        instrumentMap.get(
          instrumentId
        );
  
      if (!instrument) {
        continue;
      }
  
      const snapshots =
        snapshotsByInstrument.get(
          instrumentId
        ) ?? [];
  
      const priceSnapshot =
        findSnapshotOnOrBefore(
          snapshots,
          range.startValuationDate
        );
  
      if (!priceSnapshot) {
        continue;
      }
  
      const price =
        numeric(
          priceSnapshot.price
        );
  
      const fx =
        getFxRateOnOrBefore(
          normalizeCurrency(
            instrument.currency
          ),
          range.startValuationDate,
          fxByCurrency
        );
  
      if (
        fx ===
        null
      ) {
        continue;
      }
  
      startPortfolioValueEur +=
        quantity *
        price *
        fx;
    }
  
    /*
     * Käufe/Verkäufe innerhalb des Monats werden
     * für eine Modified-Dietz-Näherung als
     * Wertpapier-Cashflows berücksichtigt.
     *
     * Da dein Dashboard Cash derzeit nicht als
     * vollständiges separates Konto modelliert,
     * bleibt dies bewusst eine Näherung.
     */
    const monthlyCashFlows:
      CashFlow[] =
      [];
  
    for (
      const transaction
      of transactions
    ) {
      if (
        transaction.trade_date <
          range.periodStart ||
        transaction.trade_date >
          range.periodEnd
      ) {
        continue;
      }
  
      const instrumentId =
        transaction.instrument_id;
  
      if (!instrumentId) {
        continue;
      }
  
      const quantity =
        numeric(
          transaction.quantity
        );
  
      const price =
        numeric(
          transaction.price_per_unit
        );
  
      if (
        quantity <=
          0 ||
        price <=
          0
      ) {
        continue;
      }
  
      const currency =
        normalizeCurrency(
          transaction.currency
        );
  
      const fx =
        getFxRateOnOrBefore(
          currency,
          transaction.trade_date,
          fxByCurrency
        );
  
      if (
        fx ===
        null
      ) {
        continue;
      }
  
      const valueEur =
        quantity *
        price *
        fx;
  
      const type =
        transaction.transaction_type
          .trim()
          .toLowerCase();
  
      monthlyCashFlows.push({
        date:
          transaction.trade_date,
  
        /*
         * Kauf = Kapital fließt in das betrachtete
         * Wertpapierportfolio.
         *
         * Verkauf = Kapital verlässt das betrachtete
         * Wertpapierportfolio.
         */
        amountEur:
          type ===
          "sell"
            ? -valueEur
            : valueEur,
      });
    }
  
    const performance =
      calculateModifiedDietz({
        startValue:
          startPortfolioValueEur,
  
        endValue:
          portfolioValueEur,
  
        periodStart:
          range.periodStart,
  
        periodEnd:
          range.periodEnd,
  
        cashFlows:
          monthlyCashFlows,
      });
  
    for (
      const position
      of snapshotPositions
    ) {
      position.weightPercent =
        portfolioValueEur >
          0 &&
        position.marketValueEur !==
          null
          ? round2(
              (
                position.marketValueEur /
                portfolioValueEur
              ) *
                100
            )
          : 0;
    }
  
    snapshotPositions.sort(
      (
        a,
        b
      ) =>
        (
          b.marketValueEur ??
          0
        ) -
        (
          a.marketValueEur ??
          0
        )
    );
  
    return {
      reportMonth:
        range.reportMonth,
  
      monthLabel:
        range.monthLabel,
  
      periodLabel:
        range.periodLabel,
  
      periodStart:
        range.periodStart,
  
      periodEnd:
        range.periodEnd,
  
      startValuationDate:
        range.startValuationDate,
  
      generatedAt:
        new Date()
          .toISOString(),
  
      portfolioName,
  
      portfolioValueEur:
        round2(
          portfolioValueEur
        ),
  
      startPortfolioValueEur:
        round2(
          startPortfolioValueEur
        ),
  
      monthlyChangeEur:
        round2(
          performance.changeEur
        ),
  
      monthlyReturnPercent:
        round2(
          performance.returnPercent
        ),
  
      positionCount:
        snapshotPositions.length,
  
      returnMethod:
        "modified-dietz-approximation",
  
      positions:
        snapshotPositions,
    };
  }
  
  function reconstructQuantitiesAtDate(
    currentQuantities: Map<
      string,
      number
    >,
    transactions:
      TransactionRow[],
    targetDate: string
  ) {
    const result =
      new Map(
        currentQuantities
      );
  
    /*
     * Ausgangspunkt = heutiger Bestand.
     *
     * Alle Transaktionen NACH dem Zieltag
     * werden rückgängig gemacht.
     */
    const afterTarget =
      transactions
        .filter(
          (transaction) =>
            Boolean(
              transaction.instrument_id
            ) &&
            transaction.trade_date >
              targetDate
        )
        .sort(
          (
            a,
            b
          ) =>
            b.trade_date.localeCompare(
              a.trade_date
            )
        );
  
    for (
      const transaction
      of afterTarget
    ) {
      const instrumentId =
        transaction.instrument_id;
  
      if (!instrumentId) {
        continue;
      }
  
      const quantity =
        numeric(
          transaction.quantity
        );
  
      const current =
        result.get(
          instrumentId
        ) ?? 0;
  
      const type =
        transaction.transaction_type
          .trim()
          .toLowerCase();
  
      if (
        type ===
        "buy"
      ) {
        result.set(
          instrumentId,
          Math.max(
            0,
            current -
              quantity
          )
        );
      }
  
      if (
        type ===
        "sell"
      ) {
        result.set(
          instrumentId,
          current +
            quantity
        );
      }
    }
  
    return result;
  }
  
  function calculateModifiedDietz({
    startValue,
    endValue,
    periodStart,
    periodEnd,
    cashFlows,
  }: {
    startValue: number;
  
    endValue: number;
  
    periodStart: string;
  
    periodEnd: string;
  
    cashFlows:
      CashFlow[];
  }) {
    const start =
      dateOnlyToUtcMs(
        periodStart
      );
  
    const end =
      dateOnlyToUtcMs(
        periodEnd
      );
  
    const totalDuration =
      Math.max(
        1,
        end -
          start
      );
  
    let netCashFlows =
      0;
  
    let weightedCashFlows =
      0;
  
    for (
      const cashFlow
      of cashFlows
    ) {
      netCashFlows +=
        cashFlow.amountEur;
  
      const flowTime =
        dateOnlyToUtcMs(
          cashFlow.date
        );
  
      const remaining =
        Math.max(
          0,
          end -
            flowTime
        );
  
      const weight =
        Math.min(
          1,
          Math.max(
            0,
            remaining /
              totalDuration
          )
        );
  
      weightedCashFlows +=
        cashFlow.amountEur *
        weight;
    }
  
    const changeEur =
      endValue -
      startValue -
      netCashFlows;
  
    const denominator =
      startValue +
      weightedCashFlows;
  
    const returnPercent =
      denominator >
      0
        ? (
            changeEur /
            denominator
          ) *
          100
        : 0;
  
    return {
      changeEur,
      returnPercent,
    };
  }
  
  function getLastCompletedMonthRange() {
    const berlinParts =
      new Intl.DateTimeFormat(
        "en-CA",
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
  
    const currentYear =
      Number(
        berlinParts.find(
          (part) =>
            part.type ===
            "year"
        )?.value
      );
  
    const currentMonth =
      Number(
        berlinParts.find(
          (part) =>
            part.type ===
            "month"
        )?.value
      );
  
    const currentMonthStart =
      new Date(
        Date.UTC(
          currentYear,
          currentMonth -
            1,
          1
        )
      );
  
    const reportMonthDate =
      new Date(
        Date.UTC(
          currentMonthStart.getUTCFullYear(),
          currentMonthStart.getUTCMonth() -
            1,
          1
        )
      );
  
    const year =
      reportMonthDate.getUTCFullYear();
  
    const month =
      reportMonthDate.getUTCMonth();
  
    const periodStartDate =
      new Date(
        Date.UTC(
          year,
          month,
          1
        )
      );
  
    const periodEndDate =
      new Date(
        Date.UTC(
          year,
          month +
            1,
          0
        )
      );
  
    const startValuationDate =
      new Date(
        Date.UTC(
          year,
          month,
          0
        )
      );
  
    const periodStart =
      formatDateOnly(
        periodStartDate
      );
  
    const periodEnd =
      formatDateOnly(
        periodEndDate
      );
  
    const reportMonth =
      `${year}-${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}`;
  
    const monthLabel =
      new Intl.DateTimeFormat(
        "de-DE",
        {
          month:
            "long",
  
          year:
            "numeric",
  
          timeZone:
            "UTC",
        }
      ).format(
        periodStartDate
      );
  
    return {
      reportMonth,
  
      monthLabel:
        capitalizeFirst(
          monthLabel
        ),
  
      periodStart,
  
      periodEnd,
  
      startValuationDate:
        formatDateOnly(
          startValuationDate
        ),
  
      periodLabel:
        `${formatGermanDate(
          periodStart
        )} – ${formatGermanDate(
          periodEnd
        )}`,
    };
  }
  
  function findSnapshotOnOrBefore(
    snapshots:
      PriceSnapshotRow[],
    date: string
  ): PriceSnapshotRow | null {
    const target =
      endOfUtcDay(
        date
      );
  
    let best:
      PriceSnapshotRow | null =
      null;
  
    let bestTime =
      Number.NEGATIVE_INFINITY;
  
    for (
      const snapshot
      of snapshots
    ) {
      const timestamp =
        new Date(
          snapshot.captured_at
        ).getTime();
  
      if (
        timestamp <=
          target &&
        timestamp >
          bestTime
      ) {
        best =
          snapshot;
  
        bestTime =
          timestamp;
      }
    }
  
    return best;
  }
  
  function getFxRateOnOrBefore(
    currency: string,
    date: string,
    fxByCurrency: Map<
      string,
      FxSnapshotRow[]
    >
  ): number | null {
    if (
      currency ===
      "EUR"
    ) {
      return 1;
    }
  
    const snapshots =
      fxByCurrency.get(
        currency
      ) ?? [];
  
    const target =
      endOfUtcDay(
        date
      );
  
    let best:
      FxSnapshotRow | null =
      null;
  
    let bestTime =
      Number.NEGATIVE_INFINITY;
  
    for (
      const snapshot
      of snapshots
    ) {
      const timestamp =
        new Date(
          snapshot.captured_at
        ).getTime();
  
      if (
        timestamp <=
          target &&
        timestamp >
          bestTime
      ) {
        best =
          snapshot;
  
        bestTime =
          timestamp;
      }
    }
  
    return best
      ? numeric(
          best.rate
        )
      : null;
  }
  
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
  
  function normalizeCurrency(
    value:
      | string
      | null
      | undefined
  ) {
    return (
      value ??
      "EUR"
    )
      .trim()
      .toUpperCase();
  }
  
  function formatDateOnly(
    date: Date
  ) {
    return [
      date.getUTCFullYear(),
  
      String(
        date.getUTCMonth() +
          1
      ).padStart(
        2,
        "0"
      ),
  
      String(
        date.getUTCDate()
      ).padStart(
        2,
        "0"
      ),
    ].join("-");
  }
  
  function formatGermanDate(
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
  
    return `${String(
      day
    ).padStart(
      2,
      "0"
    )}.${String(
      month
    ).padStart(
      2,
      "0"
    )}.${year}`;
  }
  
  function dateOnlyToUtcMs(
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
  
    return Date.UTC(
      year,
      month -
        1,
      day
    );
  }
  
  function endOfUtcDay(
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
  
    return Date.UTC(
      year,
      month -
        1,
      day,
      23,
      59,
      59,
      999
    );
  }
  
  function capitalizeFirst(
    value: string
  ) {
    if (!value) {
      return value;
    }
  
    return (
      value.charAt(
        0
      ).toUpperCase() +
      value.slice(
        1
      )
    );
  }
  
  function round2(
    value: number
  ) {
    return (
      Math.round(
        value *
          100
      ) /
      100
    );
  }
  
  function round6(
    value: number
  ) {
    return (
      Math.round(
        value *
          1_000_000
      ) /
      1_000_000
    );
  }
  
  function round8(
    value: number
  ) {
    return (
      Math.round(
        value *
          100_000_000
      ) /
      100_000_000
    );
  }
  
  function nullableRound2(
    value:
      | number
      | null
  ) {
    return value ===
      null
      ? null
      : round2(
          value
        );
  }
  
  function nullableRound6(
    value:
      | number
      | null
  ) {
    return value ===
      null
      ? null
      : round6(
          value
        );
  }