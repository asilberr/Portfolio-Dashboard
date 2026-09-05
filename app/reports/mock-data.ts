export type ReportSource = {
    title: string;
    publisher: string;
    url: string;
  };
  
  export type ReportTheme = {
    title: string;
    text: string;
  };
  
  export type ReportCompany = {
    ticker: string;
    companyName: string;
    weight: number;
    monthlyPerformance: number;
  
    summary: string;
    businessModel: string;
    management: string;
    supplyChain: string;
    macroExposure: string;
  
    monthlyDevelopments: string[];
    risks: string[];
    watchItems: string[];
  };
  
  export type ReportWatchItem = {
    title: string;
    description: string;
    relevance: "high" | "medium";
  };
  
  export type MonthlyReport = {
    id: string;
    month: string;
    periodLabel: string;
    generatedAt: string;
  
    portfolio: {
      name: string;
      value: number;
      monthlyReturn: number;
      monthlyChange: number;
      positions: number;
    };
  
    executiveSummary: {
      text: string;
      takeaways: string[];
    };
  
    macro: {
      summary: string;
      portfolioImpact: string;
      themes: ReportTheme[];
    };
  
    companies: ReportCompany[];
  
    portfolioInsights: {
      concentration: string;
      dependencies: string[];
      conclusion: string;
    };
  
    nextMonthWatchlist: ReportWatchItem[];
  
    sources: ReportSource[];
  };
  
  export const mockReports: MonthlyReport[] = [
    {
      id: "2026-08",
      month: "August 2026",
      periodLabel: "01.08.2026 – 31.08.2026",
      generatedAt: "01.09.2026",
  
      portfolio: {
        name: "Mein Portfolio",
        value: 5101.2,
        monthlyReturn: 4.8,
        monthlyChange: 233.64,
        positions: 4,
      },
  
      executiveSummary: {
        text:
          "Dein Portfolio hat sich im August positiv entwickelt. Besonders die hohe Gewichtung technologieorientierter Unternehmen unterstützte die Performance. Gleichzeitig bleibt das Portfolio vergleichsweise stark von wenigen Unternehmen, dem US-Technologiesektor und globalen Halbleiter-Lieferketten abhängig. Für die kommenden Monate sind neben Unternehmenszahlen vor allem die Entwicklung der US-Zinsen, Investitionen in künstliche Intelligenz und die Nachfrage nach Premium-Elektronik relevant.",
        takeaways: [
          "Technologieunternehmen waren der wichtigste Performancetreiber.",
          "Die Konzentration auf wenige große Positionen bleibt das zentrale Portfoliorisiko.",
          "Mehrere Beteiligungen hängen indirekt vom gleichen Halbleiter- und KI-Investitionszyklus ab.",
        ],
      },
  
      macro: {
        summary:
          "Das wirtschaftliche Umfeld bleibt von der Entwicklung der Inflation, der Geldpolitik großer Zentralbanken und unterschiedlichen regionalen Wachstumsaussichten geprägt. Für globale Technologieunternehmen spielen zusätzlich Wechselkurse, Investitionsbudgets großer Unternehmen sowie die Nachfrage nach Halbleitern eine wichtige Rolle.",
  
        portfolioImpact:
          "Da ein großer Teil deines Portfolios aus international tätigen US-Technologieunternehmen besteht, beeinflussen insbesondere US-Zinsen, der US-Dollar, globale IT-Investitionen und asiatische Lieferketten die fundamentale Entwicklung deiner Positionen.",
  
        themes: [
          {
            title: "Zinsen & Bewertungen",
            text:
              "Sinkende langfristige Renditen können insbesondere Wachstumsunternehmen unterstützen, da zukünftige Gewinne stärker bewertet werden. Steigende Renditen können entsprechend Druck auf hohe Bewertungsmultiplikatoren ausüben.",
          },
          {
            title: "KI-Investitionszyklus",
            text:
              "Hohe Investitionen in Rechenzentren, Chips und Cloud-Infrastruktur wirken sich direkt oder indirekt auf mehrere Unternehmen im Portfolio aus.",
          },
          {
            title: "Globale Lieferketten",
            text:
              "Die starke Konzentration der modernsten Halbleiterfertigung in Asien bleibt ein struktureller Faktor für zahlreiche Technologieunternehmen.",
          },
        ],
      },
  
      companies: [
        {
          ticker: "AAPL",
          companyName: "Apple",
          weight: 28.4,
          monthlyPerformance: 3.2,
  
          summary:
            "Apple gehört zu den weltweit größten Technologieunternehmen. Das Unternehmen kombiniert Hardware, Software und Dienstleistungen in einem eng integrierten Ökosystem. Neben dem iPhone gewinnen Services wie App Store, iCloud und andere Abonnements strategisch an Bedeutung.",
  
          businessModel:
            "Apple verdient den Großteil seiner Umsätze weiterhin mit Hardware. Das Ökosystem schafft jedoch hohe Kundenbindung und ermöglicht zusätzliche margenstarke Serviceumsätze. Die installierte Gerätebasis ist daher ein wesentlicher strategischer Vermögenswert.",
  
          management:
            "Das Unternehmen wird von CEO Tim Cook geführt. Unter seiner Führung wurde insbesondere das Dienstleistungsgeschäft ausgebaut und die globale operative Lieferkette weiterentwickelt.",
  
          supplyChain:
            "Apple entwickelt zentrale Komponenten und Produkte selbst, lässt jedoch große Teile der Hardware durch externe Partner fertigen. Die Lieferkette ist global verteilt, weist aber weiterhin bedeutende Abhängigkeiten von asiatischer Fertigung und Halbleiterproduktion auf.",
  
          macroExposure:
            "Apple reagiert unter anderem auf globale Konsumausgaben, Wechselkurse und die Nachfrage nach Premium-Elektronik. Schwächeres Wachstum in wichtigen Absatzmärkten kann sich auf Geräteverkäufe auswirken.",
  
          monthlyDevelopments: [
            "Der Markt blickt zunehmend auf den kommenden Produktzyklus.",
            "Services bleiben ein wichtiger Bestandteil der langfristigen Wachstumserwartungen.",
            "Die Entwicklung der Nachfrage in China bleibt strategisch relevant.",
          ],
  
          risks: [
            "Hohe Abhängigkeit vom iPhone-Ökosystem.",
            "Regulatorischer Druck auf App-Store-Geschäftsmodelle.",
            "Komplexe globale Lieferketten.",
            "Hohe Erwartungen bereits in der Bewertung berücksichtigt.",
          ],
  
          watchItems: [
            "Entwicklung der iPhone-Nachfrage",
            "Wachstum der Services-Sparte",
            "Produktstrategie rund um KI",
          ],
        },
  
        {
          ticker: "MSFT",
          companyName: "Microsoft",
          weight: 25.1,
          monthlyPerformance: 5.9,
  
          summary:
            "Microsoft ist einer der weltweit führenden Anbieter von Unternehmenssoftware und Cloud-Infrastruktur. Azure, Microsoft 365 und das wachsende KI-Angebot gehören zu den wichtigsten langfristigen Wachstumstreibern.",
  
          businessModel:
            "Microsoft kombiniert wiederkehrende Software-Abonnements, Cloud-Infrastruktur und Unternehmensplattformen. Der hohe Anteil wiederkehrender Umsätze sorgt für vergleichsweise gute Planbarkeit.",
  
          management:
            "CEO Satya Nadella hat Microsoft in den vergangenen Jahren stark auf Cloud-Infrastruktur und Plattformdienste ausgerichtet. Aktuell gehört künstliche Intelligenz zu den wichtigsten strategischen Investitionsfeldern.",
  
          supplyChain:
            "Microsoft ist weniger direkt von klassischer Hardwarefertigung abhängig als Apple, benötigt für sein wachsendes Cloud- und KI-Geschäft jedoch große Mengen leistungsfähiger Server- und Halbleiterhardware.",
  
          macroExposure:
            "Unternehmensinvestitionen in IT, Cloud und KI sind besonders relevant. Eine deutliche wirtschaftliche Abschwächung könnte Investitionsbudgets belasten, während strukturelle Digitalisierungstrends unterstützend wirken.",
  
          monthlyDevelopments: [
            "KI-Infrastruktur bleibt ein zentraler Investitionsschwerpunkt.",
            "Azure ist für die Wachstumserwartungen besonders relevant.",
            "Hohe Investitionen erhöhen gleichzeitig die Anforderungen an zukünftiges Umsatzwachstum.",
          ],
  
          risks: [
            "Sehr hohe Investitionen in Rechenzentren.",
            "Wachsende regulatorische Aufmerksamkeit.",
            "Hohe Erwartungen an KI-Monetarisierung.",
          ],
  
          watchItems: [
            "Azure-Wachstum",
            "Capex-Entwicklung",
            "Copilot-Monetarisierung",
          ],
        },
  
        {
          ticker: "NVDA",
          companyName: "NVIDIA",
          weight: 21.7,
          monthlyPerformance: 8.4,
  
          summary:
            "NVIDIA entwickelt Grafikprozessoren und Computing-Plattformen. Das Unternehmen ist zu einem zentralen Infrastrukturunternehmen für das Training und den Betrieb moderner KI-Modelle geworden.",
  
          businessModel:
            "Neben leistungsfähigen Chips besitzt NVIDIA mit CUDA ein umfangreiches Software-Ökosystem. Diese Kombination aus Hardware und Software bildet einen wichtigen Wettbewerbsvorteil.",
  
          management:
            "NVIDIA wird vom Mitgründer Jensen Huang geführt. Die Unternehmensstrategie ist stark auf beschleunigtes Computing, Rechenzentren und künstliche Intelligenz ausgerichtet.",
  
          supplyChain:
            "NVIDIA entwickelt seine Chips, besitzt jedoch keine eigene führende Halbleiterfertigung. Die Produktion ist deshalb von spezialisierten Foundries und weiteren Partnern innerhalb der Halbleiter-Lieferkette abhängig.",
  
          macroExposure:
            "Die Entwicklung hängt aktuell stark von den Investitionsbudgets großer Cloud- und Technologieunternehmen ab. Ein Rückgang des KI-Infrastruktur-Ausbaus könnte das Wachstum deutlich beeinflussen.",
  
          monthlyDevelopments: [
            "Nachfrage nach KI-Beschleunigern bleibt zentral für die Investmentthese.",
            "Die Erwartungen an zukünftiges Wachstum bleiben außergewöhnlich hoch.",
            "Produktionskapazitäten innerhalb der Halbleiterindustrie bleiben relevant.",
          ],
  
          risks: [
            "Hohe Bewertung und hohe Wachstumserwartungen.",
            "Abhängigkeit vom KI-Investitionszyklus.",
            "Fertigungsabhängigkeiten.",
            "Zunehmender Wettbewerb.",
          ],
  
          watchItems: [
            "Data-Center-Wachstum",
            "Lieferfähigkeit neuer Chips",
            "Capex großer Cloud-Anbieter",
          ],
        },
  
        {
          ticker: "GOOGL",
          companyName: "Alphabet",
          weight: 24.8,
          monthlyPerformance: 2.6,
  
          summary:
            "Alphabet ist der Mutterkonzern von Google. Suchmaschinenwerbung stellt weiterhin den wirtschaftlichen Kern dar, während YouTube, Google Cloud und KI-Produkte zusätzliche Wachstumsfelder bilden.",
  
          businessModel:
            "Das Unternehmen monetarisiert seine enorme Nutzerreichweite hauptsächlich über Werbung. Cloud-Dienste und Unternehmenssoftware diversifizieren das Geschäftsmodell zunehmend.",
  
          management:
            "CEO Sundar Pichai führt sowohl Alphabet als auch Google. Ein wesentlicher strategischer Fokus liegt derzeit auf der Integration generativer KI in bestehende Produkte.",
  
          supplyChain:
            "Alphabet ist als Software- und Plattformunternehmen vergleichsweise wenig von klassischen Konsumgüter-Lieferketten abhängig. Der Ausbau eigener Rechenzentren schafft jedoch steigende Abhängigkeiten von Chips, Energie und Rechenzentrumsinfrastruktur.",
  
          macroExposure:
            "Werbeumsätze hängen von der wirtschaftlichen Aktivität und Marketingbudgets ab. Gleichzeitig treiben digitale Transformation und KI die Nachfrage nach Cloud-Infrastruktur.",
  
          monthlyDevelopments: [
            "Generative KI verändert zunehmend die klassische Internetsuche.",
            "Google Cloud entwickelt sich zu einem wichtigen Ergebnisbeitrag.",
            "Regulatorische Verfahren bleiben relevant.",
          ],
  
          risks: [
            "Disruption des klassischen Suchgeschäfts durch KI.",
            "Kartell- und Regulierungsrisiken.",
            "Hohe Infrastrukturinvestitionen.",
          ],
  
          watchItems: [
            "Monetarisierung von KI-Suche",
            "Google-Cloud-Margen",
            "Regulatorische Entwicklungen",
          ],
        },
      ],
  
      portfolioInsights: {
        concentration:
          "Die vier größten Positionen machen praktisch das gesamte betrachtete Portfolio aus. Dadurch können einzelne Unternehmensentwicklungen die Gesamtperformance deutlich beeinflussen.",
  
        dependencies: [
          "Mehrere Positionen profitieren vom gleichen KI-Investitionszyklus.",
          "Microsoft, Alphabet und NVIDIA hängen zunehmend von hohen Investitionen in Rechenzentren ab.",
          "Apple und NVIDIA besitzen relevante Abhängigkeiten innerhalb asiatischer Halbleiter-Lieferketten.",
          "Das Portfolio ist stark gegenüber großen US-Technologieunternehmen exponiert.",
        ],
  
        conclusion:
          "Die Unternehmen unterscheiden sich zwar hinsichtlich ihrer Geschäftsmodelle, wirtschaftlich existieren jedoch mehr gemeinsame Einflussfaktoren, als die reine Anzahl der Positionen vermuten lässt.",
      },
  
      nextMonthWatchlist: [
        {
          title: "KI-Investitionen",
          description:
            "Aussagen großer Cloud-Anbieter zu ihren Investitionsbudgets können wichtige Hinweise für NVIDIA sowie indirekt Microsoft und Alphabet liefern.",
          relevance: "high",
        },
        {
          title: "Apple Produktzyklus",
          description:
            "Neue Produkte und Aussagen zur Nachfrage können die Erwartungen an Apples kommenden Gerätezyklus beeinflussen.",
          relevance: "high",
        },
        {
          title: "Zinsentwicklung",
          description:
            "Veränderungen langfristiger US-Renditen können die Bewertung wachstumsorientierter Technologieunternehmen beeinflussen.",
          relevance: "medium",
        },
      ],
  
      sources: [
        {
          title: "Apple Investor Relations",
          publisher: "Apple",
          url: "https://investor.apple.com/",
        },
        {
          title: "Microsoft Investor Relations",
          publisher: "Microsoft",
          url: "https://www.microsoft.com/en-us/Investor",
        },
        {
          title: "NVIDIA Investor Relations",
          publisher: "NVIDIA",
          url: "https://investor.nvidia.com/",
        },
        {
          title: "Alphabet Investor Relations",
          publisher: "Alphabet",
          url: "https://abc.xyz/investor/",
        },
      ],
    },
  ];
  
  export function getMockReport(
    id: string,
  ): MonthlyReport | undefined {
    return mockReports.find(
      (report: MonthlyReport) => report.id === id,
    );
  }