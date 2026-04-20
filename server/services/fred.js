import Papa from 'papaparse';
import { withCache } from './cache.js';
import { fetchJson, fetchText } from './http.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_CSV_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const TTL = 60 * 60 * 1000;

function parseFredCsv(csv, seriesId, observationStart) {
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const valueKey = parsed.meta.fields?.find((field) => field.trim().toUpperCase() === seriesId.toUpperCase());
  const startTime = observationStart ? new Date(observationStart).getTime() : Number.NEGATIVE_INFINITY;

  if (!valueKey) {
    throw new Error(`FRED CSV did not include ${seriesId}`);
  }

  return (parsed.data || [])
    .map((row) => ({
      date: row.observation_date,
      value: Number(row[valueKey]),
    }))
    .filter((item) => {
      if (!item.date || !Number.isFinite(item.value)) return false;
      return new Date(item.date).getTime() >= startTime;
    });
}

async function fetchFredCsvSeries(seriesId, options = {}) {
  if (options.units || options.frequency) {
    throw new Error(`FRED_API_KEY is required for transformed FRED series ${seriesId}`);
  }

  const observationStart = options.observationStart || '2018-01-01';
  const params = new URLSearchParams({
    id: seriesId,
    cosd: observationStart,
  });
  const cacheKey = `fred_csv_${seriesId}_${observationStart}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const csv = await fetchText(`${FRED_CSV_BASE}?${params.toString()}`);
      return parseFredCsv(csv, seriesId, observationStart);
    },
    options.force,
  );
}

export async function fetchFredSeries(seriesId, options = {}) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return fetchFredCsvSeries(seriesId, options);
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    file_type: 'json',
    series_id: seriesId,
    observation_start: options.observationStart || '2018-01-01',
  });

  if (options.units) params.set('units', options.units);
  if (options.frequency) params.set('frequency', options.frequency);

  const cacheKey = `fred_${seriesId}_${options.observationStart || '2018-01-01'}_${options.units || 'raw'}_${options.frequency || 'default'}`;
  try {
    return await withCache(cacheKey, TTL, async () => {
      const json = await fetchJson(`${FRED_BASE}?${params.toString()}`);
      return (json.observations || [])
        .map((item) => ({ date: item.date, value: Number(item.value) }))
        .filter((item) => Number.isFinite(item.value));
    }, options.force);
  } catch (error) {
    return fetchFredCsvSeries(seriesId, options);
  }
}
