import Papa from 'papaparse';
import { withCache } from './cache.js';
import { fetchText } from './http.js';

const TTL = 12 * 60 * 60 * 1000;

function normalizeRow(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const cleanKey = key.replace(/\uFEFF/g, '').trim();
    normalized[cleanKey] = value;
  });
  return normalized;
}

async function fetchTreasuryCsv(type, year) {
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=${type}&field_tdr_date_value=${year}&page&_format=csv`;
  return fetchText(url);
}

export async function fetchTreasuryCurve(type, options = {}) {
  const currentYear = new Date().getFullYear();
  const yearsBack = options.yearsBack || 5;
  const years = [];
  for (let year = currentYear - yearsBack; year <= currentYear; year += 1) years.push(year);
  const cacheKey = `treasury_${type}_${years.join('_')}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const allRows = [];
      for (const year of years) {
        const csv = await fetchTreasuryCsv(type, year);
        const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
        parsed.data.forEach((row) => allRows.push(normalizeRow(row)));
      }
      return allRows
        .map((row) => ({
          date: row.Date || row.DATE,
          oneMonth: Number(row['1 Mo']),
          twoMonth: Number(row['2 Mo']),
          threeMonth: Number(row['3 Mo']),
          fourMonth: Number(row['4 Mo']),
          sixMonth: Number(row['6 Mo']),
          oneYear: Number(row['1 Yr']),
          twoYear: Number(row['2 Yr']),
          threeYear: Number(row['3 Yr']),
          fiveYear: Number(row['5 Yr']),
          sevenYear: Number(row['7 Yr']),
          tenYear: Number(row['10 Yr']),
          twentyYear: Number(row['20 Yr']),
          thirtyYear: Number(row['30 Yr']),
        }))
        .filter((row) => row.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    options.force,
  );
}

export function pickTenorSeries(rows, key) {
  return rows
    .map((row) => ({ date: row.date, value: Number(row[key]) }))
    .filter((row) => Number.isFinite(row.value));
}
