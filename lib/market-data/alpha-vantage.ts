export const
  ALPHA_VANTAGE_DAILY_LIMIT = 25;

export const
  ALPHA_VANTAGE_PROVIDER =
    "alpha_vantage";

export type DailyMarketPrice = {
  date: string;
  price: number;
};

export type DailyFxRate = {
  date: string;
  rate: number;
};

export type MarketMover = {
  ticker: string;
  price: number;
  changeAmount: number;
  changePercentage: number;
  volume: number;
};

export type TopGainersLosers = {
  lastUpdated: string | null;
  topGainers: MarketMover[];
  topLosers: MarketMover[];
};

type AlphaVantageDailySeries = {
  "Meta Data"?: Record<
    string,
    string
  >;

  "Time Series (Daily)"?: Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    }
  >;

  Information?: string;
  Note?: string;

  "Error Message"?: string;
};

type AlphaVantageFxSeries = {
  "Meta Data"?: Record<
    string,
    string
  >;

  "Time Series FX (Daily)"?: Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
    }
  >;

  Information?: string;
  Note?: string;

  "Error Message"?: string;
};

type AlphaVantageMarketMover = {
  ticker?: string;
  price?: string;
  change_amount?: string;
  change_percentage?: string;
  volume?: string;
};

type AlphaVantageTopGainersLosers = {
  metadata?: string;
  last_updated?: string;

  top_gainers?:
    AlphaVantageMarketMover[];

  top_losers?:
    AlphaVantageMarketMover[];

  most_actively_traded?:
    AlphaVantageMarketMover[];

  Information?: string;
  Note?: string;

  "Error Message"?: string;
};

function getApiKey() {
  const apiKey =
    process.env
      .ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ALPHA_VANTAGE_API_KEY fehlt in .env.local."
    );
  }

  return apiKey;
}

function checkCommonErrors(
  data: {
    Information?: string;
    Note?: string;
    "Error Message"?: string;
  },
  description: string
) {
  if (
    data["Error Message"]
  ) {
    throw new Error(
      `${description} wurde von Alpha Vantage nicht gefunden.`
    );
  }

  if (data.Note) {
    throw new Error(
      `Alpha-Vantage-Limit erreicht: ${data.Note}`
    );
  }

  if (
    data.Information
  ) {
    throw new Error(
      data.Information
    );
  }
}

export async function fetchDailyPrices(
  symbol: string
): Promise<
  DailyMarketPrice[]
> {
  const apiKey =
    getApiKey();

  const normalizedSymbol =
    symbol
      .trim()
      .toUpperCase();

  if (
    !normalizedSymbol
  ) {
    throw new Error(
      "Für das Instrument ist kein Börsen-Ticker hinterlegt."
    );
  }

  const url =
    new URL(
      "https://www.alphavantage.co/query"
    );

  url.searchParams.set(
    "function",
    "TIME_SERIES_DAILY"
  );

  url.searchParams.set(
    "symbol",
    normalizedSymbol
  );

  url.searchParams.set(
    "outputsize",
    "compact"
  );

  url.searchParams.set(
    "apikey",
    apiKey
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",

        cache: "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Alpha Vantage antwortete mit HTTP ${response.status}.`
    );
  }

  const data =
    (await response.json()) as
      AlphaVantageDailySeries;

  checkCommonErrors(
    data,
    `Ticker ${normalizedSymbol}`
  );

  const series =
    data[
      "Time Series (Daily)"
    ];

  if (!series) {
    throw new Error(
      `Für ${normalizedSymbol} wurden keine Tageskurse geliefert.`
    );
  }

  const prices =
    Object.entries(
      series
    )
      .map(
        (
          [
            date,
            values,
          ]
        ) => {
          const price =
            Number(
              values[
                "4. close"
              ]
            );

          return {
            date,
            price,
          };
        }
      )
      .filter(
        (
          item
        ): item is DailyMarketPrice =>
          Number.isFinite(
            item.price
          ) &&
          item.price > 0
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(
            b.date
          )
      );

  if (
    prices.length === 0
  ) {
    throw new Error(
      `Für ${normalizedSymbol} konnten keine gültigen Kurse gelesen werden.`
    );
  }

  return prices;
}

export async function fetchDailyFxRates(
  fromCurrency: string,
  toCurrency = "EUR"
): Promise<
  DailyFxRate[]
> {
  const apiKey =
    getApiKey();

  const from =
    fromCurrency
      .trim()
      .toUpperCase();

  const to =
    toCurrency
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      from
    )
  ) {
    throw new Error(
      `Ungültige Ausgangswährung: ${fromCurrency}`
    );
  }

  if (
    !/^[A-Z]{3}$/.test(
      to
    )
  ) {
    throw new Error(
      `Ungültige Zielwährung: ${toCurrency}`
    );
  }

  if (
    from === to
  ) {
    return [];
  }

  const url =
    new URL(
      "https://www.alphavantage.co/query"
    );

  url.searchParams.set(
    "function",
    "FX_DAILY"
  );

  url.searchParams.set(
    "from_symbol",
    from
  );

  url.searchParams.set(
    "to_symbol",
    to
  );

  url.searchParams.set(
    "outputsize",
    "compact"
  );

  url.searchParams.set(
    "apikey",
    apiKey
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",

        cache: "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Alpha Vantage FX antwortete mit HTTP ${response.status}.`
    );
  }

  const data =
    (await response.json()) as
      AlphaVantageFxSeries;

  checkCommonErrors(
    data,
    `${from}/${to}`
  );

  const series =
    data[
      "Time Series FX (Daily)"
    ];

  if (!series) {
    throw new Error(
      `Für ${from}/${to} wurden keine Wechselkurse geliefert.`
    );
  }

  const rates =
    Object.entries(
      series
    )
      .map(
        (
          [
            date,
            values,
          ]
        ) => {
          const rate =
            Number(
              values[
                "4. close"
              ]
            );

          return {
            date,
            rate,
          };
        }
      )
      .filter(
        (
          item
        ): item is DailyFxRate =>
          Number.isFinite(
            item.rate
          ) &&
          item.rate > 0
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(
            b.date
          )
      );

  if (
    rates.length === 0
  ) {
    throw new Error(
      `Für ${from}/${to} konnten keine gültigen Wechselkurse gelesen werden.`
    );
  }

  return rates;
}

export async function fetchTopGainersLosers(): Promise<
  TopGainersLosers
> {
  const apiKey =
    getApiKey();

  const url =
    new URL(
      "https://www.alphavantage.co/query"
    );

  url.searchParams.set(
    "function",
    "TOP_GAINERS_LOSERS"
  );

  url.searchParams.set(
    "apikey",
    apiKey
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",

        cache: "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Alpha Vantage Market Movers antwortete mit HTTP ${response.status}.`
    );
  }

  const data =
    (await response.json()) as
      AlphaVantageTopGainersLosers;

  checkCommonErrors(
    data,
    "Market Movers"
  );

  const topGainers =
    parseMarketMovers(
      data.top_gainers
    );

  const topLosers =
    parseMarketMovers(
      data.top_losers
    );

  if (
    topGainers.length === 0 &&
    topLosers.length === 0
  ) {
    throw new Error(
      "Alpha Vantage hat keine gültigen Gewinner oder Verlierer geliefert."
    );
  }

  return {
    lastUpdated:
      data.last_updated ??
      null,

    topGainers,

    topLosers,
  };
}

function parseMarketMovers(
  items:
    | AlphaVantageMarketMover[]
    | undefined
): MarketMover[] {
  if (!items) {
    return [];
  }

  return items
    .map(
      (
        item
      ): MarketMover | null => {
        const ticker =
          item.ticker
            ?.trim()
            .toUpperCase();

        const price =
          Number(
            item.price
          );

        const changeAmount =
          Number(
            item.change_amount
          );

        const changePercentage =
          parsePercentage(
            item.change_percentage
          );

        const volume =
          Number(
            item.volume
          );

        if (
          !ticker ||
          !Number.isFinite(
            price
          ) ||
          price <= 0 ||
          !Number.isFinite(
            changeAmount
          ) ||
          !Number.isFinite(
            changePercentage
          )
        ) {
          return null;
        }

        return {
          ticker,
          price,
          changeAmount,
          changePercentage,
          volume:
            Number.isFinite(
              volume
            ) &&
            volume >= 0
              ? volume
              : 0,
        };
      }
    )
    .filter(
      (
        item
      ): item is MarketMover =>
        item !== null
    );
}

function parsePercentage(
  value:
    | string
    | undefined
) {
  if (!value) {
    return Number.NaN;
  }

  return Number(
    value
      .trim()
      .replace(
        "%",
        ""
      )
  );
}