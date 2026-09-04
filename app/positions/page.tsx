import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CircleDollarSign,
  Plus,
  Trash2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import {
  createPosition,
  deletePosition,
} from "./actions";

import styles from "./positions.module.css";

type PositionsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

type Portfolio = {
  id: string;
  name: string;
  bank_name: string | null;
};

type Position = {
  id: string;
  portfolio_id: string;
  quantity: number | string;
  average_cost: number | string | null;
  cost_currency: string | null;
  updated_at: string;

  portfolios:
    | {
        id: string;
        name: string;
        bank_name: string | null;
      }
    | {
        id: string;
        name: string;
        bank_name: string | null;
      }[]
    | null;

  instruments:
    | {
        id: string;
        name: string;
        symbol: string | null;
        isin: string | null;
        asset_type: string;
        currency: string;
      }
    | {
        id: string;
        name: string;
        symbol: string | null;
        isin: string | null;
        asset_type: string;
        currency: string;
      }[]
    | null;
};

export default async function PositionsPage(
  props: PositionsPageProps
) {
  const searchParams =
    await props.searchParams;

  const supabase =
    await createClient();

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getClaims();

  const userId =
    authData?.claims?.sub;

  if (
    authError ||
    !userId
  ) {
    redirect("/login");
  }

  const {
    data: portfolioData,
    error: portfolioError,
  } = await supabase
    .from("portfolios")
    .select(
      "id, name, bank_name"
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: true,
    });

  const portfolios =
    (portfolioData as Portfolio[] | null) ??
    [];

  const {
    data: positionData,
    error: positionsError,
  } = await supabase
    .from("positions")
    .select(`
      id,
      portfolio_id,
      quantity,
      average_cost,
      cost_currency,
      updated_at,
      portfolios (
        id,
        name,
        bank_name
      ),
      instruments (
        id,
        name,
        symbol,
        isin,
        asset_type,
        currency
      )
    `)
    .order("updated_at", {
      ascending: false,
    });

  const positions =
    (positionData as Position[] | null) ??
    [];

  const investedCapital =
    positions.reduce(
      (sum, position) => {
        const quantity =
          Number(position.quantity) ||
          0;

        const averageCost =
          Number(
            position.average_cost
          ) || 0;

        return (
          sum +
          quantity * averageCost
        );
      },
      0
    );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header
          className={styles.header}
        >
          <div>
            <Link
              href="/"
              className={
                styles.backLink
              }
            >
              <ArrowLeft size={16} />
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
                <BarChart3
                  size={22}
                />
              </div>

              <div>
                <h1>
                  Meine Positionen
                </h1>

                <p>
                  Erfasse Aktien,
                  ETFs und Fonds und
                  ordne sie deinen
                  Depots zu.
                </p>
              </div>
            </div>
          </div>

          <div
            className={
              styles.headerStats
            }
          >
            <div>
              <span>
                Positionen
              </span>

              <strong>
                {positions.length}
              </strong>
            </div>

            <div>
              <span>
                Einstand
              </span>

              <strong>
                {formatMoney(
                  investedCapital,
                  "EUR"
                )}
              </strong>
            </div>
          </div>
        </header>

        {searchParams?.success && (
          <div
            className={
              styles.successMessage
            }
          >
            {searchParams.success}
          </div>
        )}

        {searchParams?.error && (
          <div
            className={
              styles.errorMessage
            }
          >
            {searchParams.error}
          </div>
        )}

        {portfolioError && (
          <div
            className={
              styles.errorMessage
            }
          >
            Depots konnten nicht
            geladen werden:{" "}
            {portfolioError.message}
          </div>
        )}

        <div
          className={styles.layout}
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
                <Plus size={18} />
              </div>

              <div>
                <h2>
                  Position hinzufügen
                </h2>

                <p>
                  Erfasse deinen
                  aktuellen Bestand.
                </p>
              </div>
            </div>

            {portfolios.length ===
            0 ? (
              <div
                className={
                  styles.noDepot
                }
              >
                <Building2
                  size={26}
                />

                <h3>
                  Zuerst ein Depot
                  anlegen
                </h3>

                <p>
                  Eine Position muss
                  immer einem Depot
                  zugeordnet sein.
                </p>

                <Link
                  href="/depots"
                  className={
                    styles.primaryLink
                  }
                >
                  Depot anlegen
                </Link>
              </div>
            ) : (
              <form
                action={
                  createPosition
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
                    htmlFor="portfolioId"
                  >
                    Depot
                  </label>

                  <select
                    id="portfolioId"
                    name="portfolioId"
                    required
                    defaultValue=""
                  >
                    <option
                      value=""
                      disabled
                    >
                      Depot auswählen
                    </option>

                    {portfolios.map(
                      (
                        portfolio
                      ) => (
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
                    htmlFor="assetType"
                  >
                    Typ
                  </label>

                  <select
                    id="assetType"
                    name="assetType"
                    required
                    defaultValue="stock"
                  >
                    <option value="stock">
                      Aktie
                    </option>

                    <option value="etf">
                      ETF
                    </option>

                    <option value="fund">
                      Fonds
                    </option>

                    <option value="cash">
                      Cash
                    </option>
                  </select>
                </div>

                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="name"
                  >
                    Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="z. B. Microsoft"
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
                      htmlFor="symbol"
                    >
                      Ticker
                    </label>

                    <input
                      id="symbol"
                      name="symbol"
                      type="text"
                      placeholder="z. B. MSFT"
                    />
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="isin"
                    >
                      ISIN
                    </label>

                    <input
                      id="isin"
                      name="isin"
                      type="text"
                      placeholder="US5949181045"
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
                      htmlFor="quantity"
                    >
                      Stückzahl
                    </label>

                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.00000001"
                      required
                      placeholder="10"
                    />
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="averageCost"
                    >
                      Ø Einstandskurs
                    </label>

                    <input
                      id="averageCost"
                      name="averageCost"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      required
                      placeholder="325,50"
                    />
                  </div>
                </div>

                <div
                  className={
                    styles.field
                  }
                >
                  <label
                    htmlFor="currency"
                  >
                    Einstandswährung
                  </label>

                  <select
                    id="currency"
                    name="currency"
                    defaultValue="EUR"
                  >
                    <option value="EUR">
                      EUR · Euro
                    </option>

                    <option value="USD">
                      USD · US-Dollar
                    </option>

                    <option value="GBP">
                      GBP · Pfund
                    </option>

                    <option value="CHF">
                      CHF · Schweizer
                      Franken
                    </option>
                  </select>
                </div>

                <div
                  className={
                    styles.formHint
                  }
                >
                  <CircleDollarSign
                    size={17}
                  />

                  <p>
                    Der Einstandskurs
                    ist zunächst der
                    durchschnittliche
                    Kaufpreis pro Stück.
                    Transaktionen bauen
                    wir später separat
                    ein.
                  </p>
                </div>

                <button
                  type="submit"
                  className={
                    styles.primaryButton
                  }
                >
                  <Plus size={17} />
                  Position speichern
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
                  Aktuelle Bestände
                </h2>

                <p>
                  Echte Positionen aus
                  deinem Benutzerkonto.
                </p>
              </div>

              <span
                className={
                  styles.countBadge
                }
              >
                {positions.length}
              </span>
            </div>

            {positionsError ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <h3>
                  Positionen konnten
                  nicht geladen werden
                </h3>

                <p>
                  {
                    positionsError.message
                  }
                </p>
              </div>
            ) : positions.length ===
              0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <div
                  className={
                    styles.emptyIcon
                  }
                >
                  <BarChart3
                    size={25}
                  />
                </div>

                <h3>
                  Noch keine
                  Positionen
                </h3>

                <p>
                  Erfasse links deine
                  erste Aktie, deinen
                  ersten ETF oder Fonds.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.positionList
                }
              >
                {positions.map(
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
                      Number(
                        position.quantity
                      ) || 0;

                    const averageCost =
                      Number(
                        position.average_cost
                      ) || 0;

                    const invested =
                      quantity *
                      averageCost;

                    return (
                      <article
                        key={
                          position.id
                        }
                        className={
                          styles.positionItem
                        }
                      >
                        <div
                          className={
                            styles.positionMain
                          }
                        >
                          <div
                            className={
                              styles.assetIcon
                            }
                          >
                            {assetTypeShort(
                              instrument?.asset_type
                            )}
                          </div>

                          <div
                            className={
                              styles.positionDetails
                            }
                          >
                            <div
                              className={
                                styles.positionTitle
                              }
                            >
                              <h3>
                                {instrument?.name ??
                                  "Unbekanntes Wertpapier"}
                              </h3>

                              <span>
                                {assetTypeLabel(
                                  instrument?.asset_type
                                )}
                              </span>
                            </div>

                            <p>
                              {instrument?.symbol ??
                                "Kein Ticker"}

                              {instrument?.isin
                                ? ` · ${instrument.isin}`
                                : ""}
                            </p>

                            <div
                              className={
                                styles.positionMeta
                              }
                            >
                              <span>
                                {portfolio?.bank_name ??
                                  "Depot"}
                                {" · "}
                                {portfolio?.name ??
                                  "Unbekannt"}
                              </span>

                              <span>
                                {formatQuantity(
                                  quantity
                                )}{" "}
                                Stück
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={
                            styles.positionValue
                          }
                        >
                          <span>
                            Einstand
                          </span>

                          <strong>
                            {formatMoney(
                              invested,
                              position.cost_currency ??
                                "EUR"
                            )}
                          </strong>

                          <small>
                            Ø{" "}
                            {formatMoney(
                              averageCost,
                              position.cost_currency ??
                                "EUR"
                            )}
                          </small>
                        </div>

                        <form
                          action={
                            deletePosition
                          }
                        >
                          <input
                            type="hidden"
                            name="positionId"
                            value={
                              position.id
                            }
                          />

                          <button
                            type="submit"
                            className={
                              styles.deleteButton
                            }
                            title="Position löschen"
                          >
                            <Trash2
                              size={17}
                            />
                          </button>
                        </form>
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

function getRelation<T>(
  relation: T | T[] | null
): T | null {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function assetTypeLabel(
  value?: string
) {
  switch (value) {
    case "stock":
      return "Aktie";

    case "etf":
      return "ETF";

    case "fund":
      return "Fonds";

    case "cash":
      return "Cash";

    default:
      return "Position";
  }
}

function assetTypeShort(
  value?: string
) {
  switch (value) {
    case "stock":
      return "A";

    case "etf":
      return "E";

    case "fund":
      return "F";

    case "cash":
      return "C";

    default:
      return "P";
  }
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