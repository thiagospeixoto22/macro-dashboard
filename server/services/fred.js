import { withCache } from './cache.js';
import { fetchJson } from './http.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const TTL = 60 * 60 * 1000;

export async function fetchFredSeries(seriesId, options = {}) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    throw new Error('Missing FRED_API_KEY in .env');
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
  return withCache(cacheKey, TTL, async () => {
    const json = await fetchJson(`${FRED_BASE}?${params.toString()}`);
    return (json.observations || [])
      .map((item) => ({ date: item.date, value: Number(item.value) }))
      .filter((item) => Number.isFinite(item.value));
  }, options.force);
}
