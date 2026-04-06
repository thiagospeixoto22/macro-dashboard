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
      'Free daily small-cap proxy using the Nasdaq US Small Cap Index. Not the exact Russell 2000, but a cleaner and more reliable small-cap proxy than broken ETF feeds.',
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
      'Free developed-markets proxy using the Nasdaq Developed Markets Net Total Return Index. This is not the exact MSCI EAFE series, but it is a stable daily developed-markets proxy.',
    sourceLabel: 'FRED / NASDAQNQDMN',
  },
  {
    id: 'gold',
    name: 'Gold',
    symbol: 'GOLD',
    provider: 'alphaVantageCommodity',
    avFunction: 'GOLD_SILVER_HISTORY',
    avSymbol: 'GOLD',
    interval: 'daily',
    chartType: 'price',
    explanation:
      'Daily gold history from Alpha Vantage commodities API.',
    sourceLabel: 'Alpha Vantage Commodities / GOLD_SILVER_HISTORY',
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
    provider: 'alphaVantageCommodity',
    avFunction: 'WTI',
    interval: 'daily',
    chartType: 'price',
    explanation:
      'Daily WTI crude oil history from Alpha Vantage commodities API.',
    sourceLabel: 'Alpha Vantage Commodities / WTI',
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
    provider: 'alphaVantageFx',
    fromSymbol: 'EUR',
    toSymbol: 'USD',
    chartType: 'price',
    explanation:
      'Direct EUR/USD daily FX history from Alpha Vantage.',
    sourceLabel: 'Alpha Vantage FX',
  },
  {
    id: 'usdjpy',
    name: 'USD/JPY',
    symbol: 'USD/JPY',
    provider: 'alphaVantageFx',
    fromSymbol: 'USD',
    toSymbol: 'JPY',
    chartType: 'price',
    explanation:
      'Direct USD/JPY daily FX history from Alpha Vantage.',
    sourceLabel: 'Alpha Vantage FX',
  },
];

export const SECTOR_ASSETS = [
  {
    id: 'homebuilders',
    name: 'Homebuilders',
    symbol: 'NQUSB40202010',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB40202010',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Home Construction Index.',
    sourceLabel: 'FRED / NASDAQNQUSB40202010',
  },
  {
    id: 'transports',
    name: 'Transports',
    symbol: 'NQUSB50206060',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB50206060',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Transportation Services Index.',
    sourceLabel: 'FRED / NASDAQNQUSB50206060',
  },
  {
    id: 'retail',
    name: 'Retail',
    symbol: 'NQUSB4040',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB4040',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Retail Index.',
    sourceLabel: 'FRED / NASDAQNQUSB4040',
  },
  {
    id: 'semis',
    name: 'Semiconductors',
    symbol: 'XSOX',
    provider: 'fred',
    seriesId: 'NASDAQXSOX',
    chartType: 'price',
    explanation:
      'PHLX Semiconductor Sector Total Return index.',
    sourceLabel: 'FRED / NASDAQXSOX',
  },
  {
    id: 'regionalBanks',
    name: 'Banks / Regional Bank Proxy',
    symbol: 'NQUSB3010',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB3010',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Banks Index used as a transparent free bank-sector proxy. Not a pure regional-bank index, but much more reliable than broken ETF feeds.',
    sourceLabel: 'FRED / NASDAQNQUSB3010',
  },
  {
    id: 'industrials',
    name: 'Industrials',
    symbol: 'NQUSB50',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB50',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Industrials Index.',
    sourceLabel: 'FRED / NASDAQNQUSB50',
  },
  {
    id: 'financials',
    name: 'Financials',
    symbol: 'NQUSB30',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB30',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Financials Index.',
    sourceLabel: 'FRED / NASDAQNQUSB30',
  },
  {
    id: 'consumerStaples',
    name: 'Consumer Staples',
    symbol: 'NQUSB45',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB45',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Consumer Staples Index.',
    sourceLabel: 'FRED / NASDAQNQUSB45',
  },
  {
    id: 'utilities',
    name: 'Utilities',
    symbol: 'NQUSB65T',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB65T',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Utilities Total Return Index.',
    sourceLabel: 'FRED / NASDAQNQUSB65T',
  },
  {
    id: 'healthCare',
    name: 'Health Care',
    symbol: 'NQUSB20',
    provider: 'fred',
    seriesId: 'NASDAQNQUSB20',
    chartType: 'price',
    explanation:
      'Nasdaq US Benchmark Health Care Index.',
    sourceLabel: 'FRED / NASDAQNQUSB20',
  },
  {
    id: 'emergingMarkets',
    name: 'Emerging Markets',
    symbol: 'NQEMT',
    provider: 'fred',
    seriesId: 'NASDAQNQEMT',
    chartType: 'price',
    explanation:
      'Nasdaq Emerging Markets Total Return Index.',
    sourceLabel: 'FRED / NASDAQNQEMT',
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