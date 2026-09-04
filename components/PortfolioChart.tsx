"use client";

import {
  useMemo,
  useState,
} from "react";

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

  rawDate?: string;

  value: number;

  transactions?:
    PortfolioChartTransaction[];
};

type PortfolioChartProps = {
  data?: PortfolioChartPoint[];
};

type ChartRange =
  | "1M"
  | "3M"
  | "MAX";

const demoData: PortfolioChartPoint[] = [
  {
    date: "Apr",
    rawDate: "2026-04-01",
    value: 182400,
    transactions: [],
  },
  {
    date: "Mai",
    rawDate: "2026-05-01",
    value: 185900,
    transactions: [],
  },
  {
    date: "Jun",
    rawDate: "2026-06-01",
    value: 181200,
    transactions: [],
  },
  {
    date: "Jul",
    rawDate: "2026-07-01",
    value: 191800,
    transactions: [],
  },
  {
    date: "Aug",
    rawDate: "2026-08-01",
    value: 196300,
    transactions: [],
  },
  {
    date: "Sep",
    rawDate: "2026-09-01",
    value: 201480,
    transactions: [],
  },
];

export function PortfolioChart({
  data,
}: PortfolioChartProps) {
  const [
    hoveredIndex,
    setHoveredIndex,
  ] =
    useState<
      number | null
    >(null);

  const [
    selectedRange,
    setSelectedRange,
  ] =
    useState<ChartRange>(
      "MAX"
    );

  const sourceData =
    useMemo(
      () => {
        const baseData =
          data &&
          data.length > 1
            ? data
            : demoData;

        return baseData.filter(
          (point) =>
            Number.isFinite(
              point.value
            ) &&
            point.value > 0
        );
      },
      [data]
    );

  const chartData =
    useMemo(
      () =>
        filterChartData(
          sourceData,
          selectedRange
        ),
      [
        sourceData,
        selectedRange,
      ]
    );

  if (
    chartData.length < 2
  ) {
    return (
      <div
        style={{
          padding:
            "28px 4px",
          color:
            "#697386",
          fontSize: 13,
        }}
      >
        Keine gültigen Chart-Daten
        vorhanden.
      </div>
    );
  }

  const width = 900;
  const height = 300;

  const paddingLeft = 64;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 42;

  const chartWidth =
    width -
    paddingLeft -
    paddingRight;

  const chartHeight =
    height -
    paddingTop -
    paddingBottom;

  const values =
    chartData.map(
      (point) =>
        point.value
    );

  const rawMin =
    Math.min(
      ...values
    );

  const rawMax =
    Math.max(
      ...values
    );

  const valueDifference =
    rawMax -
    rawMin;

  const chartPadding =
    valueDifference > 0
      ? valueDifference *
        0.12
      : rawMax *
        0.05;

  const minValue =
    Math.max(
      0,
      rawMin -
        chartPadding
    );

  const maxValue =
    rawMax +
    chartPadding;

  const valueRange =
    maxValue -
      minValue ||
    1;

  const points =
    chartData.map(
      (
        point,
        index
      ) => {
        const x =
          paddingLeft +
          (
            index /
            (
              chartData.length -
              1
            )
          ) *
            chartWidth;

        const normalized =
          (
            point.value -
            minValue
          ) /
          valueRange;

        const y =
          paddingTop +
          chartHeight -
          normalized *
            chartHeight;

        return {
          ...point,
          x,
          y,
        };
      }
    );

  const linePath =
    points
      .map(
        (
          point,
          index
        ) =>
          `${
            index === 0
              ? "M"
              : "L"
          } ${point.x.toFixed(
            2
          )} ${point.y.toFixed(
            2
          )}`
      )
      .join(" ");

  const firstPoint =
    points[0];

  const lastPoint =
    points[
      points.length - 1
    ];

  const areaPath =
    `${linePath} ` +
    `L ${lastPoint.x.toFixed(
      2
    )} ${(paddingTop + chartHeight).toFixed(
      2
    )} ` +
    `L ${firstPoint.x.toFixed(
      2
    )} ${(paddingTop + chartHeight).toFixed(
      2
    )} Z`;

  const yTicks =
    Array.from(
      {
        length: 5,
      },
      (
        _,
        index
      ) => {
        const ratio =
          index / 4;

        const value =
          maxValue -
          ratio *
            valueRange;

        const y =
          paddingTop +
          ratio *
            chartHeight;

        return {
          value,
          y,
        };
      }
    );

  const desiredXTicks =
    6;

  const actualXTicks =
    Math.min(
      desiredXTicks,
      chartData.length
    );

  const xTickIndexes =
    Array.from(
      new Set(
        Array.from(
          {
            length:
              actualXTicks,
          },
          (
            _,
            index
          ) => {
            if (
              actualXTicks ===
              1
            ) {
              return 0;
            }

            return Math.round(
              (
                index /
                (
                  actualXTicks -
                  1
                )
              ) *
                (
                  chartData.length -
                  1
                )
            );
          }
        )
      )
    );

  const hoveredPoint =
    hoveredIndex !== null
      ? points[
          hoveredIndex
        ]
      : null;

  const tooltipLeft =
    hoveredPoint
      ? (
          hoveredPoint.x /
          width
        ) *
        100
      : 0;

  const firstVisible =
    chartData[0];

  const lastVisible =
    chartData[
      chartData.length - 1
    ];

  const absoluteChange =
    lastVisible.value -
    firstVisible.value;

  const percentChange =
    firstVisible.value > 0
      ? (
          absoluteChange /
          firstVisible.value
        ) *
        100
      : 0;

  function handleMouseMove(
    event:
      React.MouseEvent<
        SVGSVGElement
      >
  ) {
    const rect =
      event.currentTarget
        .getBoundingClientRect();

    const mouseX =
      (
        (
          event.clientX -
          rect.left
        ) /
        rect.width
      ) *
      width;

    const relativeX =
      mouseX -
      paddingLeft;

    const normalized =
      Math.max(
        0,
        Math.min(
          1,
          relativeX /
            chartWidth
        )
      );

    const index =
      Math.round(
        normalized *
          (
            chartData.length -
            1
          )
      );

    setHoveredIndex(
      index
    );
  }

  function changeRange(
    newRange:
      ChartRange
  ) {
    setHoveredIndex(
      null
    );

    setSelectedRange(
      newRange
    );
  }

  return (
    <div
      style={{
        width:
          "100%",
        marginTop:
          14,
        position:
          "relative",
      }}
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

          marginBottom:
            6,

          position:
            "relative",

          zIndex:
            20,

          pointerEvents:
            "auto",
        }}
      >
        <div
          style={{
            display:
              "flex",

            alignItems:
              "baseline",

            gap:
              8,

            minHeight:
              24,
          }}
        >
          <strong
            style={{
              color:
                "#26344f",

              fontSize:
                14,
            }}
          >
            {formatMoney(
              lastVisible.value
            )}
          </strong>

          <span
            style={{
              fontSize:
                11,

              fontWeight:
                600,

              color:
                absoluteChange >=
                0
                  ? "#0b8f55"
                  : "#c74646",
            }}
          >
            {absoluteChange >=
            0
              ? "+"
              : ""}

            {formatMoney(
              absoluteChange
            )}

            {" · "}

            {percentChange >=
            0
              ? "+"
              : ""}

            {percentChange.toLocaleString(
              "de-DE",
              {
                minimumFractionDigits:
                  2,

                maximumFractionDigits:
                  2,
              }
            )}
            %
          </span>
        </div>

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              4,

            padding:
              3,

            border:
              "1px solid #e5e8ed",

            borderRadius:
              9,

            background:
              "#f7f8fa",

            position:
              "relative",

            zIndex:
              30,

            pointerEvents:
              "auto",
          }}
        >
          {(
            [
              "1M",
              "3M",
              "MAX",
            ] as ChartRange[]
          ).map(
            (
              rangeOption
            ) => {
              const active =
                selectedRange ===
                rangeOption;

              return (
                <button
                  key={
                    rangeOption
                  }
                  type="button"
                  onClick={() =>
                    changeRange(
                      rangeOption
                    )
                  }
                  aria-pressed={
                    active
                  }
                  style={{
                    position:
                      "relative",

                    zIndex:
                      40,

                    pointerEvents:
                      "auto",

                    padding:
                      "5px 9px",

                    border:
                      "none",

                    borderRadius:
                      7,

                    background:
                      active
                        ? "#ffffff"
                        : "transparent",

                    boxShadow:
                      active
                        ? "0 1px 3px rgba(38,52,79,0.12)"
                        : "none",

                    color:
                      active
                        ? "#26344f"
                        : "#7c879b",

                    fontSize:
                      10,

                    fontWeight:
                      700,

                    cursor:
                      "pointer",
                  }}
                >
                  {
                    rangeOption
                  }
                </button>
              );
            }
          )}
        </div>
      </div>

      <div
        style={{
          position:
            "relative",

          zIndex:
            1,
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Historische Wertentwicklung des Portfolios"
          onMouseMove={
            handleMouseMove
          }
          onMouseLeave={() =>
            setHoveredIndex(
              null
            )
          }
          style={{
            display:
              "block",

            width:
              "100%",

            height:
              "310px",

            overflow:
              "visible",

            cursor:
              "crosshair",
          }}
        >
          <defs>
            <linearGradient
              id="portfolio-area-gradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#314d8d"
                stopOpacity="0.24"
              />

              <stop
                offset="100%"
                stopColor="#314d8d"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {yTicks.map(
            (
              tick,
              index
            ) => (
              <g
                key={
                  index
                }
              >
                <line
                  x1={
                    paddingLeft
                  }
                  x2={
                    width -
                    paddingRight
                  }
                  y1={
                    tick.y
                  }
                  y2={
                    tick.y
                  }
                  stroke="#e7eaf0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                <text
                  x={
                    paddingLeft -
                    10
                  }
                  y={
                    tick.y +
                    4
                  }
                  textAnchor="end"
                  fontSize="11"
                  fill="#697386"
                >
                  {formatAxisValue(
                    tick.value
                  )}
                </text>
              </g>
            )
          )}

          <path
            d={
              areaPath
            }
            fill="url(#portfolio-area-gradient)"
          />

          <path
            d={
              linePath
            }
            fill="none"
            stroke="#314d8d"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map(
            (
              point,
              index
            ) => {
              const hasTransactions =
                (
                  point.transactions
                    ?.length ??
                  0
                ) >
                0;

              return (
                <circle
                  key={
                    index
                  }
                  cx={
                    point.x
                  }
                  cy={
                    point.y
                  }
                  r={
                    hasTransactions
                      ? 5
                      : 2.5
                  }
                  fill={
                    hasTransactions
                      ? "#ffffff"
                      : "#314d8d"
                  }
                  stroke="#314d8d"
                  strokeWidth={
                    hasTransactions
                      ? 3
                      : 0
                  }
                  pointerEvents="none"
                />
              );
            }
          )}

          {hoveredPoint && (
            <>
              <line
                x1={
                  hoveredPoint.x
                }
                x2={
                  hoveredPoint.x
                }
                y1={
                  paddingTop
                }
                y2={
                  paddingTop +
                  chartHeight
                }
                stroke="#7c879b"
                strokeWidth="1"
                strokeDasharray="4 4"
                pointerEvents="none"
              />

              <circle
                cx={
                  hoveredPoint.x
                }
                cy={
                  hoveredPoint.y
                }
                r="7"
                fill="#ffffff"
                stroke="#314d8d"
                strokeWidth="3"
                pointerEvents="none"
              />

              <circle
                cx={
                  hoveredPoint.x
                }
                cy={
                  hoveredPoint.y
                }
                r="2.5"
                fill="#314d8d"
                pointerEvents="none"
              />
            </>
          )}

          {xTickIndexes.map(
            (
              pointIndex
            ) => {
              const point =
                points[
                  pointIndex
                ];

              return (
                <text
                  key={
                    pointIndex
                  }
                  x={
                    point.x
                  }
                  y={
                    height -
                    12
                  }
                  textAnchor="middle"
                  fontSize="11"
                  fill="#697386"
                  pointerEvents="none"
                >
                  {
                    point.date
                  }
                </text>
              );
            }
          )}
        </svg>

        {hoveredPoint && (
          <div
            style={{
              position:
                "absolute",

              left: `${tooltipLeft}%`,

              top:
                14,

              transform:
                tooltipLeft >
                70
                  ? "translateX(-100%)"
                  : tooltipLeft <
                      30
                    ? "translateX(0)"
                    : "translateX(-50%)",

              width:
                260,

              maxWidth:
                "calc(100% - 20px)",

              padding:
                "12px 14px",

              border:
                "1px solid #dfe3ea",

              borderRadius:
                12,

              background:
                "rgba(255,255,255,0.98)",

              boxShadow:
                "0 8px 28px rgba(38,52,79,0.14)",

              pointerEvents:
                "none",

              zIndex:
                10,
            }}
          >
            <div
              style={{
                color:
                  "#697386",

                fontSize:
                  11,

                marginBottom:
                  3,
              }}
            >
              {
                hoveredPoint.rawDate
                  ? formatFullDate(
                      hoveredPoint.rawDate
                    )
                  : hoveredPoint.date
              }
            </div>

            <strong
              style={{
                display:
                  "block",

                color:
                  "#26344f",

                fontSize:
                  16,
              }}
            >
              {formatMoney(
                hoveredPoint.value
              )}
            </strong>

            {(
              hoveredPoint
                .transactions
                ?.length ??
              0
            ) > 0 && (
              <div
                style={{
                  marginTop:
                    11,

                  paddingTop:
                    10,

                  borderTop:
                    "1px solid #edf0f4",
                }}
              >
                <div
                  style={{
                    color:
                      "#697386",

                    fontSize:
                      10,

                    fontWeight:
                      700,

                    textTransform:
                      "uppercase",

                    letterSpacing:
                      "0.05em",

                    marginBottom:
                      8,
                  }}
                >
                  Transaktionen
                </div>

                {hoveredPoint
                  .transactions
                  ?.map(
                    (
                      transaction,
                      index
                    ) => (
                      <div
                        key={
                          `${transaction.instrumentName}-${index}`
                        }
                        style={{
                          padding:
                            index ===
                            0
                              ? "0"
                              : "9px 0 0",

                          marginTop:
                            index ===
                            0
                              ? 0
                              : 9,

                          borderTop:
                            index ===
                            0
                              ? "none"
                              : "1px solid #f0f2f5",
                        }}
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
                              8,

                            marginBottom:
                              3,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                transaction.type ===
                                "buy"
                                  ? "#0b8f55"
                                  : "#c74646",

                              fontSize:
                                11,
                            }}
                          >
                            {transaction.type ===
                            "buy"
                              ? "Kauf"
                              : "Verkauf"}
                          </strong>

                          {transaction.symbol && (
                            <span
                              style={{
                                color:
                                  "#929aa7",

                                fontSize:
                                  10,
                              }}
                            >
                              {
                                transaction.symbol
                              }
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            color:
                              "#26344f",

                            fontSize:
                              12,

                            fontWeight:
                              600,
                          }}
                        >
                          {
                            transaction.instrumentName
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              3,

                            color:
                              "#697386",

                            fontSize:
                              11,
                          }}
                        >
                          {formatQuantity(
                            transaction.quantity
                          )}
                          {" Stück"}

                          {transaction.pricePerUnit !==
                            null && (
                            <>
                              {" × "}

                              {formatTransactionMoney(
                                transaction.pricePerUnit,
                                transaction.currency
                              )}
                            </>
                          )}
                        </div>

                        {transaction.pricePerUnit !==
                          null && (
                          <div
                            style={{
                              marginTop:
                                3,

                              color:
                                "#929aa7",

                              fontSize:
                                10,
                            }}
                          >
                            Transaktionswert:{" "}

                            {formatTransactionMoney(
                              transaction.quantity *
                                transaction.pricePerUnit,
                              transaction.currency
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
              </div>
            )}

            {(
              hoveredPoint
                .transactions
                ?.length ??
              0
            ) === 0 && (
              <div
                style={{
                  marginTop:
                    9,

                  color:
                    "#929aa7",

                  fontSize:
                    10,
                }}
              >
                Keine Transaktion an
                diesem Tag
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          gap:
            16,

          marginTop:
            2,

          color:
            "#929aa7",

          fontSize:
            11,
        }}
      >
        <span>
          {
            chartData.length
          }{" "}
          historische Datenpunkte ·{" "}
          {selectedRange}
        </span>

        <span>
          Zeitraum:{" "}
          <strong
            style={{
              color:
                "#697386",
            }}
          >
            {
              firstVisible.date
            }
            {" – "}
            {
              lastVisible.date
            }
          </strong>
        </span>
      </div>
    </div>
  );
}

function filterChartData(
  data:
    PortfolioChartPoint[],
  range:
    ChartRange
) {
  if (
    range === "MAX"
  ) {
    return data;
  }

  const lastPoint =
    data[
      data.length - 1
    ];

  if (
    !lastPoint?.rawDate
  ) {
    return data;
  }

  const endDate =
    parseRawDate(
      lastPoint.rawDate
    );

  if (
    !endDate
  ) {
    return data;
  }

  const startDate =
    new Date(
      endDate
    );

  if (
    range === "1M"
  ) {
    startDate.setUTCMonth(
      startDate.getUTCMonth() -
        1
    );
  }

  if (
    range === "3M"
  ) {
    startDate.setUTCMonth(
      startDate.getUTCMonth() -
        3
    );
  }

  const filtered =
    data.filter(
      (point) => {
        if (
          !point.rawDate
        ) {
          return false;
        }

        const date =
          parseRawDate(
            point.rawDate
          );

        if (
          !date
        ) {
          return false;
        }

        return (
          date.getTime() >=
          startDate.getTime()
        );
      }
    );

  return filtered.length >=
    2
    ? filtered
    : data;
}

function parseRawDate(
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

function formatAxisValue(
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

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "de-DE",
    {
      style:
        "currency",

      currency:
        "EUR",

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );
}

function formatTransactionMoney(
  value: number,
  currency: string
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

function formatFullDate(
  value: string
) {
  const date =
    parseRawDate(
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
      weekday:
        "short",

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