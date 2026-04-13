export const MARKET_ASSETS = [
  {
    id: 'sp500',
    name: 'S&P 500',
    symbol: 'SPX',
    provider: 'fred',
    seriesId: 'SP500',
    chartType: 'price',
    explanation:
      'Official S&P 500 daily close index from FRED.',
    sourceLabel: 'FRED / SP500',
  },
  {
    id: 'nasdaq100',
    name: 'Nasdaq 100',
    symbol: 'NDX',
    provider: 'fred',
    seriesId: 'NASDAQ100',
    chartType: 'price',
    explanation:
      'Official Nasdaq-100 daily close index from FRED.',
    sourceLabel: 'FRED / NASDAQ100',
  },
  {
    id: 'russell2000',
    name: 'Russell 2000 / Small Cap Proxy',
    symbol: 'SMALLCAP',
    provider: 'fred',
    seriesId: 'NASDAQNQUSS',
    chartType: 'price',
    explanation:
      'Free daily small-cap proxy using the Nasdaq US Small Cap Index.',
    sourceLabel: 'FRED / NASDAQNQUSS',
  },
  {
    id: 'eafe',
    name: 'International Equity / Developed Markets Proxy',
    symbol: 'DM',
    provider: 'fred',
    seriesId: 'NASDAQNQDMN',
    chartType: 'price',
    explanation:
      'Free developed-markets proxy using the Nasdaq Developed Markets Net Total Return Index.',
    sourceLabel: 'FRED / NASDAQNQDMN',
  },
  {
    id: 'gold',
    name: 'Gold',
    symbol: 'GCUSD',
    provider: 'stooq',
    chartType: 'price',
    explanation:
      'Gold commodity history from FMP using the GCUSD symbol.',
    sourceLabel: 'FMP / GCUSD',
  },
  {
    id: 'copper',
    name: 'Copper',
    symbol: 'COPPER',
    provider: 'fred',
    seriesId: 'PCOPPUSDM',
    chartType: 'price',
    explanation:
      'Global copper benchmark price from FRED/IMF. Monthly frequency, so this card must be labeled as a slower-moving macro signal rather than a live daily market price.',
    sourceLabel: 'FRED / PCOPPUSDM',
  },
  {
    id: 'crude',
    name: 'Crude Oil',
    symbol: 'WTI',
    provider: 'fred',
    seriesId: 'DCOILWTICO',
    chartType: 'price',
    explanation:
      'Official daily WTI Cushing spot price from FRED/EIA.',
    sourceLabel: 'FRED / DCOILWTICO',
  },
  {
    id: 'dollar',
    name: 'US Dollar',
    symbol: 'DXY Proxy',
    provider: 'fred',
    seriesId: 'DTWEXBGS',
    chartType: 'price',
    explanation:
      'Nominal Broad U.S. Dollar Index from FRED. This is a stronger free macro dollar measure than a fragile ETF proxy.',
    sourceLabel: 'FRED / DTWEXBGS',
  },
  {
    id: 'eurusd',
    name: 'EUR/USD',
    symbol: 'EUR/USD',
    provider: 'fred',
    seriesId: 'DEXUSEU',
    chartType: 'price',
    explanation:
      'Official daily EUR/USD proxy from FRED H.10; quoted as U.S. dollars to one euro.',
    sourceLabel: 'FRED / DEXUSEU',
  },
  {
    id: 'usdjpy',
    name: 'USD/JPY',
    symbol: 'USD/JPY',
    provider: 'fred',
    seriesId: 'DEXJPUS',
    chartType: 'price',
    explanation:
      'Official daily USD/JPY proxy from FRED H.10; quoted as Japanese yen to one U.S. dollar.',
    sourceLabel: 'FRED / DEXJPUS',
  },
];

export const SECTOR_ASSETS = [
  {
    id: 'homebuilders',
    name: 'Homebuilders',
    symbol: 'XHB',
    provider: 'stooq',
    providerSymbol: 'xhb.us',
    chartType: 'price',
    explanation:
      'Daily XHB ETF history used as a homebuilders proxy.',
    sourceLabel: 'Stooq / XHB ETF proxy',
  },
  {
    id: 'transports',
    name: 'Transports',
    symbol: 'IYT',
    provider: 'stooq',
    providerSymbol: 'iyt.us',
    chartType: 'price',
    explanation:
      'Daily IYT ETF history used as a transports proxy.',
    sourceLabel: 'Stooq / IYT ETF proxy',
  },
  {
    id: 'retail',
    name: 'Retail',
    symbol: 'XRT',
    provider: 'stooq',
    providerSymbol: 'xrt.us',
    chartType: 'price',
    explanation:
      'Daily XRT ETF history used as a retail proxy.',
    sourceLabel: 'Stooq / XRT ETF proxy',
  },
  {
    id: 'semis',
    name: 'Semiconductors',
    symbol: 'SOXX',
    provider: 'stooq',
    providerSymbol: 'soxx.us',
    chartType: 'price',
    explanation:
      'Daily SOXX ETF history used as a semiconductors proxy.',
    sourceLabel: 'Stooq / SOXX ETF proxy',
  }, 
  {
    id: 'regionalBanks',
    name: 'Banks / Regional Bank Proxy',
    symbol: 'KRE',
    provider: 'stooq',
    providerSymbol: 'kre.us',
    chartType: 'price',
    explanation:
      'Daily KRE ETF history used as a regional banks proxy.',
    sourceLabel: 'Stooq / KRE ETF proxy',
  },
  {
    id: 'industrials',
    name: 'Industrials',
    symbol: 'XLI',
    provider: 'stooq',
    providerSymbol: 'xli.us',
    chartType: 'price',
    explanation:
      'Daily XLI ETF history used as an industrials proxy.',
    sourceLabel: 'Stooq / XLI ETF proxy',
  },
  {
    id: 'financials',
    name: 'Financials',
    symbol: 'XLF',
    provider: 'stooq',
    providerSymbol: 'xlf.us',
    chartType: 'price',
    explanation:
      'Daily XLF ETF history used as a financials proxy.',
    sourceLabel: 'Stooq / XLF ETF proxy',
  },
  {
    id: 'consumerStaples',
    name: 'Consumer Staples',
    symbol: 'XLP',
    provider: 'stooq',
    providerSymbol: 'xlp.us',
    chartType: 'price',
    explanation:
      'Daily XLP ETF history used as a consumer staples proxy.',
    sourceLabel: 'Stooq / XLP ETF proxy',
  },
  {
    id: 'utilities',
    name: 'Utilities',
    symbol: 'XLU',
    provider: 'stooq',
    providerSymbol: 'xlu.us',
    chartType: 'price',
    explanation:
      'Daily XLU ETF history used as a utilities proxy.',
    sourceLabel: 'Stooq / XLU ETF proxy',
  },
  {
    id: 'healthCare',
    name: 'Health Care',
    symbol: 'XLV',
    provider: 'stooq',
    providerSymbol: 'xlv.us',
    chartType: 'price',
    explanation:
      'Daily XLV ETF history used as a health care proxy.',
    sourceLabel: 'Stooq / XLV ETF proxy',
  },
  {
    id: 'emergingMarkets',
    name: 'Emerging Markets',
    symbol: 'EEM',
    provider: 'stooq',
    providerSymbol: 'eem.us',
    chartType: 'price',
    explanation:
      'Daily EEM ETF history used as an emerging markets proxy.',
    sourceLabel: 'Stooq / EEM ETF proxy',
  },
];

export const FRED_SERIES = {
  fedFunds: {
    id: 'DFF',
    label: 'Fed Funds Rate',
    unit: 'percent',
    sourceLabel: 'FRED / DFF',
    explanation: 'Effective federal funds rate.',
  },
  sofr: {
    id: 'SOFR',
    label: 'SOFR',
    unit: 'percent',
    sourceLabel: 'FRED / SOFR',
    explanation: 'Secured Overnight Financing Rate.',
  },
  prime: {
    id: 'DPRIME',
    label: 'Prime Rate',
    unit: 'percent',
    sourceLabel: 'FRED / DPRIME',
    explanation: 'Bank prime loan rate.',
  },
  fedBalanceSheet: {
    id: 'WALCL',
    label: 'Fed Total Assets',
    unit: 'billionsUsd',
    divisor: 1000,
    sourceLabel: 'FRED / WALCL',
    explanation: 'Total assets of Federal Reserve Banks, weekly.',
  },
  moneySupply: {
    id: 'M2SL',
    label: 'M2 Money Supply',
    unit: 'billionsUsd',
    divisor: 1000,
    sourceLabel: 'FRED / M2SL',
    explanation: 'M2 money stock, seasonally adjusted.',
  },
  nfci: {
    id: 'NFCI',
    label: 'Chicago Fed NFCI',
    unit: 'index',
    sourceLabel: 'FRED / NFCI',
    explanation: 'Positive values indicate tighter-than-average financial conditions.',
  },
  breakeven10y: {
    id: 'T10YIE',
    label: '10Y Breakeven',
    unit: 'percent',
    sourceLabel: 'FRED / T10YIE',
    explanation: '10-year breakeven inflation expectation.',
  },
  igSpread: {
    id: 'BAMLC0A0CM',
    label: 'IG OAS',
    unit: 'percent',
    sourceLabel: 'FRED / BAMLC0A0CM',
    explanation: 'ICE BofA US Corporate Master option-adjusted spread.',
  },
  hySpread: {
    id: 'BAMLH0A0HYM2',
    label: 'HY OAS',
    unit: 'percent',
    sourceLabel: 'FRED / BAMLH0A0HYM2',
    explanation: 'ICE BofA US High Yield option-adjusted spread.',
  },
  vix: {
    id: 'VIXCLS',
    label: 'VIX',
    unit: 'index',
    sourceLabel: 'FRED / VIXCLS',
    explanation: 'CBOE Volatility Index.',
  },
};

export const BLS_SERIES = {
  cpi: {
    id: 'CUUR0000SA0',
    label: 'CPI All Items',
    unit: 'index',
    sourceLabel: 'BLS / CUUR0000SA0',
    explanation: 'CPI-U all items, not seasonally adjusted.',
  },
  coreCpi: {
    id: 'CUUR0000SA0L1E',
    label: 'Core CPI',
    unit: 'index',
    sourceLabel: 'BLS / CUUR0000SA0L1E',
    explanation: 'CPI-U less food and energy, not seasonally adjusted.',
  },
  ppi: {
    id: 'WPUFD4',
    label: 'PPI Final Demand',
    unit: 'index',
    sourceLabel: 'BLS / WPUFD4',
    explanation: 'Producer Price Index for final demand.',
  },
  unemployment: {
    id: 'LNS14000000',
    label: 'Unemployment Rate',
    unit: 'percent',
    sourceLabel: 'BLS / LNS14000000',
    explanation: 'Civilian unemployment rate (U-3).',
  },
  payrolls: {
    id: 'CES0000000001',
    label: 'Nonfarm Payrolls',
    unit: 'thousands',
    sourceLabel: 'BLS / CES0000000001',
    explanation: 'All employees, total nonfarm payrolls.',
  },
  wages: {
    id: 'CES0500000003',
    label: 'Average Hourly Earnings',
    unit: 'usd',
    sourceLabel: 'BLS / CES0500000003',
    explanation: 'Average hourly earnings of all employees, total private.',
  },
};

export const CHART_EXPLANATIONS = {
  priceAction:
    'Tracks trend, momentum, and breakout behavior across major macro markets using the cleanest free source available for each asset. Some assets are exact indexes, while others are transparent proxies where no equivalent free institutional feed exists.',
  rates:
    'Treasury yield data come from official Treasury daily curve files. Spreads are derived from those official yields instead of mixing rate conventions.',
  liquidity:
    'Liquidity combines policy rates, funding rates, Fed balance sheet direction, M2 trend, and NFCI to show whether conditions are easing or tightening.',
  inflation:
    'Inflation combines BLS price and labor releases with market-implied breakevens and a commodity basket signal to distinguish cooling from reacceleration.',
  sectors:
    'Sector leadership now uses FRED-hosted Nasdaq sector index series instead of fragile ETF proxies, which makes relative-strength and breadth calculations much more stable.',
  breadth:
    'Breadth uses transparent free-data proxies because full institutional breadth tapes are not broadly free. This app shows percentage above moving averages, positive-return breadth, and cyclicals-vs-defensives rotation.',
  thesis:
    'Thesis validation checks whether your long and short book is aligned with trend, momentum, and current mark-to-market behavior. It is a process aid, not investment advice.',
};