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
  
    monthlyDevelopments:
      string[];
  
    risks:
      string[];
  
    watchItems:
      string[];
  };
  
  export type ReportWatchItem = {
    title: string;
  
    description: string;
  
    relevance:
      | "high"
      | "medium";
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
      ReportCompany[];
  
    portfolioInsights: {
      concentration: string;
  
      dependencies:
        string[];
  
      conclusion: string;
    };
  
    nextMonthWatchlist:
      ReportWatchItem[];
  
    sources:
      ReportSource[];
  };