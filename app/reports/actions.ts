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
  GEMINI_DAILY_LIMIT,
  GEMINI_MODEL,
  GEMINI_PROVIDER,
} from "@/lib/gemini/config";

import {
  createLastCompletedMonthlySnapshot,
  type MonthlyPortfolioSnapshot,
} from "@/lib/portfolio/monthly-snapshot";

import type {
  MonthlyReport,
  ReportCompany,
  ReportSource,
  ReportTheme,
  ReportWatchItem,
} from "./report-types";

type GenerateMonthlyReportResult = {
  success: boolean;

  error?: string;

  reportId?: string;
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

  finishReason?: string;

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

type AiCompanyContent = {
  ticker: string;

  companyName: string;

  summary: string;

  businessModel: string;

  management: string;

  supplyChain: string;

  macroExposure: string;

  monthlyDevelopments:
    string[];

  risks:
    string[];

  watchItems:
    string[];
};

type AiMonthlyReportContent = {
  executiveSummary: {
    text: string;

    takeaways:
      string[];
  };

  macro: {
    summary: string;

    portfolioImpact: string;

    themes:
      ReportTheme[];
  };

  companies:
    AiCompanyContent[];

  portfolioInsights: {
    concentration: string;

    dependencies:
      string[];

    conclusion: string;
  };

  nextMonthWatchlist:
    ReportWatchItem[];
};

export async function generateMonthlyReport(): Promise<GenerateMonthlyReportResult> {
  try {
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
      return {
        success: false,

        error:
          "Du musst angemeldet sein, um einen Monatsreport zu erstellen.",
      };
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        success: false,

        error:
          "GEMINI_API_KEY fehlt in .env.local.",
      };
    }

    /*
     * 1. Echtes Portfolio rekonstruieren.
     */
    const snapshot =
      await createLastCompletedMonthlySnapshot(
        userId
      );

    if (
      snapshot.positions.length ===
      0
    ) {
      return {
        success: false,

        error:
          `Für ${snapshot.monthLabel} konnten keine Positionen rekonstruiert werden.`,
      };
    }

    /*
     * 2. Gemini-Credit verbrauchen.
     */
    await consumeGeminiCredit(
      supabase
    );

    /*
     * 3. Gemini recherchiert nur qualitative Inhalte.
     */
    const prompt =
      buildMonthlyReportPrompt(
        snapshot
      );

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
                  0.2,

                maxOutputTokens:
                  20000,

              },
            }),
        }
      );

    const geminiResponse =
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

    const candidate =
      geminiResponse
        .candidates?.[0];

    const rawText =
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
        candidate?.finishReason ===
        "MAX_TOKENS"
      ) {
        console.error(
          "Gemini monthly report hit MAX_TOKENS.",
          {
            finishReason:
              candidate.finishReason,
      
            outputLength:
              rawText.length,
          }
        );
      
        throw new Error(
          "Gemini hat den Monatsreport wegen der maximalen Ausgabelänge abgeschnitten."
        );
      }  

    if (!rawText) {
      const blockReason =
        geminiResponse
          .promptFeedback
          ?.blockReason;

      throw new Error(
        blockReason
          ? `Gemini hat den Report blockiert: ${blockReason}`
          : "Gemini hat keinen Report zurückgegeben."
      );
    }

    /*
     * 4. JSON selbst parsen + validieren.
     *
     * Wichtig:
     * Wir vertrauen Gemini NICHT bei den
     * Portfoliozahlen.
     */
    const aiContent =
      parseAiReportContent(
        rawText
      );

    /*
     * 5. Quellen kommen ausschließlich aus
     * Grounding Metadata, nicht aus vom Modell
     * erfundenen JSON-URLs.
     */
    const sources =
      extractGroundingSources(
        candidate
          ?.groundingMetadata
          ?.groundingChunks ??
        []
      );

    /*
     * 6. Gemini-Inhalt und deterministische
     * Portfolio-Daten zusammenführen.
     */
    const report =
      buildFinalReport(
        snapshot,
        aiContent,
        sources
      );

    /*
     * 7. Existiert bereits ein Report für den
     * Monat, aktualisieren wir ihn.
     *
     * Das umgeht zugleich die NULL-Problematik
     * von portfolio_id im bisherigen UNIQUE-
     * Constraint.
     */
    const reportMonthDate =
      `${snapshot.reportMonth}-01`;

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from(
        "monthly_reports"
      )
      .select(
        "id"
      )
      .eq(
        "user_id",
        userId
      )
      .is(
        "portfolio_id",
        null
      )
      .eq(
        "report_month",
        reportMonthDate
      )
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Vorhandener Monatsreport konnte nicht geprüft werden: ${existingError.message}`
      );
    }

    const persistenceData = {
      user_id:
        userId,

      portfolio_id:
        null,

      report_month:
        reportMonthDate,

      status:
        "completed",

      portfolio_value:
        snapshot.portfolioValueEur,

      monthly_return:
        snapshot.monthlyReturnPercent,

      executive_summary:
        report.executiveSummary.text,

      report_json:
        report,

      snapshot_json:
        snapshot,

      generated_at:
        new Date()
          .toISOString(),

      updated_at:
        new Date()
          .toISOString(),
    };

    let reportId:
      string;

    if (
      existing?.id
    ) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "monthly_reports"
        )
        .update(
          persistenceData
        )
        .eq(
          "id",
          existing.id
        )
        .eq(
          "user_id",
          userId
        )
        .select(
          "id"
        )
        .single();

      if (error) {
        throw new Error(
          `Monatsreport konnte nicht aktualisiert werden: ${error.message}`
        );
      }

      reportId =
        data.id;
    } else {
      const {
        data,
        error,
      } = await supabase
        .from(
          "monthly_reports"
        )
        .insert(
          persistenceData
        )
        .select(
          "id"
        )
        .single();

      if (error) {
        throw new Error(
          `Monatsreport konnte nicht gespeichert werden: ${error.message}`
        );
      }

      reportId =
        data.id;
    }

    revalidatePath(
      "/reports"
    );

    revalidatePath(
      `/reports/${reportId}`
    );

    return {
      success: true,

      reportId,
    };
  } catch (error) {
    console.error(
      "generateMonthlyReport failed:",
      error
    );

    return {
      success: false,

      error:
        error instanceof Error
          ? error.message
          : "Beim Erstellen des Monatsreports ist ein unerwarteter Fehler aufgetreten.",
    };
  }
}

export async function generateMonthlyReportAndRedirect() {
  const result =
    await generateMonthlyReport();

  if (
    !result.success ||
    !result.reportId
  ) {
    const message =
      result.error ??
      "Der Monatsreport konnte nicht erstellt werden.";

    redirect(
      `/reports?error=${encodeURIComponent(
        message
      )}`
    );
  }

  redirect(
    `/reports/${result.reportId}`
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

function buildFinalReport(
  snapshot:
    MonthlyPortfolioSnapshot,
  ai:
    AiMonthlyReportContent,
  sources:
    ReportSource[]
): MonthlyReport {
  const companies:
    ReportCompany[] =
    snapshot.positions.map(
      (
        position
      ) => {
        const aiCompany =
          findAiCompany(
            ai.companies,
            position.symbol,
            position.name
          );

        return {
          ticker:
            position.symbol ??
            position.name,

          companyName:
            position.name,

          /*
           * Diese beiden Werte kommen NIE
           * aus Gemini.
           */
          weight:
            position.weightPercent,

          monthlyPerformance:
            position.monthlyPerformancePercent ??
            0,

          summary:
            aiCompany
              ?.summary ??
            "Für diese Position wurde keine ausreichende qualitative Analyse erzeugt.",

          businessModel:
            aiCompany
              ?.businessModel ??
            "Keine ausreichenden Informationen verfügbar.",

          management:
            aiCompany
              ?.management ??
            "Keine ausreichenden Informationen verfügbar.",

          supplyChain:
            aiCompany
              ?.supplyChain ??
            "Keine ausreichenden Informationen verfügbar.",

          macroExposure:
            aiCompany
              ?.macroExposure ??
            "Keine ausreichenden Informationen verfügbar.",

          monthlyDevelopments:
            aiCompany
              ?.monthlyDevelopments ??
            [],

          risks:
            aiCompany
              ?.risks ??
            [],

          watchItems:
            aiCompany
              ?.watchItems ??
            [],
        };
      }
    );

  return {
    id:
      snapshot.reportMonth,

    month:
      snapshot.monthLabel,

    periodLabel:
      snapshot.periodLabel,

    generatedAt:
      formatGermanDateTime(
        snapshot.generatedAt
      ),

    portfolio: {
      name:
        snapshot.portfolioName,

      value:
        snapshot.portfolioValueEur,

      monthlyReturn:
        snapshot.monthlyReturnPercent,

      monthlyChange:
        snapshot.monthlyChangeEur,

      positions:
        snapshot.positionCount,
    },

    executiveSummary:
      ai.executiveSummary,

    macro:
      ai.macro,

    companies,

    portfolioInsights:
      ai.portfolioInsights,

    nextMonthWatchlist:
      ai.nextMonthWatchlist,

    sources,
  };
}

function buildMonthlyReportPrompt(
  snapshot:
    MonthlyPortfolioSnapshot
) {
  const researchPositions =
    snapshot.positions.map(
      (
        position
      ) => ({
        instrumentId:
          position.instrumentId,

        name:
          position.name,

        symbol:
          position.symbol,

        assetType:
          position.assetType,

        portfolioWeightPercent:
          position.weightPercent,

        monthlyPerformancePercent:
          position.monthlyPerformancePercent,

        marketValueEur:
          position.marketValueEur,

        researchDepth:
          position.weightPercent >=
          15
            ? "deep"
            : position.weightPercent >=
                5
              ? "normal"
              : "compact",
      })
    );

  return `
Du bist Research-Analyst für einen privaten Portfolio-Monatsreport.

Erstelle auf Deutsch einen hochwertigen, faktenorientierten Investment-Research-Report für:

REPORT-MONAT:
${snapshot.monthLabel}

ZEITRAUM:
${snapshot.periodLabel}

WICHTIG:
Die nachfolgenden Portfolio-Zahlen stammen direkt aus der Datenbank.

Sie sind maßgeblich.

Du darfst:
- diese Zahlen interpretieren
- Zusammenhänge erklären
- Risiken und Chancen analysieren

Du darfst NICHT:
- Portfoliowerte verändern
- andere Gewichtungen erfinden
- andere Monatsperformances erfinden
- Transaktionen erfinden
- Käufe oder Verkäufe empfehlen

PORTFOLIO:

${JSON.stringify(
  {
    portfolioName:
      snapshot.portfolioName,

    portfolioValueEur:
      snapshot.portfolioValueEur,

    monthlyReturnPercent:
      snapshot.monthlyReturnPercent,

    monthlyChangeEur:
      snapshot.monthlyChangeEur,

    positionCount:
      snapshot.positionCount,

    performanceMethod:
      snapshot.returnMethod,

    positions:
      researchPositions,
  },
  null,
  2
)}

RESEARCH-AUFTRAG:

Nutze Google Search gezielt.

Recherchiere nur Informationen, die für einen Investor tatsächlich relevant sind.

Besonders wichtig:

1. Das Unternehmen / Instrument
- Was macht das Unternehmen?
- Wie verdient es Geld?
- Welche Produkte, Segmente oder Plattformen sind entscheidend?
- Welche Wettbewerbsvorteile oder strukturellen Schwächen gibt es?

2. Management
- CEO und relevantes Management
- strategische Prioritäten
- relevante Führungswechsel
- Kapitalallokation
- wichtige Aussagen des Managements

Bei ETFs oder Fonds:
Passe diesen Abschnitt sinnvoll an und analysiere stattdessen Anbieter, Index-/Fondslogik und Struktur.

3. Lieferkette
- wichtige Zulieferer
- Produktion
- Abhängigkeiten von Regionen
- Chips / Energie / Rohstoffe / Logistik, sofern relevant
- mögliche Engpässe

Erfinde keine konkrete Lieferkette, wenn sie öffentlich nicht ausreichend dokumentiert ist.

4. Weltwirtschaft
Erkläre die relevanten Zusammenhänge zwischen dem Unternehmen und:
- Zinsen
- Inflation
- Wechselkursen
- Konjunktur
- Energie
- geopolitischen Entwicklungen
- Regulierung
- regionaler Nachfrage

Aber nur, wenn sie für das konkrete Unternehmen tatsächlich relevant sind.

5. Entwicklungen im Report-Monat

Für "monthlyDevelopments" sind primär Ereignisse, Veröffentlichungen oder Entwicklungen relevant, die in:

${snapshot.periodLabel}

stattgefunden haben oder diesen Zeitraum unmittelbar betreffen.

Verwende spätere Ereignisse NICHT so, als wären sie im Report-Monat bereits bekannt gewesen.

6. Portfolio-Zusammenhänge

Suche auch nach versteckten Abhängigkeiten zwischen mehreren Positionen:
- gemeinsame Lieferketten
- gleiche Wachstumsfaktoren
- gleiche Kunden
- ähnliche Zinsabhängigkeit
- gleiche Regionen
- gleiche Technologiezyklen
- regulatorische Korrelationen

7. Makro

Der Makroteil ist KEIN allgemeiner Marktbericht.

Er soll ausschließlich beantworten:

"Welche wirtschaftlichen Entwicklungen sind für genau dieses Portfolio relevant und warum?"

DETAILTIEFE:

Positionen mit researchDepth="deep":
ausführlicher Deep Dive.

Positionen mit researchDepth="normal":
substantielle Standardanalyse.

Positionen mit researchDepth="compact":
kompakte Einordnung.

SCHREIBSTIL:

- professionell
- sachlich
- investor-orientiert
- verständlich
- konkret
- wenig Marketing-Sprache
- keine Kauf-/Verkaufsempfehlungen
- keine allgemeinen Floskeln
- erkläre immer "warum ist das für dieses Portfolio relevant?"
- lieber wenige wichtige Erkenntnisse als viele irrelevante Fakten

AUSGABE:

Gib ausschließlich gültiges JSON zurück.

Kein Markdown-Codeblock.
Kein Text vor dem JSON.
Kein Text nach dem JSON.

Verwende exakt dieses Schema:

{
  "executiveSummary": {
    "text": "string",
    "takeaways": [
      "string"
    ]
  },
  "macro": {
    "summary": "string",
    "portfolioImpact": "string",
    "themes": [
      {
        "title": "string",
        "text": "string"
      }
    ]
  },
  "companies": [
    {
      "ticker": "string",
      "companyName": "string",
      "summary": "string",
      "businessModel": "string",
      "management": "string",
      "supplyChain": "string",
      "macroExposure": "string",
      "monthlyDevelopments": [
        "string"
      ],
      "risks": [
        "string"
      ],
      "watchItems": [
        "string"
      ]
    }
  ],
  "portfolioInsights": {
    "concentration": "string",
    "dependencies": [
      "string"
    ],
    "conclusion": "string"
  },
  "nextMonthWatchlist": [
    {
      "title": "string",
      "description": "string",
      "relevance": "high"
    }
  ]
}

ANFORDERUNGEN:

- executiveSummary.text: ungefähr 5 bis 7 Sätze.
- executiveSummary.takeaways: 3 bis 4 Punkte.
- macro.themes: 2 bis 4 relevante Themen.
- companies: exakt ein Eintrag je Portfolio-Position.
- summary: maximal 3 bis 4 Sätze.
- businessModel: maximal 5 bis 7 Sätze.
- management: maximal 4 bis 6 Sätze.
- supplyChain: maximal 4 bis 6 Sätze.
- macroExposure: maximal 4 bis 6 Sätze.
- monthlyDevelopments: maximal 4 Punkte.
- risks: maximal 4 Punkte.
- watchItems: maximal 4 Punkte.
- nextMonthWatchlist: 3 bis 5 Punkte.
- relevance darf ausschließlich "high" oder "medium" sein.

Nochmals:

Portfolio-Zahlen werden NICHT Bestandteil deiner numerischen Ausgabe.

Die Anwendung fügt Gewichtungen, Performance, Portfoliowert und Positionszahl anschließend selbst ein.
  `.trim();
}

function parseAiReportContent(
  rawText: string
): AiMonthlyReportContent {
  const cleaned =
    stripJsonFence(
      rawText
    );

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        cleaned
      );
  } catch {
    console.error(
      "Invalid Gemini report JSON:",
      rawText
    );

    throw new Error(
      "Gemini hat keinen gültigen strukturierten Monatsreport zurückgegeben."
    );
  }

  const root =
    requireObject(
      parsed,
      "Report"
    );

  const executiveSummary =
    requireObject(
      root.executiveSummary,
      "executiveSummary"
    );

  const macro =
    requireObject(
      root.macro,
      "macro"
    );

  const portfolioInsights =
    requireObject(
      root.portfolioInsights,
      "portfolioInsights"
    );

  const themes =
    requireArray(
      macro.themes,
      "macro.themes"
    ).map(
      (
        item,
        index
      ) => {
        const theme =
          requireObject(
            item,
            `macro.themes[${index}]`
          );

        return {
          title:
            requireString(
              theme.title,
              `macro.themes[${index}].title`
            ),

          text:
            requireString(
              theme.text,
              `macro.themes[${index}].text`
            ),
        };
      }
    );

  const companies =
    requireArray(
      root.companies,
      "companies"
    ).map(
      (
        item,
        index
      ) => {
        const company =
          requireObject(
            item,
            `companies[${index}]`
          );

        return {
          ticker:
            requireString(
              company.ticker,
              `companies[${index}].ticker`
            ),

          companyName:
            requireString(
              company.companyName,
              `companies[${index}].companyName`
            ),

          summary:
            requireString(
              company.summary,
              `companies[${index}].summary`
            ),

          businessModel:
            requireString(
              company.businessModel,
              `companies[${index}].businessModel`
            ),

          management:
            requireString(
              company.management,
              `companies[${index}].management`
            ),

          supplyChain:
            requireString(
              company.supplyChain,
              `companies[${index}].supplyChain`
            ),

          macroExposure:
            requireString(
              company.macroExposure,
              `companies[${index}].macroExposure`
            ),

          monthlyDevelopments:
            requireStringArray(
              company.monthlyDevelopments,
              `companies[${index}].monthlyDevelopments`
            ),

          risks:
            requireStringArray(
              company.risks,
              `companies[${index}].risks`
            ),

          watchItems:
            requireStringArray(
              company.watchItems,
              `companies[${index}].watchItems`
            ),
        };
      }
    );

  const nextMonthWatchlist =
    requireArray(
      root.nextMonthWatchlist,
      "nextMonthWatchlist"
    ).map(
      (
        item,
        index
      ) => {
        const watchItem =
          requireObject(
            item,
            `nextMonthWatchlist[${index}]`
          );

        const relevance =
          requireString(
            watchItem.relevance,
            `nextMonthWatchlist[${index}].relevance`
          );

        return {
          title:
            requireString(
              watchItem.title,
              `nextMonthWatchlist[${index}].title`
            ),

          description:
            requireString(
              watchItem.description,
              `nextMonthWatchlist[${index}].description`
            ),

          relevance:
            relevance ===
            "high"
              ? "high"
              : "medium",
        } satisfies ReportWatchItem;
      }
    );

  return {
    executiveSummary: {
      text:
        requireString(
          executiveSummary.text,
          "executiveSummary.text"
        ),

      takeaways:
        requireStringArray(
          executiveSummary.takeaways,
          "executiveSummary.takeaways"
        ),
    },

    macro: {
      summary:
        requireString(
          macro.summary,
          "macro.summary"
        ),

      portfolioImpact:
        requireString(
          macro.portfolioImpact,
          "macro.portfolioImpact"
        ),

      themes,
    },

    companies,

    portfolioInsights: {
      concentration:
        requireString(
          portfolioInsights.concentration,
          "portfolioInsights.concentration"
        ),

      dependencies:
        requireStringArray(
          portfolioInsights.dependencies,
          "portfolioInsights.dependencies"
        ),

      conclusion:
        requireString(
          portfolioInsights.conclusion,
          "portfolioInsights.conclusion"
        ),
    },

    nextMonthWatchlist,
  };
}

function extractGroundingSources(
  chunks:
    GeminiGroundingChunk[]
): ReportSource[] {
  const seen =
    new Set<string>();

  const result:
    ReportSource[] =
    [];

  for (
    const chunk
    of chunks
  ) {
    const uri =
      chunk.web?.uri;

    if (
      !uri ||
      seen.has(
        uri
      )
    ) {
      continue;
    }

    seen.add(
      uri
    );

    result.push({
      title:
        chunk.web?.title ??
        uri,

      publisher:
        publisherFromUrl(
          uri
        ),

      url:
        uri,
    });
  }

  return result;
}

function findAiCompany(
  companies:
    AiCompanyContent[],
  symbol:
    | string
    | null,
  name: string
) {
  const normalizedSymbol =
    symbol
      ?.trim()
      .toUpperCase();

  if (
    normalizedSymbol
  ) {
    const symbolMatch =
      companies.find(
        (
          company
        ) =>
          company.ticker
            .trim()
            .toUpperCase() ===
          normalizedSymbol
      );

    if (
      symbolMatch
    ) {
      return symbolMatch;
    }
  }

  const normalizedName =
    normalizeText(
      name
    );

  return (
    companies.find(
      (
        company
      ) =>
        normalizeText(
          company.companyName
        ) ===
        normalizedName
    ) ??
    null
  );
}

function stripJsonFence(
  value: string
) {
  let result =
    value.trim();

  if (
    result.startsWith(
      "```json"
    )
  ) {
    result =
      result.slice(
        7
      );
  } else if (
    result.startsWith(
      "```"
    )
  ) {
    result =
      result.slice(
        3
      );
  }

  if (
    result.endsWith(
      "```"
    )
  ) {
    result =
      result.slice(
        0,
        -3
      );
  }

  return result.trim();
}

function requireObject(
  value: unknown,
  path: string
): Record<
  string,
  unknown
> {
  if (
    typeof value !==
      "object" ||
    value ===
      null ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      `Ungültige Gemini-Antwort: ${path} muss ein Objekt sein.`
    );
  }

  return value as Record<
    string,
    unknown
  >;
}

function requireArray(
  value: unknown,
  path: string
): unknown[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    throw new Error(
      `Ungültige Gemini-Antwort: ${path} muss ein Array sein.`
    );
  }

  return value;
}

function requireString(
  value: unknown,
  path: string
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      `Ungültige Gemini-Antwort: ${path} muss Text enthalten.`
    );
  }

  return value.trim();
}

function requireStringArray(
  value: unknown,
  path: string
) {
  return requireArray(
    value,
    path
  ).map(
    (
      item,
      index
    ) =>
      requireString(
        item,
        `${path}[${index}]`
      )
  );
}

function publisherFromUrl(
  value: string
) {
  try {
    const hostname =
      new URL(
        value
      ).hostname.replace(
        /^www\./,
        ""
      );

    return hostname;
  } catch {
    return "Web";
  }
}

function normalizeText(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

function formatGermanDateTime(
  value: string
) {
  const date =
    new Date(
      value
    );

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      timeZone:
        "Europe/Berlin",
    }
  ).format(
    date
  );
}