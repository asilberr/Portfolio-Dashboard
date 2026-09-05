import {
    GEMINI_DAILY_LIMIT,
    GEMINI_MODEL,
    GEMINI_PROVIDER,
  } from "@/lib/gemini/config";
  
import {
    revalidatePath,
  } from "next/cache";
  
  import {
    redirect,
  } from "next/navigation";
  
  import {
    createClient,
  } from "@/lib/supabase/server";
  

  type PositionRow = {
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
  
  type ReviewPosition = {
    name: string;
  
    symbol:
      | string
      | null;
  
    depot: string;
  
    assetType: string;
  
    quantity: number;
  
    marketCurrency: string;
  
    currentPrice:
      | number
      | null;
  
    marketValueEur:
      | number
      | null;
  
    investedApproxEur:
      | number
      | null;
  
    profitLossEur:
      | number
      | null;
  
    profitLossPercent:
      | number
      | null;
  
    portfolioWeightPercent:
      number;
  };
  
  type GeminiGroundingChunk = {
    web?: {
      uri?: string;
  
      title?: string;
    };
  };
  
  type GeminiCandidate = {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  
    groundingMetadata?: {
      groundingChunks?:
        GeminiGroundingChunk[];
  
      webSearchQueries?:
        string[];
    };
  };
  
  type GeminiResponse = {
    candidates?:
      GeminiCandidate[];
  
    promptFeedback?: {
      blockReason?: string;
    };
  
    error?: {
      message?: string;
    };
  };
  
  export async function generatePortfolioReview() {
    "use server";
  
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
  
    const apiKey =
      process.env.GEMINI_API_KEY;
  
    if (!apiKey) {
      redirectError(
        "GEMINI_API_KEY fehlt in .env.local."
      );
    }
  
    const {
      data: positionData,
      error: positionError,
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
      `);
  
    if (positionError) {
      redirectError(
        `Positionen konnten nicht geladen werden: ${positionError.message}`
      );
    }
  
    const positions =
      (positionData as
        | PositionRow[]
        | null) ?? [];
  
    if (
      positions.length ===
      0
    ) {
      redirectError(
        "Für einen KI-Review brauchst du mindestens eine Position."
      );
    }
  
    const instrumentIds =
      Array.from(
        new Set(
          positions.map(
            (position) =>
              position.instrument_id
          )
        )
      );
  
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
      .order(
        "captured_at",
        {
          ascending: false,
        }
      );
  
    if (priceError) {
      redirectError(
        `Kursdaten konnten nicht geladen werden: ${priceError.message}`
      );
    }
  
    const priceSnapshots =
      (priceData as
        | PriceSnapshotRow[]
        | null) ?? [];
  
    const latestPriceByInstrument =
      new Map<
        string,
        PriceSnapshotRow
      >();
  
    for (
      const snapshot
      of priceSnapshots
    ) {
      if (
        !latestPriceByInstrument.has(
          snapshot.instrument_id
        )
      ) {
        latestPriceByInstrument.set(
          snapshot.instrument_id,
          snapshot
        );
      }
    }
  
    const currencies =
      new Set<string>();
  
    for (
      const position
      of positions
    ) {
      const instrument =
        getRelation(
          position.instruments
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
  
      if (
        marketCurrency !==
        "EUR"
      ) {
        currencies.add(
          marketCurrency
        );
      }
  
      if (
        costCurrency !==
        "EUR"
      ) {
        currencies.add(
          costCurrency
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
        .order(
          "captured_at",
          {
            ascending: false,
          }
        );
  
      if (fxError) {
        redirectError(
          `FX-Daten konnten nicht geladen werden: ${fxError.message}`
        );
      }
  
      fxSnapshots =
        (fxData as
          | FxSnapshotRow[]
          | null) ?? [];
    }
  
    const latestFxByCurrency =
      new Map<
        string,
        number
      >();
  
    for (
      const snapshot
      of fxSnapshots
    ) {
      const currency =
        snapshot.from_currency
          .trim()
          .toUpperCase();
  
      if (
        !latestFxByCurrency.has(
          currency
        )
      ) {
        latestFxByCurrency.set(
          currency,
          numeric(
            snapshot.rate
          )
        );
      }
    }
  
    const reviewPositions:
      ReviewPosition[] =
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
  
          const latestPrice =
            latestPriceByInstrument.get(
              position.instrument_id
            );
  
          const currentPrice =
            latestPrice
              ? numeric(
                  latestPrice.price
                )
              : null;
  
          const marketFx =
            getFx(
              marketCurrency,
              latestFxByCurrency
            );
  
          const costFx =
            getFx(
              costCurrency,
              latestFxByCurrency
            );
  
          const marketValueEur =
            currentPrice !==
              null &&
            marketFx !==
              null
              ? quantity *
                currentPrice *
                marketFx
              : null;
  
          const investedApproxEur =
            costFx !==
            null
              ? quantity *
                averageCost *
                costFx
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
            profitLossEur !==
              null &&
            investedApproxEur !==
              null &&
            investedApproxEur >
              0
              ? (
                  profitLossEur /
                  investedApproxEur
                ) *
                100
              : null;
  
          return {
            name:
              instrument?.name ??
              "Unbekannt",
  
            symbol:
              instrument?.symbol ??
              null,
  
            depot:
              portfolio?.bank_name ??
              portfolio?.name ??
              "Unbekannt",
  
            assetType:
              instrument?.asset_type ??
              "unknown",
  
            quantity,
  
            marketCurrency,
  
            currentPrice,
  
            marketValueEur,
  
            investedApproxEur,
  
            profitLossEur,
  
            profitLossPercent,
  
            portfolioWeightPercent:
              0,
          };
        }
      );
  
    const portfolioValueEur =
      reviewPositions.reduce(
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
  
    const investedValueEur =
      reviewPositions.reduce(
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
  
    const profitLossEur =
      portfolioValueEur -
      investedValueEur;
  
    const profitLossPercent =
      investedValueEur >
      0
        ? (
            profitLossEur /
            investedValueEur
          ) *
          100
        : 0;
  
    for (
      const position
      of reviewPositions
    ) {
      position.portfolioWeightPercent =
        portfolioValueEur >
        0 &&
        position.marketValueEur !==
          null
          ? (
              position.marketValueEur /
              portfolioValueEur
            ) *
            100
          : 0;
    }
  
    reviewPositions.sort(
      (a, b) =>
        (
          b.marketValueEur ??
          0
        ) -
        (
          a.marketValueEur ??
          0
        )
    );
  
    try {
      await consumeGeminiCredit(
        supabase
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gemini-Credit-Limit erreicht.";
  
      redirectError(
        message
      );
    }
  
    const portfolioSnapshot = {
      generatedAt:
        new Date()
          .toISOString(),
  
      portfolioValueEur:
        round2(
          portfolioValueEur
        ),
  
      investedValueEur:
        round2(
          investedValueEur
        ),
  
      profitLossEur:
        round2(
          profitLossEur
        ),
  
      profitLossPercent:
        round2(
          profitLossPercent
        ),
  
      positionCount:
        reviewPositions.length,
  
      positions:
        reviewPositions.map(
          (position) => ({
            name:
              position.name,
  
            symbol:
              position.symbol,
  
            depot:
              position.depot,
  
            assetType:
              position.assetType,
  
            quantity:
              position.quantity,
  
            marketCurrency:
              position.marketCurrency,
  
            currentPrice:
              nullableRound2(
                position.currentPrice
              ),
  
            marketValueEur:
              nullableRound2(
                position.marketValueEur
              ),
  
            investedApproxEur:
              nullableRound2(
                position.investedApproxEur
              ),
  
            profitLossEur:
              nullableRound2(
                position.profitLossEur
              ),
  
            profitLossPercent:
              nullableRound2(
                position.profitLossPercent
              ),
  
            portfolioWeightPercent:
              round2(
                position.portfolioWeightPercent
              ),
          })
        ),
    };
  
    const prompt =
      buildReviewPrompt(
        portfolioSnapshot
      );
  
    let geminiResponse:
      GeminiResponse;
  
    try {
      const response =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          {
            method:
              "POST",
  
            cache:
              "no-store",
  
            headers: {
              "Content-Type":
                "application/json",
  
              "x-goog-api-key":
                apiKey,
            },
  
            body:
              JSON.stringify({
                contents: [
                  {
                    role:
                      "user",
  
                    parts: [
                      {
                        text:
                          prompt,
                      },
                    ],
                  },
                ],
  
                tools: [
                  {
                    google_search:
                      {},
                  },
                ],
  
                generationConfig: {
                  temperature:
                    0.25,
  
                  maxOutputTokens:
                    4096,
                },
              }),
          }
        );
  
      geminiResponse =
        (
          await response.json()
        ) as GeminiResponse;
  
      if (
        !response.ok
      ) {
        throw new Error(
          geminiResponse.error
            ?.message ??
            `Gemini antwortete mit HTTP ${response.status}.`
        );
      }
    } catch (error) {
      console.error(
        "Gemini portfolio review failed:",
        error
      );
  
      const message =
        error instanceof Error
          ? error.message
          : "Unbekannter Gemini-Fehler";
  
      redirectError(
        `KI-Review fehlgeschlagen: ${message}`
      );
    }
  
    const candidate =
      geminiResponse
        .candidates?.[0];
  
    const reviewText =
      candidate?.content
        ?.parts
        ?.map(
          (part) =>
            part.text ??
            ""
        )
        .join("")
        .trim() ??
      "";
  
    if (
      !reviewText
    ) {
      const blockReason =
        geminiResponse
          .promptFeedback
          ?.blockReason;
  
      redirectError(
        blockReason
          ? `Gemini hat den Review blockiert: ${blockReason}`
          : "Gemini hat keinen Review-Text zurückgegeben."
      );
    }
  
    const groundingMetadata =
      candidate
        ?.groundingMetadata;
  
    const sources =
      (
        groundingMetadata
          ?.groundingChunks ??
        []
      )
        .map(
          (
            chunk,
            index
          ) => {
            const uri =
              chunk.web?.uri;
  
            if (!uri) {
              return null;
            }
  
            return {
              index:
                index + 1,
  
              title:
                chunk.web?.title ??
                uri,
  
              url:
                uri,
            };
          }
        )
        .filter(
          (
            source
          ): source is {
            index: number;
            title: string;
            url: string;
          } =>
            source !==
            null
        );
  
    const reviewData = {
      portfolio:
        portfolioSnapshot,
  
      webSearchQueries:
        groundingMetadata
          ?.webSearchQueries ??
        [],
  
      sourceCount:
        sources.length,
    };
  
    const {
      error: insertError,
    } = await supabase
      .from(
        "portfolio_reviews"
      )
      .insert({
        user_id:
          userId,
  
        model:
          GEMINI_MODEL,
  
        portfolio_value_eur:
          portfolioSnapshot
            .portfolioValueEur,
  
        invested_value_eur:
          portfolioSnapshot
            .investedValueEur,
  
        profit_loss_eur:
          portfolioSnapshot
            .profitLossEur,
  
        profit_loss_percent:
          portfolioSnapshot
            .profitLossPercent,
  
        position_count:
          portfolioSnapshot
            .positionCount,
  
        review_text:
          reviewText,
  
        review_data:
          reviewData,
  
        sources,
  
        status:
          "completed",
      });
  
    if (
      insertError
    ) {
      console.error(
        "Portfolio review insert error:",
        insertError
      );
  
      redirectError(
        `Der Review wurde erzeugt, konnte aber nicht gespeichert werden: ${insertError.message}`
      );
    }
  
    revalidatePath("/");
  
    redirect(
      `/?reviewSuccess=${encodeURIComponent(
        "KI-Portfolio-Review wurde erstellt und gespeichert."
      )}`
    );
  }
  
  async function consumeGeminiCredit(
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
          GEMINI_PROVIDER,
  
        p_daily_limit:
          GEMINI_DAILY_LIMIT,
      }
    );
  
    if (error) {
      throw new Error(
        error.message
      );
    }
  
    return Number(
      data
    );
  }
  
  function buildReviewPrompt(
    portfolioSnapshot: unknown
  ) {
    return `
  Du bist der Analyse-Assistent eines privaten Portfolio-Dashboards.
  
  Erstelle auf Deutsch einen aktuellen, faktenorientierten Portfolio-Review.
  
  Du erhältst unten ausschließlich Portfolio-Kennzahlen aus der Datenbank des Nutzers. Behandle diese Zahlen als maßgebliche Portfolio-Daten. Erfinde keine zusätzlichen Depotwerte oder Transaktionen.
  
  PORTFOLIO-DATEN:
  ${JSON.stringify(
    portfolioSnapshot,
    null,
    2
  )}
  
  Nutze Google Search gezielt für aktuelle, tatsächlich relevante Nachrichten und Entwicklungen zu den im Portfolio enthaltenen Unternehmen, ETFs oder Fonds.
  
  Berücksichtige besonders:
  - Konzentrationsrisiken und Positionsgrößen
  - aktuelle Gewinne und Verluste
  - auffällige Einzelpositionen
  - Diversifikation nach Titeln und Assetklassen
  - aktuelle relevante Unternehmens-, Branchen- oder Marktnews
  - mögliche Zusammenhänge zwischen jüngsten Nachrichten und Portfolio-Risiken
  - wichtige Punkte, die der Nutzer in nächster Zeit beobachten sollte
  
  Wichtig:
  - Schreibe keine erfundenen Fakten.
  - Verändere keine Portfolio-Zahlen.
  - Trenne klar zwischen den Portfolio-Daten und extern recherchierten Informationen.
  - Wenn du für einen Titel keine relevante aktuelle Nachricht findest, sage das nicht unnötig einzeln.
  - Priorisiere wirklich relevante Meldungen statt möglichst vieler Meldungen.
  - Gib keine definitive Kauf- oder Verkaufsempfehlung.
  - Formuliere keine Aussagen wie "du solltest kaufen" oder "du solltest verkaufen".
  - Du darfst Risiken, Chancen und Beobachtungspunkte klar benennen.
  - Verwende Prozent- und Geldwerte konkret, wenn sie für die Analyse relevant sind.
  - Schreibe kompakt, aber substanziell.
  - Hebe besonders wichtige Begriffe, Positionen, Risiken oder Entwicklungen sparsam mit Markdown-Fettschrift im Format **Begriff** hervor.
  - Verwende Fettschrift gezielt. In der Regel reichen 2 bis 5 Hervorhebungen pro Abschnitt.
  - Verwende keine Tabellen.
  
  Struktur:
  
  ## Kurzfazit
  Schreibe ein eigenständig verständliches Kurzfazit mit etwa 4 bis 6 Sätzen.
  
  Das Kurzfazit ist der wichtigste Teil des Reviews und wird im Dashboard standardmäßig sichtbar angezeigt, während die Detailanalyse zunächst eingeklappt sein kann.
  
  Es soll deshalb auch ohne die folgenden Abschnitte bereits ein klares Gesamtbild vermitteln.
  
  Beantworte darin möglichst kompakt:
  - Wie ist das Portfolio insgesamt aufgestellt?
  - Was ist aktuell die auffälligste Stärke oder positive Entwicklung?
  - Was ist das wichtigste Risiko oder die größte Konzentration?
  - Gibt es eine besonders relevante aktuelle Nachricht oder Entwicklung?
  - Was sollte der Nutzer in nächster Zeit besonders beobachten?
  
  Nenne konkrete Portfolio-Zahlen, wenn sie für das Gesamtbild relevant sind.
  
  Priorisiere Erkenntnisse statt einer bloßen Aufzählung von Kennzahlen.
  
  Vermeide generische Aussagen wie "das Portfolio zeigt Chancen und Risiken".
  
  Formuliere stattdessen konkret, zum Beispiel mit Aussagen über Gewichtungen, Performance, Konzentrationen oder aktuelle externe Entwicklungen.
  
  Nutze innerhalb des Kurzfazits sparsam **Fettschrift**, um 2 bis 4 besonders wichtige Aussagen, Positionen oder Themen visuell hervorzuheben.
  
  ## Portfolio-Struktur
  Analysiere die wichtigsten Aussagen zu Gewichtung, Konzentration und Diversifikation.
  
  Konzentriere dich auf tatsächlich relevante Besonderheiten. Nenne insbesondere große Positionsgewichte oder auffällige Abhängigkeiten.
  
  ## Auffällige Positionen
  Ordne die wichtigsten Gewinner, Verlierer oder besonders großen Positionen ein und erkläre knapp, weshalb sie für das Gesamtportfolio relevant sind.
  
  Priorisiere wenige wirklich auffällige Positionen statt jede Position einzeln zu kommentieren.
  
  ## Aktuelle News & Einordnung
  Nutze nur die wichtigsten aktuellen Entwicklungen aus der Google-Suche.
  
  Erkläre nicht nur die Nachricht selbst, sondern ihre mögliche Bedeutung für dieses konkrete Portfolio.
  
  Vermeide einen allgemeinen News-Überblick ohne Portfolio-Bezug.
  
  ## Risiken & Beobachtungspunkte
  Nenne 3 bis 6 konkrete Punkte, die in den nächsten Wochen relevant sein könnten.
  
  Formuliere diese als klare Beobachtungspunkte und nicht als Kauf- oder Verkaufsempfehlungen.
  
  Die Antwort soll als gut lesbares Markdown zurückgegeben werden.
  
  Halte dich exakt an die genannten Überschriften und beginne immer mit:
  
  ## Kurzfazit
    `.trim();
  }
  
  function redirectError(
    message: string
  ): never {
    redirect(
      `/?reviewError=${encodeURIComponent(
        message
      )}`
    );
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
  
  function getFx(
    currency: string,
    latestFxByCurrency: Map<
      string,
      number
    >
  ) {
    if (
      currency ===
      "EUR"
    ) {
      return 1;
    }
  
    return (
      latestFxByCurrency.get(
        currency
      ) ??
      null
    );
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
  
  function nullableRound2(
    value:
      | number
      | null
  ) {
    if (
      value ===
      null
    ) {
      return null;
    }
  
    return round2(
      value
    );
  }