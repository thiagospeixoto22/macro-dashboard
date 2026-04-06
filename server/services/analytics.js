export function sortSeries(series = []) {
  return [...series].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function cleanSeries(series = []) {
  return sortSeries(series).filter((point) => Number.isFinite(point.value));
}

export function lastValue(series = []) {
  return cleanSeries(series).at(-1) || null;
}

export function previousValue(series = []) {
  const clean = cleanSeries(series);
  return clean.length > 1 ? clean.at(-2) : null;
}

export function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function levelChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

function nearestPointByTargetDate(series, targetDate) {
  const clean = cleanSeries(series);
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    const pointDate = new Date(clean[i].date);
    if (pointDate <= targetDate) return clean[i];
  }
  return clean[0] || null;
}

export function pointDaysAgo(series, daysAgo) {
  const latest = lastValue(series);
  if (!latest) return null;
  const target = new Date(latest.date);
  target.setDate(target.getDate() - daysAgo);
  return nearestPointByTargetDate(series, target);
}

export function pointMonthsAgo(series, monthsAgo) {
  const latest = lastValue(series);
  if (!latest) return null;
  const target = new Date(latest.date);
  target.setMonth(target.getMonth() - monthsAgo);
  return nearestPointByTargetDate(series, target);
}

export function movingAverage(series, window) {
  const clean = cleanSeries(series);
  return clean.map((point, index) => {
    if (index + 1 < window) return { date: point.date, value: null };
    const slice = clean.slice(index + 1 - window, index + 1);
    const average = slice.reduce((sum, item) => sum + item.value, 0) / window;
    return { date: point.date, value: average };
  });
}

export function mergeByDate(...seriesList) {
  const map = new Map();
  seriesList.forEach((series, idx) => {
    cleanSeries(series).forEach((point) => {
      const existing = map.get(point.date) || { date: point.date };
      existing[`series${idx}`] = point.value;
      map.set(point.date, existing);
    });
  });
  return [...map.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function rollingCorrelation(seriesA, seriesB, window = 60) {
  const merged = mergeByDate(seriesA, seriesB)
    .filter((row) => Number.isFinite(row.series0) && Number.isFinite(row.series1))
    .map((row) => ({ date: row.date, a: row.series0, b: row.series1 }));

  if (merged.length < window) return null;
  const slice = merged.slice(-window);
  const avgA = slice.reduce((sum, p) => sum + p.a, 0) / slice.length;
  const avgB = slice.reduce((sum, p) => sum + p.b, 0) / slice.length;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  slice.forEach((p) => {
    numerator += (p.a - avgA) * (p.b - avgB);
    denomA += (p.a - avgA) ** 2;
    denomB += (p.b - avgB) ** 2;
  });
  if (!denomA || !denomB) return null;
  return numerator / Math.sqrt(denomA * denomB);
}

export function performanceWindows(series, style = 'price') {
  const latest = lastValue(series);
  const prev = previousValue(series);
  if (!latest) return {};

  const oneWeek = pointDaysAgo(series, 7);
  const oneMonth = pointDaysAgo(series, 31);
  const threeMonths = pointDaysAgo(series, 92);
  const oneYear = pointDaysAgo(series, 366);

  const diffFn = style === 'yield' ? levelChange : pctChange;
  return {
    daily: diffFn(latest.value, prev?.value),
    oneWeek: diffFn(latest.value, oneWeek?.value),
    oneMonth: diffFn(latest.value, oneMonth?.value),
    threeMonths: diffFn(latest.value, threeMonths?.value),
    oneYear: diffFn(latest.value, oneYear?.value),
  };
}

export function classifyTrend(series) {
  const clean = cleanSeries(series);
  if (clean.length < 210) return 'neutral';
  const latest = clean.at(-1).value;
  const ma50 = movingAverage(clean, 50).at(-1)?.value;
  const ma200 = movingAverage(clean, 200).at(-1)?.value;
  if (![latest, ma50, ma200].every(Number.isFinite)) return 'neutral';
  if (latest > ma50 && ma50 > ma200) return 'bullish';
  if (latest < ma50 && ma50 < ma200) return 'bearish';
  return 'neutral';
}

export function classifyMomentum(series, style = 'price') {
  const latest = lastValue(series);
  if (!latest) return 'neutral';
  const oneMonth = pointDaysAgo(series, 31);
  const threeMonths = pointDaysAgo(series, 92);
  const change1 = style === 'yield' ? levelChange(latest.value, oneMonth?.value) : pctChange(latest.value, oneMonth?.value);
  const change3 = style === 'yield' ? levelChange(latest.value, threeMonths?.value) : pctChange(latest.value, threeMonths?.value);
  if (![change1, change3].every(Number.isFinite)) return 'neutral';
  if (change1 > 0 && change3 > 0) return 'positive';
  if (change1 < 0 && change3 < 0) return 'negative';
  return 'mixed';
}

export function breakoutStatus(series) {
  const clean = cleanSeries(series);
  if (clean.length < 260) return 'range';
  const latest = clean.at(-1).value;
  const prior252 = clean.slice(-253, -1).map((point) => point.value);
  const high = Math.max(...prior252);
  const low = Math.min(...prior252);
  if (latest >= high) return 'breakout';
  if (latest <= low) return 'breakdown';
  return 'range';
}

export function buildChartRange(series, rangeKey) {
  const clean = cleanSeries(series);
  if (!clean.length) return [];
  const latestDate = new Date(clean.at(-1).date);
  let start;
  if (rangeKey === '1W') {
    start = new Date(latestDate);
    start.setDate(start.getDate() - 7);
  } else if (rangeKey === '1M') {
    start = new Date(latestDate);
    start.setMonth(start.getMonth() - 1);
  } else if (rangeKey === '3M') {
    start = new Date(latestDate);
    start.setMonth(start.getMonth() - 3);
  } else if (rangeKey === '6M') {
    start = new Date(latestDate);
    start.setMonth(start.getMonth() - 6);
  } else if (rangeKey === 'YTD') {
    start = new Date(latestDate.getFullYear(), 0, 1);
  } else if (rangeKey === '1Y') {
    start = new Date(latestDate);
    start.setFullYear(start.getFullYear() - 1);
  } else if (rangeKey === '5Y') {
    start = new Date(latestDate);
    start.setFullYear(start.getFullYear() - 5);
  } else {
    return clean;
  }
  return clean.filter((point) => new Date(point.date) >= start);
}

export function computeAssetCard(asset, series, style = 'price') {
  const latest = lastValue(series);
  const ma50Series = movingAverage(series, 50);
  const ma200Series = movingAverage(series, 200);
  return {
    ...asset,
    series: cleanSeries(series),
    latest,
    changes: performanceWindows(series, style),
    trend: classifyTrend(series),
    momentum: classifyMomentum(series, style),
    breakout: breakoutStatus(series),
    movingAverages: {
      ma50: lastValue(ma50Series),
      ma200: lastValue(ma200Series),
      ma50Series,
      ma200Series,
    },
    style,
  };
}

export function relativePerformance(series, benchmark, months) {
  const assetPoint = pointMonthsAgo(series, months);
  const benchmarkPoint = pointMonthsAgo(benchmark, months);
  const latestAsset = lastValue(series);
  const latestBenchmark = lastValue(benchmark);
  if (!assetPoint || !benchmarkPoint || !latestAsset || !latestBenchmark) return null;
  const assetPerf = pctChange(latestAsset.value, assetPoint.value);
  const benchmarkPerf = pctChange(latestBenchmark.value, benchmarkPoint.value);
  if (!Number.isFinite(assetPerf) || !Number.isFinite(benchmarkPerf)) return null;
  return assetPerf - benchmarkPerf;
}

export function leadershipScore(series, benchmark) {
  const rs1 = relativePerformance(series, benchmark, 1) ?? 0;
  const rs3 = relativePerformance(series, benchmark, 3) ?? 0;
  const rs6 = relativePerformance(series, benchmark, 6) ?? 0;
  const trend = classifyTrend(series);
  const momentum = classifyMomentum(series);
  let score = rs1 * 0.35 + rs3 * 0.4 + rs6 * 0.25;
  if (trend === 'bullish') score += 5;
  if (trend === 'bearish') score -= 5;
  if (momentum === 'positive') score += 3;
  if (momentum === 'negative') score -= 3;
  return score;
}

export function yoyFromLevelSeries(series) {
  const clean = cleanSeries(series);
  return clean.map((point, index) => {
    if (index < 12) return { date: point.date, value: null };
    const previous = clean[index - 12]?.value;
    return {
      date: point.date,
      value: pctChange(point.value, previous),
    };
  });
}

export function monthlyChange(series) {
  const clean = cleanSeries(series);
  return clean.map((point, index) => {
    if (index < 1) return { date: point.date, value: null };
    const previous = clean[index - 1]?.value;
    return { date: point.date, value: levelChange(point.value, previous) };
  });
}

export function percentAboveMovingAverage(assetCards, window = 50) {
  let count = 0;
  let total = 0;
  assetCards.forEach((card) => {
    const ma = movingAverage(card.series, window).at(-1)?.value;
    const latest = card.latest?.value;
    if (Number.isFinite(ma) && Number.isFinite(latest)) {
      total += 1;
      if (latest > ma) count += 1;
    }
  });
  return total ? (count / total) * 100 : null;
}

export function positiveReturnBreadth(assetCards, months = 1) {
  let count = 0;
  let total = 0;
  assetCards.forEach((card) => {
    const latest = card.latest?.value;
    const prior = pointMonthsAgo(card.series, months)?.value;
    const change = pctChange(latest, prior);
    if (Number.isFinite(change)) {
      total += 1;
      if (change > 0) count += 1;
    }
  });
  return total ? (count / total) * 100 : null;
}

export function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, val) => sum + val, 0) / valid.length : null;
}

export function summarizeLiquidity({ fedFunds, sofr, prime, fedBalanceSheet, moneySupply, nfci }) {
  const balance3m = performanceWindows(fedBalanceSheet, 'price').threeMonths;
  const m2yoy = yoyFromLevelSeries(moneySupply).at(-1)?.value;
  const nfciLatest = lastValue(nfci)?.value;
  let regime = 'mixed';
  if (Number.isFinite(balance3m) && Number.isFinite(m2yoy) && Number.isFinite(nfciLatest)) {
    if (balance3m > 0 && m2yoy > 0 && nfciLatest < 0) regime = 'improving';
    if (balance3m < 0 && m2yoy < 0 && nfciLatest > 0) regime = 'tightening';
  }
  return {
    regime,
    spreadFedToSofr: levelChange(lastValue(fedFunds)?.value, lastValue(sofr)?.value),
    spreadPrimeToFed: levelChange(lastValue(prime)?.value, lastValue(fedFunds)?.value),
  };
}

export function summarizeInflation({ cpiYoY, coreCpiYoY, ppiYoY, wageYoY, breakeven, commodityBasketSeries }) {
  const latestCpi = lastValue(cpiYoY)?.value;
  const latestCore = lastValue(coreCpiYoY)?.value;
  const latestPpi = lastValue(ppiYoY)?.value;
  const latestWage = lastValue(wageYoY)?.value;
  const latestBreakeven = lastValue(breakeven)?.value;
  const commodity3m = performanceWindows(commodityBasketSeries, 'price').threeMonths;
  let regime = 'mixed';
  if ([latestCpi, latestCore, latestPpi, latestWage, latestBreakeven].every(Number.isFinite)) {
    const hotSignals = [latestCpi > 3, latestCore > 3, latestPpi > 2.5, latestWage > 4, latestBreakeven > 2.4, commodity3m > 0]
      .filter(Boolean).length;
    if (hotSignals >= 4) regime = 'reaccelerating';
    else if (hotSignals <= 2) regime = 'cooling';
    else regime = 'sticky';
  }
  return regime;
}

export function sectorHeatmapRows(cards, benchmarkSeries) {
  return cards.map((card) => {
    const latest = lastValue(card.series);
    const sixMonthsAgo = pointMonthsAgo(card.series, 6);
    const sixMonths = latest && sixMonthsAgo ? pctChange(latest.value, sixMonthsAgo.value) : null;
    return {
      id: card.id,
      name: card.name,
      symbol: card.symbol,
      oneMonth: performanceWindows(card.series).oneMonth,
      threeMonths: performanceWindows(card.series).threeMonths,
      sixMonths,
      relative1M: relativePerformance(card.series, benchmarkSeries, 1),
      relative3M: relativePerformance(card.series, benchmarkSeries, 3),
      trend: classifyTrend(card.series),
      score: leadershipScore(card.series, benchmarkSeries),
      latestDate: card.latest?.date,
      explanation: card.explanation,
      sourceLabel: card.sourceLabel,
      series: card.series,
    };
  });
}

export function correlationMatrix(items, window = 60) {
  return items.map((rowItem) => ({
    id: rowItem.id,
    name: rowItem.name,
    values: items.map((colItem) => rollingCorrelation(rowItem.series, colItem.series, window)),
  }));
}

export function macroRegime({ priceCards, sectorCards, hySpreadSeries, vixSeries, dollarSeries }) {
  const above50 = percentAboveMovingAverage([...priceCards, ...sectorCards], 50);
  const hy3m = performanceWindows(hySpreadSeries, 'yield').threeMonths;
  const vixLatest = lastValue(vixSeries)?.value;
  const dollar3m = performanceWindows(dollarSeries).threeMonths;
  const bullishCount = priceCards.filter((card) => card.trend === 'bullish').length;

  if (
    Number.isFinite(above50) &&
    above50 > 65 &&
    bullishCount >= 5 &&
    Number.isFinite(hy3m) &&
    hy3m <= 0 &&
    Number.isFinite(vixLatest) &&
    vixLatest < 20
  ) {
    return 'Risk-On';
  }

  if (
    Number.isFinite(above50) &&
    above50 < 45 &&
    Number.isFinite(hy3m) &&
    hy3m > 0 &&
    Number.isFinite(vixLatest) &&
    vixLatest > 22 &&
    Number.isFinite(dollar3m) &&
    dollar3m > 0
  ) {
    return 'Risk-Off';
  }

  return 'Mixed';
}

export function makeCommodityBasket(goldSeries, copperSeries, crudeSeries) {
  const merged = mergeByDate(goldSeries, copperSeries, crudeSeries).filter(
    (row) => Number.isFinite(row.series0) && Number.isFinite(row.series1) && Number.isFinite(row.series2),
  );
  return merged.map((row) => ({
    date: row.date,
    value: average([row.series0, row.series1, row.series2]),
  }));
}
