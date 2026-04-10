import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BLS_SERIES, CHART_EXPLANATIONS, FRED_SERIES, MARKET_ASSETS, SECTOR_ASSETS } from './mappings.js';
import { fetchBlsSeriesBatch } from './services/bls.js';
import {
  average,
  cleanSeries,
  computeAssetCard,
  correlationMatrix,
  leadershipScore,
  macroRegime,
  makeCommodityBasket,
  monthlyChange,
  performanceWindows,
  percentAboveMovingAverage,
  positiveReturnBreadth,
  relativePerformance,
  rollingCorrelation,
  sectorHeatmapRows,
  summarizeInflation,
  summarizeLiquidity,
  yoyFromLevelSeries,
} from './services/analytics.js';
import { fetchFredSeries } from './services/fred.js';
import {
  fetchAlphaVantageCommodity,
  fetchAlphaVantageEquity,
  fetchAlphaVantageFx,
  fetchFmpHistory,
  fetchGenericTickerHistory,
  fetchStooqHistory,
} from './services/marketData.js';
import { fetchTreasuryCurve, pickTenorSeries } from './services/treasury.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '2mb' }));

function latest(series) {
  return cleanSeries(series).at(-1) || null;
}

function prior(series) {
  const clean = cleanSeries(series);
  return clean.length > 1 ? clean.at(-2) : null;
}

function createDerivedSeries(seriesA, seriesB, operator) {
  const mapB = new Map(cleanSeries(seriesB).map((point) => [point.date, point.value]));
  return cleanSeries(seriesA)
    .map((point) => ({ date: point.date, value: operator(point.value, mapB.get(point.date)) }))
    .filter((point) => Number.isFinite(point.value));
}

function getMarketPriceProvider() {
  return (process.env.MARKET_PRICE_PROVIDER || 'fmp').toLowerCase();
}

function marketProviderSourceLabel(asset, provider) {
  if (
    asset.provider === 'fred' ||
    asset.provider === 'alphaVantageFx' ||
    asset.provider === 'alphaVantageCommodity'
  ) {
    return asset.sourceLabel;
  }
  if (provider === 'fmp') return `FMP primary / Alpha Vantage fallback / ${asset.symbol} proxy`;
  if (provider === 'alphavantage') return `Alpha Vantage / ${asset.symbol} proxy`;
  return asset.sourceLabel;
}

async function resolveMarketAsset(asset, force, errors) {
  const marketPriceProvider = getMarketPriceProvider();

  try {
    if (asset.provider === 'fred') {
      return await fetchFredSeries(asset.seriesId, {
        observationStart: '2018-01-01',
        force,
      });
    }

    if (asset.provider === 'alphaVantageCommodity') {
      return await fetchAlphaVantageCommodity(asset, { force });
    }

    if (asset.provider === 'alphaVantageFx') {
      return await fetchAlphaVantageFx(asset.fromSymbol, asset.toSymbol, { force });
    }

    if (asset.provider === 'stooq') {
      if (marketPriceProvider === 'alphavantage') {
        return await fetchAlphaVantageEquity(asset.symbol, { force });
      }

      if (marketPriceProvider === 'fmp') {
        try {
          return await fetchFmpHistory(asset.symbol, { force });
        } catch (error) {
          const msg = String(error.message || error);
          if (msg.includes('402') || msg.includes('403') || msg.toLowerCase().includes('premium')) {
            return await fetchAlphaVantageEquity(asset.symbol, { force });
          }
          throw error;
        }
      }

      return await fetchStooqHistory(asset.providerSymbol, { force });
    }

    return [];
  } catch (error) {
    errors.push(`${asset.name}: ${error.message}`);
    return [];
  }
}

async function buildDashboard(force = false) {
  const errors = [];
  const marketPriceProvider = getMarketPriceProvider();

  const resolvedMarketAssets = MARKET_ASSETS.map((asset) => ({
    ...asset,
    sourceLabel: marketProviderSourceLabel(asset, marketPriceProvider),
  }));

  const resolvedSectorAssets = SECTOR_ASSETS.map((asset) => ({
    ...asset,
    sourceLabel: marketProviderSourceLabel(asset, marketPriceProvider),
  }));

  const marketHistories = await Promise.all(
    resolvedMarketAssets.map(async (asset) => [asset.id, await resolveMarketAsset(asset, force, errors)]),
  );

  const sectorHistories = await Promise.all(
    resolvedSectorAssets.map(async (asset) => [asset.id, await resolveMarketAsset(asset, force, errors)]),
  );

  const marketMap = Object.fromEntries(marketHistories);
  const sectorMap = Object.fromEntries(sectorHistories);

  const fredEntries = await Promise.all(
    Object.entries(FRED_SERIES).map(async ([key, meta]) => {
      try {
        let series = await fetchFredSeries(meta.id, { observationStart: '2018-01-01', force });
        // Apply divisor if defined (WALCL and M2SL are reported in millions by FRED, convert to billions)
        if (meta.divisor && meta.divisor !== 1) {
          series = series.map((point) => ({ ...point, value: point.value / meta.divisor }));
        }
        return [key, series];
      } catch (error) {
        errors.push(`${meta.label}: ${error.message}`);
        return [key, []];
      }
    }),
  );
  const fredMap = Object.fromEntries(fredEntries);

  const blsMap = {};
  try {
    const blsBatch = await fetchBlsSeriesBatch(
      Object.values(BLS_SERIES).map((meta) => meta.id),
      { yearsBack: 12, force },
    );

    for (const [key, meta] of Object.entries(BLS_SERIES)) {
      blsMap[key] = blsBatch[meta.id] || [];
    }
  } catch (error) {
    for (const [, meta] of Object.entries(BLS_SERIES)) {
      errors.push(`${meta.label}: ${error.message}`);
    }
  }

  let nominalCurveRows = [];
  let realCurveRows = [];
  try {
    nominalCurveRows = await fetchTreasuryCurve('daily_treasury_yield_curve', { yearsBack: 5, force });
  } catch (error) {
    errors.push(`Treasury nominal curve: ${error.message}`);
  }
  try {
    realCurveRows = await fetchTreasuryCurve('daily_treasury_real_yield_curve', { yearsBack: 5, force });
  } catch (error) {
    errors.push(`Treasury real curve: ${error.message}`);
  }

  const treasury3m = pickTenorSeries(nominalCurveRows, 'threeMonth');
  const treasury2y = pickTenorSeries(nominalCurveRows, 'twoYear');
  const treasury5y = pickTenorSeries(nominalCurveRows, 'fiveYear');
  const treasury10y = pickTenorSeries(nominalCurveRows, 'tenYear');
  const treasury30y = pickTenorSeries(nominalCurveRows, 'thirtyYear');
  const real5y = pickTenorSeries(realCurveRows, 'fiveYear');

  const spread2s10s = createDerivedSeries(treasury10y, treasury2y, (a, b) => a - b);
  const spread3m10y = createDerivedSeries(treasury10y, treasury3m, (a, b) => a - b);

  const priceActionCards = [];
  resolvedMarketAssets.forEach((asset) => {
    const series = marketMap[asset.id] || [];
    priceActionCards.push(computeAssetCard(asset, series));
  });

  priceActionCards.splice(4, 0, {
    ...computeAssetCard(
      {
        id: 'us10y',
        name: 'US 10Y Treasury Yield',
        symbol: 'UST 10Y',
        explanation: 'Official U.S. Treasury 10-year par yield from Treasury daily curve data.',
        sourceLabel: 'U.S. Treasury official daily curve',
      },
      treasury10y,
      'yield',
    ),
    chartType: 'yield',
  });

  const sectorCards = resolvedSectorAssets.map((asset) => computeAssetCard(asset, sectorMap[asset.id] || []));
  const benchmarkSeries = marketMap.sp500 || [];
  const leadingSectorRows = sectorHeatmapRows(
    sectorCards.filter((card) =>
      ['homebuilders', 'transports', 'retail', 'semis', 'regionalBanks'].includes(card.id),
    ),
    benchmarkSeries,
  );
  const sectorHeatmap = sectorHeatmapRows(sectorCards, benchmarkSeries);

  const commodityBasket = makeCommodityBasket(marketMap.gold || [], marketMap.copper || [], marketMap.crude || []);

  const cpiYoY = yoyFromLevelSeries(blsMap.cpi || []);
  const coreCpiYoY = yoyFromLevelSeries(blsMap.coreCpi || []);
  const ppiYoY = yoyFromLevelSeries(blsMap.ppi || []);
  const wageYoY = yoyFromLevelSeries(blsMap.wages || []);
  const payrollMonthlyChange = monthlyChange(blsMap.payrolls || []);

  const inflationRegime = summarizeInflation({
    cpiYoY,
    coreCpiYoY,
    ppiYoY,
    wageYoY,
    breakeven: fredMap.breakeven10y || [],
    commodityBasketSeries: commodityBasket,
  });

  const liquiditySummary = summarizeLiquidity({
    fedFunds: fredMap.fedFunds || [],
    sofr: fredMap.sofr || [],
    prime: fredMap.prime || [],
    fedBalanceSheet: fredMap.fedBalanceSheet || [],
    moneySupply: fredMap.moneySupply || [],
    nfci: fredMap.nfci || [],
  });

  const ratesMetrics = [
    {
      id: 'rate_2y',
      name: 'US 2Y Treasury',
      sourceLabel: 'U.S. Treasury official daily curve',
      series: treasury2y,
      latest: latest(treasury2y),
      changes: performanceWindows(treasury2y, 'yield'),
      trend: computeAssetCard({ name: 'US 2Y Treasury' }, treasury2y, 'yield').trend,
      explanation: 'Official 2-year Treasury par yield.',
      unit: 'percent',
    },
    {
      id: 'rate_10y',
      name: 'US 10Y Treasury',
      sourceLabel: 'U.S. Treasury official daily curve',
      series: treasury10y,
      latest: latest(treasury10y),
      changes: performanceWindows(treasury10y, 'yield'),
      trend: computeAssetCard({ name: 'US 10Y Treasury' }, treasury10y, 'yield').trend,
      explanation: 'Official 10-year Treasury par yield.',
      unit: 'percent',
    },
    {
      id: 'spread_2s10s',
      name: '2s10s Spread',
      sourceLabel: 'Derived from U.S. Treasury 2Y & 10Y',
      series: spread2s10s,
      latest: latest(spread2s10s),
      changes: performanceWindows(spread2s10s, 'yield'),
      trend: computeAssetCard({ name: '2s10s' }, spread2s10s, 'yield').trend,
      explanation: '10Y minus 2Y slope from official Treasury curve data.',
      unit: 'percent',
    },
    {
      id: 'spread_3m10y',
      name: '3m10y Spread',
      sourceLabel: 'Derived from U.S. Treasury 3M & 10Y',
      series: spread3m10y,
      latest: latest(spread3m10y),
      changes: performanceWindows(spread3m10y, 'yield'),
      trend: computeAssetCard({ name: '3m10y' }, spread3m10y, 'yield').trend,
      explanation: '10Y minus 3M slope from official Treasury curve data.',
      unit: 'percent',
    },
    {
      id: 'real_5y',
      name: '5Y Real Yield',
      sourceLabel: 'U.S. Treasury official real curve',
      series: real5y,
      latest: latest(real5y),
      changes: performanceWindows(real5y, 'yield'),
      trend: computeAssetCard({ name: '5Y Real Yield' }, real5y, 'yield').trend,
      explanation: 'Official 5-year Treasury real yield.',
      unit: 'percent',
    },
    {
      id: 'ig_oas',
      name: 'Investment Grade Spread',
      sourceLabel: FRED_SERIES.igSpread.sourceLabel,
      series: fredMap.igSpread || [],
      latest: latest(fredMap.igSpread || []),
      changes: performanceWindows(fredMap.igSpread || [], 'yield'),
      trend: computeAssetCard({ name: 'IG OAS' }, fredMap.igSpread || [], 'yield').trend,
      explanation: FRED_SERIES.igSpread.explanation,
      unit: 'percent',
    },
    {
      id: 'hy_oas',
      name: 'High Yield Spread',
      sourceLabel: FRED_SERIES.hySpread.sourceLabel,
      series: fredMap.hySpread || [],
      latest: latest(fredMap.hySpread || []),
      changes: performanceWindows(fredMap.hySpread || [], 'yield'),
      trend: computeAssetCard({ name: 'HY OAS' }, fredMap.hySpread || [], 'yield').trend,
      explanation: FRED_SERIES.hySpread.explanation,
      unit: 'percent',
    },
  ];

  const liquidityMetrics = [
    {
      id: 'fed_funds',
      name: 'Fed Funds',
      series: fredMap.fedFunds || [],
      sourceLabel: FRED_SERIES.fedFunds.sourceLabel,
      explanation: FRED_SERIES.fedFunds.explanation,
      unit: 'percent',
    },
    {
      id: 'sofr',
      name: 'SOFR',
      series: fredMap.sofr || [],
      sourceLabel: FRED_SERIES.sofr.sourceLabel,
      explanation: FRED_SERIES.sofr.explanation,
      unit: 'percent',
    },
    {
      id: 'prime',
      name: 'Prime Rate',
      series: fredMap.prime || [],
      sourceLabel: FRED_SERIES.prime.sourceLabel,
      explanation: FRED_SERIES.prime.explanation,
      unit: 'percent',
    },
    {
      id: 'walcl',
      name: 'Fed Balance Sheet',
      series: fredMap.fedBalanceSheet || [],
      sourceLabel: FRED_SERIES.fedBalanceSheet.sourceLabel,
      explanation: FRED_SERIES.fedBalanceSheet.explanation,
      unit: 'billionsUsd',
    },
    {
      id: 'm2',
      name: 'M2',
      series: fredMap.moneySupply || [],
      sourceLabel: FRED_SERIES.moneySupply.sourceLabel,
      explanation: FRED_SERIES.moneySupply.explanation,
      unit: 'billionsUsd',
    },
    {
      id: 'nfci',
      name: 'NFCI',
      series: fredMap.nfci || [],
      sourceLabel: FRED_SERIES.nfci.sourceLabel,
      explanation: FRED_SERIES.nfci.explanation,
      unit: 'index',
    },
  ].map((metric) => ({
    ...metric,
    latest: latest(metric.series),
    changes: performanceWindows(metric.series, metric.unit === 'percent' ? 'yield' : 'price'),
  }));

  const inflationMetrics = [
    {
      id: 'cpi_yoy',
      name: 'CPI YoY',
      series: cpiYoY,
      sourceLabel: BLS_SERIES.cpi.sourceLabel,
      explanation: 'YoY change computed from BLS CPI all-items index.',
      unit: 'percent',
    },
    {
      id: 'core_cpi_yoy',
      name: 'Core CPI YoY',
      series: coreCpiYoY,
      sourceLabel: BLS_SERIES.coreCpi.sourceLabel,
      explanation: 'YoY change computed from BLS core CPI index.',
      unit: 'percent',
    },
    {
      id: 'ppi_yoy',
      name: 'PPI YoY',
      series: ppiYoY,
      sourceLabel: BLS_SERIES.ppi.sourceLabel,
      explanation: 'YoY change computed from BLS PPI final demand index.',
      unit: 'percent',
    },
    {
      id: 'wage_yoy',
      name: 'Wage Growth Proxy',
      series: wageYoY,
      sourceLabel: BLS_SERIES.wages.sourceLabel,
      explanation: 'YoY change in average hourly earnings, total private.',
      unit: 'percent',
    },
    {
      id: 'breakeven_10y',
      name: '10Y Breakeven Inflation',
      series: fredMap.breakeven10y || [],
      sourceLabel: FRED_SERIES.breakeven10y.sourceLabel,
      explanation: FRED_SERIES.breakeven10y.explanation,
      unit: 'percent',
    },
    {
      id: 'commodity_basket',
      name: 'Commodity Basket Signal',
      series: commodityBasket,
      sourceLabel: 'Derived from GLD proxy, FRED copper, FRED WTI',
      explanation: 'Simple free-data basket averaging gold, copper, and crude proxies.',
      unit: 'index',
    },
  ].map((metric) => ({
    ...metric,
    latest: latest(metric.series),
    prior: prior(metric.series),
    changes: performanceWindows(metric.series, metric.unit === 'percent' ? 'yield' : 'price'),
  }));

  const cyclicalIds = ['homebuilders', 'transports', 'retail', 'semis', 'regionalBanks', 'industrials', 'financials'];
  const defensiveIds = ['consumerStaples', 'utilities', 'healthCare'];

  const cyclical3m = average(
    sectorCards
      .filter((card) => cyclicalIds.includes(card.id))
      .map((card) => performanceWindows(card.series).threeMonths),
  );

  const defensive3m = average(
    sectorCards
      .filter((card) => defensiveIds.includes(card.id))
      .map((card) => performanceWindows(card.series).threeMonths),
  );

  const cyclicalLeadershipSpread =
    Number.isFinite(cyclical3m) && Number.isFinite(defensive3m) ? cyclical3m - defensive3m : null;

  const breadth = {
    percentAbove50: percentAboveMovingAverage([...priceActionCards.filter((card) => card.id !== 'us10y'), ...sectorCards], 50),
    percentAbove200: percentAboveMovingAverage([...priceActionCards.filter((card) => card.id !== 'us10y'), ...sectorCards], 200),
    positive1M: positiveReturnBreadth([...priceActionCards.filter((card) => card.id !== 'us10y'), ...sectorCards], 1),
    cyclicalVsDefensive3M: cyclicalLeadershipSpread,
    vixLatest: latest(fredMap.vix || []),
    nfciLatest: latest(fredMap.nfci || []),
    sectorHeatmap,
    correlationMatrix: correlationMatrix(
      [
        priceActionCards.find((card) => card.id === 'sp500'),
        priceActionCards.find((card) => card.id === 'nasdaq100'),
        priceActionCards.find((card) => card.id === 'russell2000'),
        priceActionCards.find((card) => card.id === 'gold'),
        priceActionCards.find((card) => card.id === 'crude'),
        priceActionCards.find((card) => card.id === 'dollar'),
        sectorCards.find((card) => card.id === 'emergingMarkets'),
      ].filter(Boolean),
      60,
    ),
  };

  const crossAssetSignals = [
    {
      id: 'oil_vs_breakeven',
      title: 'Oil vs Inflation Expectations',
      expected: 'Positive / confirming',
      correlation60d: rollingCorrelation(marketMap.crude || [], fredMap.breakeven10y || [], 60),
      returnGap3m:
        (performanceWindows(marketMap.crude || []).threeMonths ?? 0) -
        (performanceWindows(fredMap.breakeven10y || [], 'yield').threeMonths ?? 0),
      explanation: 'Checks whether energy and market inflation expectations are moving together.',
    },
    {
      id: 'copper_vs_industrials',
      title: 'Copper vs Industrial Leadership',
      expected: 'Positive / confirming',
      correlation60d: rollingCorrelation(marketMap.copper || [], sectorMap.industrials || [], 60),
      returnGap3m:
        (performanceWindows(marketMap.copper || []).threeMonths ?? 0) -
        (performanceWindows(sectorMap.industrials || []).threeMonths ?? 0),
      explanation: 'Checks whether industrial metals and industrial equities are aligned.',
    },
    {
      id: 'dollar_vs_commodities',
      title: 'Dollar vs Commodities',
      expected: 'Inverse / confirming',
      correlation60d: rollingCorrelation(marketMap.dollar || [], commodityBasket, 60),
      returnGap3m:
        (performanceWindows(marketMap.dollar || []).threeMonths ?? 0) +
        (performanceWindows(commodityBasket).threeMonths ?? 0),
      explanation: 'A stronger dollar often pressures commodities; persistent upside together is a divergence.',
    },
    {
      id: 'real_rates_vs_gold',
      title: 'Real Rates vs Gold',
      expected: 'Inverse / confirming',
      correlation60d: rollingCorrelation(real5y, marketMap.gold || [], 60),
      returnGap3m:
        (performanceWindows(real5y, 'yield').threeMonths ?? 0) +
        (performanceWindows(marketMap.gold || []).threeMonths ?? 0),
      explanation: 'Checks whether gold is respecting real-rate pressure/support.',
    },
    {
      id: 'em_vs_dollar',
      title: 'EM vs Dollar',
      expected: 'Inverse / confirming',
      correlation60d: rollingCorrelation(sectorMap.emergingMarkets || [], marketMap.dollar || [], 60),
      returnGap3m:
        (performanceWindows(sectorMap.emergingMarkets || []).threeMonths ?? 0) +
        (performanceWindows(marketMap.dollar || []).threeMonths ?? 0),
      explanation: 'Checks whether emerging markets are confirming or resisting dollar direction.',
    },
    {
      id: 'bonds_vs_equities',
      title: 'Rates vs Equities',
      expected: 'Context-dependent',
      correlation60d: rollingCorrelation(treasury10y, marketMap.sp500 || [], 60),
      returnGap3m:
        (performanceWindows(treasury10y, 'yield').threeMonths ?? 0) -
        (performanceWindows(marketMap.sp500 || []).threeMonths ?? 0),
      explanation: 'Rising yields with rising equities can indicate growth/risk-on; falling yields with falling equities can indicate risk-off.',
    },
  ].map((item) => {
    let verdict = 'Mixed';

    if (!Number.isFinite(item.correlation60d)) verdict = 'Insufficient data';
    else if (item.expected.startsWith('Positive') && item.correlation60d > 0.2) verdict = 'Confirming';
    else if (item.expected.startsWith('Inverse') && item.correlation60d < -0.2) verdict = 'Confirming';
    else if (item.expected === 'Context-dependent') verdict = Math.abs(item.correlation60d) > 0.2 ? 'Explained by price action' : 'Mixed';
    else verdict = 'Contradicting';

    return { ...item, verdict };
  });

  const allChartables = [
    ...priceActionCards.map((card) => ({
      id: card.id,
      name: card.name,
      series: card.series,
      unit: card.id === 'us10y' ? 'percent' : 'price',
      sourceLabel: card.sourceLabel,
      explanation: card.explanation,
    })),
    ...ratesMetrics.map((metric) => ({
      id: metric.id,
      name: metric.name,
      series: metric.series,
      unit: metric.unit,
      sourceLabel: metric.sourceLabel,
      explanation: metric.explanation,
    })),
    ...liquidityMetrics.map((metric) => ({
      id: metric.id,
      name: metric.name,
      series: metric.series,
      unit: metric.unit,
      sourceLabel: metric.sourceLabel,
      explanation: metric.explanation,
    })),
    ...inflationMetrics.map((metric) => ({
      id: metric.id,
      name: metric.name,
      series: metric.series,
      unit: metric.unit,
      sourceLabel: metric.sourceLabel,
      explanation: metric.explanation,
    })),
    ...sectorHeatmap.map((row) => ({
      id: row.id,
      name: row.name,
      series: row.series,
      unit: 'price',
      sourceLabel: row.sourceLabel,
      explanation: row.explanation,
    })),
    {
      id: 'unemployment_rate',
      name: 'Unemployment Rate',
      series: blsMap.unemployment || [],
      unit: 'percent',
      sourceLabel: BLS_SERIES.unemployment.sourceLabel,
      explanation: BLS_SERIES.unemployment.explanation,
    },
    {
      id: 'payroll_change',
      name: 'Payrolls Monthly Change',
      series: payrollMonthlyChange,
      unit: 'thousands',
      sourceLabel: BLS_SERIES.payrolls.sourceLabel,
      explanation: 'Monthly change in nonfarm payrolls derived from BLS payroll levels.',
    },
  ];

  const chartables = Object.fromEntries(allChartables.map((item) => [item.id, item]));

  const regime = macroRegime({
    priceCards: priceActionCards.filter((card) => card.id !== 'us10y'),
    sectorCards,
    hySpreadSeries: fredMap.hySpread || [],
    vixSeries: fredMap.vix || [],
    dollarSeries: marketMap.dollar || [],
  });

  const summaryText =
    regime === 'Risk-On'
      ? 'Broad risk assets are behaving constructively, credit is not visibly deteriorating, and volatility remains contained.'
      : regime === 'Risk-Off'
        ? 'Breadth and volatility are arguing for caution, with defensive and funding signals leaning tighter.'
        : 'Signals are mixed: some price action confirms the macro tape, but enough divergences remain to avoid a one-line conclusion.';

  const latestCurveRow = nominalCurveRows.at(-1) || null;

  const yieldCurve = latestCurveRow
    ? [
        ['3M', latestCurveRow.threeMonth],
        ['6M', latestCurveRow.sixMonth],
        ['1Y', latestCurveRow.oneYear],
        ['2Y', latestCurveRow.twoYear],
        ['5Y', latestCurveRow.fiveYear],
        ['10Y', latestCurveRow.tenYear],
        ['30Y', latestCurveRow.thirtyYear],
      ]
        .filter(([, value]) => Number.isFinite(value))
        .map(([tenor, value]) => ({ tenor, value }))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      regime,
      text: summaryText,
      liquidityRegime: liquiditySummary.regime,
      inflationRegime,
    },
    sourceNotes: {
      marketPriceProvider:
        marketPriceProvider === 'fmp'
          ? 'Broad ETF/sector market prices use FMP daily history first, with Alpha Vantage fallback when a free-plan FMP entitlement is unavailable. FX pairs still use Alpha Vantage directly.'
          : marketPriceProvider === 'alphavantage'
            ? 'Broad ETF/sector market prices are using Alpha Vantage daily history. FX pairs also use Alpha Vantage directly.'
            : 'Broad ETF/sector market prices default to Stooq daily history because the Alpha Vantage free tier is too restrictive for a 15+ symbol dashboard. FX pairs still use Alpha Vantage directly.',
      breadthProxy:
        'Breadth/positioning uses transparent free-data proxies: percentage above moving averages, positive-return breadth, sector rotation, VIX, and NFCI.',
    },
    explanations: CHART_EXPLANATIONS,
    errors,
    sections: {
      priceAction: priceActionCards,
      rates: {
        metrics: ratesMetrics,
        yieldCurve,
        lastCurveDate: latestCurveRow?.date || null,
        curveSignal:
          (latest(spread2s10s)?.value ?? 0) > 0
            ? 'Steepening / normal curve'
            : 'Flattened or inverted curve',
      },
      liquidity: {
        metrics: liquidityMetrics,
        summary: liquiditySummary,
      },
      inflation: {
        metrics: inflationMetrics,
        regime: inflationRegime,
      },
      labor: {
        unemployment: {
          latest: latest(blsMap.unemployment || []),
          sourceLabel: BLS_SERIES.unemployment.sourceLabel,
          series: blsMap.unemployment || [],
        },
        payrolls: {
          latest: latest(payrollMonthlyChange),
          sourceLabel: BLS_SERIES.payrolls.sourceLabel,
          series: payrollMonthlyChange,
        },
      },
      sectors: {
        leaders: leadingSectorRows.map((row) => ({
          ...row,
          trend: computeAssetCard({ name: row.name }, row.series).trend,
          relativeStrength: relativePerformance(row.series, benchmarkSeries, 3),
          leadershipScore: leadershipScore(row.series, benchmarkSeries),
        })),
      },
      crossAsset: crossAssetSignals,
      breadth,
      chartables,
    },
  };
}

app.get('/api/dashboard', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const dashboard = await buildDashboard(force);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to build dashboard' });
  }
});

app.get('/api/quote/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const force = req.query.force === '1';

    const historyResult = await fetchGenericTickerHistory(ticker, { force });
    const series = cleanSeries(historyResult.series || []);
    const latestPoint = series.at(-1) || null;
    const previousPoint = series.length > 1 ? series.at(-2) : null;

    if (!latestPoint) {
      return res.status(404).json({ error: `No market data returned for ${ticker}` });
    }

    res.json({
      ticker,
      provider: historyResult.provider || 'Unknown',
      latest: latestPoint,
      previous: previousPoint,
      series,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to resolve ticker' });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Macro dashboard server running on http://localhost:${port}`);
});