import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  createPortfolio,
  deletePortfolio,
} from "./actions";

import styles from "./depots.module.css";

type Portfolio = {
  id: string;
  name: string;
  bank_name: string | null;
  created_at: string;
};

type PageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function DepotsPage(
  props: PageProps
) {
  const searchParams = await props.searchParams;

  const supabase = await createClient();

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getClaims();

  const userId = authData?.claims?.sub;

  if (authError || !userId) {
    redirect("/login");
  }

  const {
    data,
    error: portfoliosError,
  } = await supabase
    .from("portfolios")
    .select(
      "id, name, bank_name, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: true,
    });

  const portfolios =
    (data as Portfolio[] | null) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link
              href="/"
              className={styles.backLink}
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <div className={styles.titleBlock}>
              <div className={styles.titleIcon}>
                <WalletCards size={22} />
              </div>

              <div>
                <h1>Meine Depots</h1>

                <p>
                  Verwalte hier deine Banken,
                  Broker und Wertpapierdepots.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.counter}>
            <span>Depots</span>
            <strong>
              {portfolios.length}
            </strong>
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

        <div className={styles.layout}>
          <section
            className={styles.formCard}
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
                  Depot hinzufügen
                </h2>

                <p>
                  Lege zunächst deine
                  bestehenden Wertpapierdepots
                  an.
                </p>
              </div>
            </div>

            <form
              action={createPortfolio}
              className={styles.form}
            >
              <div
                className={styles.field}
              >
                <label htmlFor="bankName">
                  Bank / Anbieter
                </label>

                <input
                  id="bankName"
                  name="bankName"
                  type="text"
                  autoComplete="organization"
                  placeholder="z. B. ING"
                />

                <span>
                  Bank oder Broker, bei dem
                  das Depot geführt wird.
                </span>
              </div>

              <div
                className={styles.field}
              >
                <label htmlFor="name">
                  Name des Depots
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="z. B. Direkt-Depot"
                />

                <span>
                  Ein frei wählbarer Name
                  für dein Depot.
                </span>
              </div>

              <button
                type="submit"
                className={
                  styles.primaryButton
                }
              >
                <Plus size={17} />
                Depot anlegen
              </button>
            </form>
          </section>

          <section
            className={styles.listCard}
          >
            <div
              className={
                styles.listHeader
              }
            >
              <div>
                <h2>
                  Vorhandene Depots
                </h2>

                <p>
                  Diese Depots gehören zu
                  deinem Benutzerkonto.
                </p>
              </div>

              <span
                className={
                  styles.countBadge
                }
              >
                {portfolios.length}
              </span>
            </div>

            {portfoliosError ? (
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
                  !
                </div>

                <h3>
                  Depots konnten nicht
                  geladen werden
                </h3>

                <p>
                  {
                    portfoliosError.message
                  }
                </p>
              </div>
            ) : portfolios.length ===
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
                  <Building2
                    size={24}
                  />
                </div>

                <h3>
                  Noch keine Depots
                  angelegt
                </h3>

                <p>
                  Lege dein erstes Depot
                  an, zum Beispiel bei ING,
                  DKB oder Trade Republic.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.depotList
                }
              >
                {portfolios.map(
                  (portfolio) => (
                    <article
                      key={
                        portfolio.id
                      }
                      className={
                        styles.depotItem
                      }
                    >
                      <div
                        className={
                          styles.depotMain
                        }
                      >
                        <div
                          className={
                            styles.bankIcon
                          }
                        >
                          <Building2
                            size={20}
                          />
                        </div>

                        <div
                          className={
                            styles.depotDetails
                          }
                        >
                          <h3>
                            {
                              portfolio.name
                            }
                          </h3>

                          <p>
                            {portfolio.bank_name ??
                              "Keine Bank angegeben"}
                          </p>

                          <span>
                            Angelegt am{" "}
                            {formatDate(
                              portfolio.created_at
                            )}
                          </span>
                        </div>
                      </div>

                      <form
                        action={
                          deletePortfolio
                        }
                      >
                        <input
                          type="hidden"
                          name="portfolioId"
                          value={
                            portfolio.id
                          }
                        />

                        <button
                          type="submit"
                          className={
                            styles.deleteButton
                          }
                        >
                          <Trash2
                            size={17}
                          />
                          Löschen
                        </button>
                      </form>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        <section
          className={styles.nextStep}
        >
          <div>
            <span
              className={
                styles.nextLabel
              }
            >
              ALS NÄCHSTES
            </span>

            <h2>
              Positionen den Depots
              zuordnen
            </h2>

            <p>
              Danach ergänzen wir Aktien,
              ETFs und Fonds inklusive
              Stückzahl, Kaufkurs und
              Wertpapierkennung.
            </p>
          </div>

          <div
            className={
              styles.nextNumber
            }
          >
            02
          </div>
        </section>
      </div>
    </main>
  );
}

function formatDate(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "–";
  }

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}