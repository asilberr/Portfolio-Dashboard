import Link from "next/link";

import GenerateReportButton from "./generate-report-button";

import { createClient } from "@/lib/supabase/server";

import {
  generateMonthlyReportAndRedirect,
} from "./actions";

import {
  mockReports,
  type MonthlyReport,
} from "./mock-data";

import styles from "./reports.module.css";

type StoredMonthlyReport = {
  id: string;
  report_month: string;
  portfolio_value: number | null;
  monthly_return: number | null;
  executive_summary: string | null;
  generated_at: string | null;
  report_json: MonthlyReport;
};

const euroFormatter =
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  });

const monthFormatter =
  new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  });

function formatReportMonth(
  value: string,
) {
  return monthFormatter.format(
    new Date(`${value}T12:00:00`),
  );
}

export default async function ReportsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let storedReports:
    | StoredMonthlyReport[]
    | null = null;

  if (user) {
    const { data, error } =
      await supabase
        .from("monthly_reports")
        .select(`
          id,
          report_month,
          portfolio_value,
          monthly_return,
          executive_summary,
          generated_at,
          report_json
        `)
        .eq("user_id", user.id)
        .order("report_month", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Could not load monthly reports:",
        error,
      );
    } else {
      storedReports =
        data as StoredMonthlyReport[];
    }
  }

  const hasStoredReports =
    storedReports &&
    storedReports.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header
          className={styles.pageHeader}
        >
          <div>
            <p className={styles.eyebrow}>
              Reports
            </p>

            <h1>Monatsreports</h1>

            <p
              className={
                styles.headerDescription
              }
            >
              Deine ausführlichen
              Portfolio-Analysen,
              Entwicklungen und
              Zusammenhänge im
              Zeitverlauf.
            </p>
          </div>

          {user && (
            <form
              action={
                generateMonthlyReportAndRedirect
              }
            >
              <GenerateReportButton />
            </form>
          )}
        </header>

        {!user && (
          <div
            className={
              styles.infoMessage
            }
          >
            Melde dich an, um
            Monatsreports zu speichern und
            später automatisch erstellen zu
            lassen.
          </div>
        )}

        {hasStoredReports ? (
          <section
            className={styles.reportGrid}
          >
            {storedReports?.map(
              (
                report:
                  StoredMonthlyReport,
              ) => {
                const reportData =
                  report.report_json;

                return (
                  <Link
                    href={`/reports/${report.id}`}
                    key={report.id}
                    className={
                      styles.reportCard
                    }
                  >
                    <div
                      className={
                        styles.reportCardTop
                      }
                    >
                      <div>
                        <span
                          className={
                            styles.reportBadge
                          }
                        >
                          Monatsreport
                        </span>

                        <h2>
                          {formatReportMonth(
                            report.report_month,
                          )}
                        </h2>

                        <p>
                          {
                            reportData
                              .portfolio
                              .name
                          }
                        </p>
                      </div>

                      <span
                        className={
                          styles.arrow
                        }
                      >
                        →
                      </span>
                    </div>

                    <div
                      className={
                        styles.reportStats
                      }
                    >
                      <div>
                        <span>
                          Portfoliowert
                        </span>

                        <strong>
                          {euroFormatter.format(
                            report.portfolio_value ??
                              reportData
                                .portfolio
                                .value,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Monat
                        </span>

                        <strong
                          className={
                            (report.monthly_return ??
                              reportData
                                .portfolio
                                .monthlyReturn) >=
                            0
                              ? styles.positive
                              : styles.negative
                          }
                        >
                          {(report.monthly_return ??
                            reportData
                              .portfolio
                              .monthlyReturn) >=
                          0
                            ? "+"
                            : ""}

                          {(
                            report.monthly_return ??
                            reportData
                              .portfolio
                              .monthlyReturn
                          ).toFixed(1)}
                          %
                        </strong>
                      </div>
                    </div>

                    <p
                      className={
                        styles.reportPreview
                      }
                    >
                      {report.executive_summary ??
                        reportData
                          .executiveSummary
                          .text}
                    </p>

                    {report.generated_at && (
                      <div
                        className={
                          styles.reportMeta
                        }
                      >
                        Erstellt am{" "}
                        {new Date(
                          report.generated_at,
                        ).toLocaleDateString(
                          "de-DE",
                        )}
                      </div>
                    )}
                  </Link>
                );
              },
            )}
          </section>
        ) : (
          <>
            <div
              className={
                styles.previewLabel
              }
            >
              Vorschau
            </div>

            <section
              className={
                styles.reportGrid
              }
            >
              {mockReports.map(
                (
                  report: MonthlyReport,
                ) => (
                  <Link
                    href={`/reports/${report.id}`}
                    key={report.id}
                    className={
                      styles.reportCard
                    }
                  >
                    <div
                      className={
                        styles.reportCardTop
                      }
                    >
                      <div>
                        <span
                          className={
                            styles.reportBadge
                          }
                        >
                          Beispielreport
                        </span>

                        <h2>
                          {report.month}
                        </h2>

                        <p>
                          {
                            report.portfolio
                              .name
                          }
                        </p>
                      </div>

                      <span
                        className={
                          styles.arrow
                        }
                      >
                        →
                      </span>
                    </div>

                    <div
                      className={
                        styles.reportStats
                      }
                    >
                      <div>
                        <span>
                          Portfoliowert
                        </span>

                        <strong>
                          {euroFormatter.format(
                            report
                              .portfolio
                              .value,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Monat
                        </span>

                        <strong
                          className={
                            report
                              .portfolio
                              .monthlyReturn >=
                            0
                              ? styles.positive
                              : styles.negative
                          }
                        >
                          {report
                            .portfolio
                            .monthlyReturn >=
                          0
                            ? "+"
                            : ""}

                          {report.portfolio.monthlyReturn.toFixed(
                            1,
                          )}
                          %
                        </strong>
                      </div>
                    </div>

                    <p
                      className={
                        styles.reportPreview
                      }
                    >
                      {
                        report
                          .executiveSummary
                          .text
                      }
                    </p>
                  </Link>
                ),
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}