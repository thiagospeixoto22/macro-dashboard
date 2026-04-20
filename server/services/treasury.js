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

function numberFrom(row, keys) {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
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
  const cacheKey = `treasury_v2_${type}_${years.join('_')}`;

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
          oneMonth: numberFrom(row, ['1 Mo', '1 MO']),
          twoMonth: numberFrom(row, ['2 Mo', '2 MO']),
          threeMonth: numberFrom(row, ['3 Mo', '3 MO']),
          fourMonth: numberFrom(row, ['4 Mo', '4 MO']),
          sixMonth: numberFrom(row, ['6 Mo', '6 MO']),
          oneYear: numberFrom(row, ['1 Yr', '1 YR']),
          twoYear: numberFrom(row, ['2 Yr', '2 YR']),
          threeYear: numberFrom(row, ['3 Yr', '3 YR']),
          fiveYear: numberFrom(row, ['5 Yr', '5 YR']),
          sevenYear: numberFrom(row, ['7 Yr', '7 YR']),
          tenYear: numberFrom(row, ['10 Yr', '10 YR']),
          twentyYear: numberFrom(row, ['20 Yr', '20 YR']),
          thirtyYear: numberFrom(row, ['30 Yr', '30 YR']),
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
