import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  ReceiptText,
} from "lucide-react";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { createTransaction } from "./actions";

import styles from "./transactions.module.css";


type TransactionsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};


export default async function TransactionsPage(
  props: TransactionsPageProps
) {
  const searchParams =
    await props.searchParams;

  const supabase =
    await createClient();


  /*
   * AUTH
   */
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


  /*
   * DEPOTS
   */
  const {
    data: portfolioData,
    error: portfolioError,
  } = await supabase
    .from("portfolios")
    .select(`
      id,
      name,
      bank_name
    `)
    .eq(
      "user_id",
      userId
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );


  if (portfolioError) {
    console.error(
      "Portfolio load error:",
      portfolioError
    );
  }


  const portfolios =
    portfolioData ?? [];


  /*
   * WERTPAPIERE
   *
   * Für den ersten Stand nehmen wir
   * alle Wertpapiere, die bereits
   * in einer Position vorkommen.
   */
  const {
    data: positionInstrumentData,
    error: positionInstrumentError,
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


  if (positionInstrumentError) {
    console.error(
      "Instrument load error:",
      positionInstrumentError
    );
  }


  const positionInstruments =
    positionInstrumentData ?? [];


  /*
   * Instrumente deduplizieren
   */
  const instrumentMap =
    new Map<
      string,
      {
        id: string;
        name: string;
        symbol: string | null;
        currency: string;
      }
    >();


  for (
    const row
    of positionInstruments
  ) {
    const instrument =
      getRelation(
        row.instruments
      );

    if (!instrument) {
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
          instrument.symbol,

        currency:
          instrument.currency,
      }
    );
  }


  const instruments =
    Array.from(
      instrumentMap.values()
    ).sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "de"
        )
    );


  /*
   * TRANSAKTIONSHISTORIE
   */
  const {
    data: transactionData,
    error: transactionError,
  } = await supabase
    .from("transactions")
    .select(`
      id,
      transaction_type,
      trade_date,
      quantity,
      price_per_unit,
      amount,
      currency,
      notes,
      created_at,
      portfolios (
        name,
        bank_name
      ),
      instruments (
        name,
        symbol
      )
    `)
    .eq(
      "user_id",
      userId
    )
    .order(
      "trade_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(100);


  const transactions =
    transactionData ?? [];


  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.shell
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <Link
              href="/"
              className={
                styles.backLink
              }
            >
              <ArrowLeft
                size={16}
              />

              Dashboard
            </Link>

            <div
              className={
                styles.titleBlock
              }
            >
              <div
                className={
                  styles.titleIcon
                }
              >
                <ReceiptText
                  size={22}
                />
              </div>

              <div>
                <h1>
                  Transaktionen
                </h1>

                <p>
                  Käufe,
                  Verkäufe,
                  Dividenden,
                  Gebühren und
                  Zahlungsströme.
                </p>
              </div>
            </div>
          </div>

          <div
            className={
              styles.headerStats
            }
          >
            <span>
              Buchungen
            </span>

            <strong>
              {transactions.length}
            </strong>
          </div>
        </header>


        {searchParams?.success && (
          <div
            className={
              styles.successMessage
            }
          >
            {
              searchParams.success
            }
          </div>
        )}


        {searchParams?.error && (
          <div
            className={
              styles.errorMessage
            }
          >
            {
              searchParams.error
            }
          </div>
        )}


        <div
          className={
            styles.layout
          }
        >
          <section
            className={
              styles.formCard
            }
          >
            <div
              className={
                styles.cardHeading
              }
            >
              <div
                className={
                  styles.smallIcon
                }
              >
                <CircleDollarSign
                  size={18}
                />
              </div>

              <div>
                <h2>
                  Neue Buchung
                </h2>

                <p>
                  Käufe und Verkäufe
                  ändern den Bestand
                  automatisch.
                </p>
              </div>
            </div>


            {portfolios.length === 0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <h3>
                  Noch kein Depot
                </h3>

                <p>
                  Lege zuerst ein
                  Depot an.
                </p>

                <Link
                  href="/depots"
                  className={
                    styles.primaryLink
                  }
                >
                  Zu den Depots
                </Link>
              </div>
            ) : (
              <form
                action={
                  createTransaction
                }
                className={
                  styles.form
                }
              >
                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="transactionType"
                  >
                    Typ
                  </label>

                  <select
                    id="transactionType"
                    name="transactionType"
                    defaultValue="buy"
                    required
                  >
                    <option value="buy">
                      Kauf
                    </option>

                    <option value="sell">
                      Verkauf
                    </option>

                    <option value="dividend">
                      Dividende
                    </option>

                    <option value="fee">
                      Gebühr
                    </option>

                    <option value="deposit">
                      Einzahlung
                    </option>

                    <option value="withdrawal">
                      Auszahlung
                    </option>
                  </select>
                </div>


                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="portfolioId"
                  >
                    Depot
                  </label>

                  <select
                    id="portfolioId"
                    name="portfolioId"
                    defaultValue=""
                    required
                  >
                    <option
                      value=""
                      disabled
                    >
                      Depot auswählen
                    </option>

                    {portfolios.map(
                      (portfolio) => (
                        <option
                          key={
                            portfolio.id
                          }
                          value={
                            portfolio.id
                          }
                        >
                          {portfolio.bank_name
                            ? `${portfolio.bank_name} · ${portfolio.name}`
                            : portfolio.name}
                        </option>
                      )
                    )}
                  </select>
                </div>


                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="instrumentId"
                  >
                    Wertpapier
                  </label>

                  <select
                    id="instrumentId"
                    name="instrumentId"
                    defaultValue=""
                  >
                    <option value="">
                      Kein Wertpapier
                    </option>

                    {instruments.map(
                      (instrument) => (
                        <option
                          key={
                            instrument.id
                          }
                          value={
                            instrument.id
                          }
                        >
                          {instrument.symbol
                            ? `${instrument.name} · ${instrument.symbol}`
                            : instrument.name}
                        </option>
                      )
                    )}
                  </select>

                  <small>
                    Für Kauf und
                    Verkauf erforderlich.
                  </small>
                </div>


                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="tradeDate"
                  >
                    Datum
                  </label>

                  <input
                    id="tradeDate"
                    name="tradeDate"
                    type="date"
                    required
                    defaultValue={
                      todayDate()
                    }
                  />
                </div>


                <div
                  className={
                    styles.twoFields
                  }
                >
                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="quantity"
                    >
                      Stückzahl
                    </label>

                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="10"
                    />
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="pricePerUnit"
                    >
                      Kurs je Stück
                    </label>

                    <input
                      id="pricePerUnit"
                      name="pricePerUnit"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="325.00"
                    />
                  </div>
                </div>


                <div
                  className={
                    styles.twoFields
                  }
                >
                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="amount"
                    >
                      Betrag
                    </label>

                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="1000.00"
                    />

                    <small>
                      Für Dividende,
                      Gebühr,
                      Einzahlung und
                      Auszahlung.
                    </small>
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="currency"
                    >
                      Währung
                    </label>

                    <select
                      id="currency"
                      name="currency"
                      defaultValue="EUR"
                    >
                      <option value="EUR">
                        EUR
                      </option>

                      <option value="USD">
                        USD
                      </option>

                      <option value="GBP">
                        GBP
                      </option>

                      <option value="CHF">
                        CHF
                      </option>
                    </select>
                  </div>
                </div>


                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="notes"
                  >
                    Notiz
                  </label>

                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    placeholder="Optional"
                  />
                </div>


                <div
                  className={
                    styles.hint
                  }
                >
                  <CalendarDays
                    size={17}
                  />

                  <p>
                    Bei Käufen wird
                    der durchschnittliche
                    Einstand automatisch
                    neu berechnet.
                    Verkäufe reduzieren
                    nur die Stückzahl.
                  </p>
                </div>


                <button
                  type="submit"
                  className={
                    styles.primaryButton
                  }
                >
                  Transaktion speichern
                </button>
              </form>
            )}
          </section>


          <section
            className={
              styles.listCard
            }
          >
            <div
              className={
                styles.listHeader
              }
            >
              <div>
                <h2>
                  Historie
                </h2>

                <p>
                  Die letzten 100
                  Buchungen.
                </p>
              </div>

              <span
                className={
                  styles.countBadge
                }
              >
                {
                  transactions.length
                }
              </span>
            </div>


            {transactionError ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <h3>
                  Historie konnte
                  nicht geladen werden
                </h3>

                <p>
                  {
                    transactionError.message
                  }
                </p>
              </div>
            ) : transactions.length === 0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <ReceiptText
                  size={28}
                />

                <h3>
                  Noch keine
                  Transaktionen
                </h3>

                <p>
                  Neue Buchungen
                  erscheinen hier
                  automatisch.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.transactionList
                }
              >
                {transactions.map(
                  (transaction) => {
                    const portfolio =
                      getRelation(
                        transaction.portfolios
                      );

                    const instrument =
                      getRelation(
                        transaction.instruments
                      );

                    return (
                      <article
                        key={
                          transaction.id
                        }
                        className={
                          styles.transactionItem
                        }
                      >
                        <div
                          className={
                            styles.transactionIcon
                          }
                        >
                          {transactionIcon(
                            transaction.transaction_type
                          )}
                        </div>

                        <div
                          className={
                            styles.transactionMain
                          }
                        >
                          <div
                            className={
                              styles.transactionTitle
                            }
                          >
                            <strong>
                              {transactionLabel(
                                transaction.transaction_type
                              )}
                            </strong>

                            <span>
                              {
                                transaction.trade_date
                              }
                            </span>
                          </div>

                          <p>
                            {instrument?.name ??
                              "Cashflow"}

                            {instrument?.symbol
                              ? ` · ${instrument.symbol}`
                              : ""}
                          </p>

                          <div
                            className={
                              styles.meta
                            }
                          >
                            {portfolio?.bank_name ??
                              portfolio?.name ??
                              "Depot"}

                            {transaction.notes
                              ? ` · ${transaction.notes}`
                              : ""}
                          </div>
                        </div>

                        <div
                          className={
                            styles.transactionValue
                          }
                        >
                          {transaction.quantity !== null &&
                          transaction.price_per_unit !== null ? (
                            <>
                              <strong>
                                {formatMoney(
                                  numeric(
                                    transaction.quantity
                                  ) *
                                    numeric(
                                      transaction.price_per_unit
                                    ),
                                  transaction.currency
                                )}
                              </strong>

                              <span>
                                {formatQuantity(
                                  numeric(
                                    transaction.quantity
                                  )
                                )}

                                {" × "}

                                {formatMoney(
                                  numeric(
                                    transaction.price_per_unit
                                  ),
                                  transaction.currency
                                )}
                              </span>
                            </>
                          ) : (
                            <strong>
                              {formatMoney(
                                numeric(
                                  transaction.amount
                                ),
                                transaction.currency
                              )}
                            </strong>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}


function transactionIcon(
  type: string
) {
  if (
    type === "buy" ||
    type === "deposit" ||
    type === "dividend"
  ) {
    return (
      <ArrowDownLeft
        size={18}
      />
    );
  }

  if (
    type === "sell" ||
    type === "withdrawal" ||
    type === "fee"
  ) {
    return (
      <ArrowUpRight
        size={18}
      />
    );
  }

  return (
    <Banknote
      size={18}
    />
  );
}


function transactionLabel(
  type: string
) {
  switch (type) {
    case "buy":
      return "Kauf";

    case "sell":
      return "Verkauf";

    case "dividend":
      return "Dividende";

    case "fee":
      return "Gebühr";

    case "deposit":
      return "Einzahlung";

    case "withdrawal":
      return "Auszahlung";

    default:
      return "Transaktion";
  }
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
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function formatQuantity(
  value: number
) {
  return new Intl.NumberFormat(
    "de-DE",
    {
      maximumFractionDigits: 8,
    }
  ).format(value);
}


function formatMoney(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "de-DE",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return `${value.toLocaleString(
      "de-DE",
      {
        maximumFractionDigits: 2,
      }
    )} ${currency}`;
  }
}


function todayDate() {
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
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  return `${year}-${month}-${day}`;
}