import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  getMockReport,
  type MonthlyReport,
  type ReportCompany,
  type ReportSource,
  type ReportTheme,
  type ReportWatchItem,
} from "../mock-data";

import styles from "../reports.module.css";

type ReportPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type StoredMonthlyReport = {
  id: string;
  report_json: MonthlyReport;
};

const euroFormatter =
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  });

export default async function ReportPage({
  params,
}: ReportPageProps) {
  const { id } = await params;

  /*
   * Erst prüfen wir, ob die URL
   * zu unserem bisherigen Mock gehört.
   */
  let report:
    | MonthlyReport
    | undefined =
    getMockReport(id);

  /*
   * Falls nicht, suchen wir den
   * Report in Supabase.
   */
  if (!report) {
    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notFound();
    }

    const {
      data,
      error,
    } = await supabase
      .from("monthly_reports")
      .select(`
        id,
        report_json
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (
      error ||
      !data
    ) {
      notFound();
    }

    const storedReport =
      data as StoredMonthlyReport;

    report =
      storedReport.report_json;
  }

  if (!report) {
    notFound();
  }

  return (
    <main className={styles.page}>
      <div className={styles.reportContainer}>
        <Link
          href="/reports"
          className={styles.backLink}
        >
          ← Alle Reports
        </Link>

        <section className={styles.cover}>
          <div className={styles.coverTop}>
            <span
              className={styles.coverLabel}
            >
              PORTFOLIO REPORT
            </span>

            <span
              className={styles.coverDate}
            >
              {report.periodLabel}
            </span>
          </div>

          <div
            className={styles.coverContent}
          >
            <p className={styles.eyebrow}>
              Monatlicher Investment-Überblick
            </p>

            <h1>{report.month}</h1>

            <p
              className={
                styles.coverSubtitle
              }
            >
              Entwicklungen, Unternehmen und
              Zusammenhänge in deinem
              Portfolio.
            </p>
          </div>

          <div className={styles.coverStats}>
            <div>
              <span>Portfoliowert</span>

              <strong>
                {euroFormatter.format(
                  report.portfolio.value,
                )}
              </strong>
            </div>

            <div>
              <span>Performance</span>

              <strong
                className={
                  report.portfolio
                    .monthlyReturn >= 0
                    ? styles.positive
                    : styles.negative
                }
              >
                {report.portfolio
                  .monthlyReturn >= 0
                  ? "+"
                  : ""}
                {report.portfolio.monthlyReturn.toFixed(
                  1,
                )}
                %
              </strong>
            </div>

            <div>
              <span>Positionen</span>

              <strong>
                {report.portfolio.positions}
              </strong>
            </div>
          </div>
        </section>

        <nav className={styles.reportNav}>
          <a href="#summary">
            Kurzüberblick
          </a>

          <a href="#macro">
            Weltwirtschaft
          </a>

          <a href="#companies">
            Unternehmen
          </a>

          <a href="#portfolio">
            Portfolio
          </a>

          <a href="#watchlist">
            Ausblick
          </a>
        </nav>

        <section
          id="summary"
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <span>01</span>

            <div>
              <p className={styles.eyebrow}>
                Executive Summary
              </p>

              <h2>
                Der Monat in 60 Sekunden
              </h2>
            </div>
          </div>

          <div
            className={styles.summaryCard}
          >
            <p
              className={styles.summaryText}
            >
              {report.executiveSummary.text}
            </p>

            <div
              className={styles.takeaways}
            >
              {report.executiveSummary.takeaways.map(
                (takeaway: string) => (
                  <div
                    key={takeaway}
                    className={
                      styles.takeaway
                    }
                  >
                    <span>→</span>

                    <p>{takeaway}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section
          id="macro"
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <span>02</span>

            <div>
              <p className={styles.eyebrow}>
                Makroökonomie
              </p>

              <h2>
                Die Welt um dein Portfolio
              </h2>
            </div>
          </div>

          <div className={styles.twoColumn}>
            <div className={styles.card}>
              <p
                className={styles.cardLabel}
              >
                Wirtschaftliches Umfeld
              </p>

              <p>
                {report.macro.summary}
              </p>
            </div>

            <div
              className={
                styles.highlightCard
              }
            >
              <p
                className={styles.cardLabel}
              >
                Warum das für dich relevant
                ist
              </p>

              <p>
                {
                  report.macro
                    .portfolioImpact
                }
              </p>
            </div>
          </div>

          <div className={styles.themeGrid}>
            {report.macro.themes.map(
              (theme: ReportTheme) => (
                <article
                  className={
                    styles.themeCard
                  }
                  key={theme.title}
                >
                  <h3>{theme.title}</h3>

                  <p>{theme.text}</p>
                </article>
              ),
            )}
          </div>
        </section>

        <section
          id="companies"
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <span>03</span>

            <div>
              <p className={styles.eyebrow}>
                Deep Dive
              </p>

              <h2>
                Deine Unternehmen
              </h2>
            </div>
          </div>

          <div
            className={styles.companyList}
          >
            {report.companies.map(
              (
                company: ReportCompany,
              ) => (
                <article
                  key={company.ticker}
                  className={
                    styles.companyCard
                  }
                >
                  <div
                    className={
                      styles.companyHeader
                    }
                  >
                    <div
                      className={
                        styles.companyIdentity
                      }
                    >
                      <div
                        className={
                          styles.companyTicker
                        }
                      >
                        {company.ticker}
                      </div>

                      <div>
                        <h3>
                          {
                            company.companyName
                          }
                        </h3>

                        <p>
                          {company.weight.toFixed(
                            1,
                          )}
                          % deines Portfolios
                        </p>
                      </div>
                    </div>

                    <div
                      className={
                        company.monthlyPerformance >=
                        0
                          ? styles.performancePositive
                          : styles.performanceNegative
                      }
                    >
                      {company.monthlyPerformance >=
                      0
                        ? "+"
                        : ""}
                      {company.monthlyPerformance.toFixed(
                        1,
                      )}
                      %
                      <small>
                        im Monat
                      </small>
                    </div>
                  </div>

                  <p
                    className={
                      styles.companySummary
                    }
                  >
                    {company.summary}
                  </p>

                  <div
                    className={
                      styles.companyDevelopment
                    }
                  >
                    <p
                      className={
                        styles.cardLabel
                      }
                    >
                      Diesen Monat wichtig
                    </p>

                    {company.monthlyDevelopments.map(
                      (item: string) => (
                        <div
                          key={item}
                          className={
                            styles.developmentItem
                          }
                        >
                          <span>→</span>

                          <p>{item}</p>
                        </div>
                      ),
                    )}
                  </div>

                  <div
                    className={
                      styles.detailsGroup
                    }
                  >
                    <details>
                      <summary>
                        Geschäftsmodell
                        verstehen
                      </summary>

                      <div
                        className={
                          styles.detailsContent
                        }
                      >
                        <p>
                          {
                            company.businessModel
                          }
                        </p>
                      </div>
                    </details>

                    <details>
                      <summary>
                        CEO & Management
                      </summary>

                      <div
                        className={
                          styles.detailsContent
                        }
                      >
                        <p>
                          {company.management}
                        </p>
                      </div>
                    </details>

                    <details>
                      <summary>
                        Lieferkette
                      </summary>

                      <div
                        className={
                          styles.detailsContent
                        }
                      >
                        <p>
                          {
                            company.supplyChain
                          }
                        </p>
                      </div>
                    </details>

                    <details>
                      <summary>
                        Einordnung in die
                        Weltwirtschaft
                      </summary>

                      <div
                        className={
                          styles.detailsContent
                        }
                      >
                        <p>
                          {
                            company.macroExposure
                          }
                        </p>
                      </div>
                    </details>

                    <details>
                      <summary>
                        Risiken &
                        Beobachtungspunkte
                      </summary>

                      <div
                        className={
                          styles.detailsContent
                        }
                      >
                        <div
                          className={
                            styles.detailsColumns
                          }
                        >
                          <div>
                            <h4>
                              Risiken
                            </h4>

                            {company.risks.map(
                              (
                                risk: string,
                              ) => (
                                <p key={risk}>
                                  • {risk}
                                </p>
                              ),
                            )}
                          </div>

                          <div>
                            <h4>
                              Weiter
                              beobachten
                            </h4>

                            {company.watchItems.map(
                              (
                                item: string,
                              ) => (
                                <p key={item}>
                                  • {item}
                                </p>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section
          id="portfolio"
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <span>04</span>

            <div>
              <p className={styles.eyebrow}>
                Portfolioebene
              </p>

              <h2>
                Was deine Positionen
                verbindet
              </h2>
            </div>
          </div>

          <div
            className={styles.insightCard}
          >
            <p
              className={
                styles.insightLead
              }
            >
              {
                report.portfolioInsights
                  .concentration
              }
            </p>

            <div
              className={
                styles.dependencies
              }
            >
              {report.portfolioInsights.dependencies.map(
                (
                  dependency: string,
                ) => (
                  <div
                    key={dependency}
                    className={
                      styles.dependency
                    }
                  >
                    <span>↳</span>

                    <p>{dependency}</p>
                  </div>
                ),
              )}
            </div>

            <div
              className={
                styles.insightConclusion
              }
            >
              <strong>Einordnung</strong>

              <p>
                {
                  report.portfolioInsights
                    .conclusion
                }
              </p>
            </div>
          </div>
        </section>

        <section
          id="watchlist"
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <span>05</span>

            <div>
              <p className={styles.eyebrow}>
                Nächster Monat
              </p>

              <h2>
                Was jetzt wichtig wird
              </h2>
            </div>
          </div>

          <div
            className={styles.watchlist}
          >
            {report.nextMonthWatchlist.map(
              (
                watchItem: ReportWatchItem,
                index: number,
              ) => (
                <article
                  key={watchItem.title}
                  className={
                    styles.watchItem
                  }
                >
                  <span
                    className={
                      styles.watchNumber
                    }
                  >
                    {String(
                      index + 1,
                    ).padStart(2, "0")}
                  </span>

                  <div>
                    <div
                      className={
                        styles.watchItemHeader
                      }
                    >
                      <h3>
                        {watchItem.title}
                      </h3>

                      {watchItem.relevance ===
                        "high" && (
                        <span
                          className={
                            styles.highPriority
                          }
                        >
                          Besonders relevant
                        </span>
                      )}
                    </div>

                    <p>
                      {
                        watchItem.description
                      }
                    </p>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section
          className={
            styles.sourcesSection
          }
        >
          <details>
            <summary>
              Quellen (
              {report.sources.length})
            </summary>

            <div
              className={styles.sourceList}
            >
              {report.sources.map(
                (
                  source: ReportSource,
                ) => (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    key={source.url}
                    className={
                      styles.source
                    }
                  >
                    <div>
                      <strong>
                        {source.title}
                      </strong>

                      <span>
                        {
                          source.publisher
                        }
                      </span>
                    </div>

                    <span>↗</span>
                  </a>
                ),
              )}
            </div>
          </details>
        </section>

        <footer
          className={styles.reportFooter}
        >
          <p>
            Generiert am{" "}
            {report.generatedAt}
          </p>

          <p>
            Dieser Report dient der
            Information und stellt keine
            Anlageberatung dar.
          </p>
        </footer>
      </div>
    </main>
  );
}