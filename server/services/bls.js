import { withCache } from './cache.js';
import { fetchJson } from './http.js';

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const TTL = 12 * 60 * 60 * 1000;

export async function fetchBlsSeries(seriesId, options = {}) {
  const endYear = new Date().getFullYear();
  const startYear = endYear - (options.yearsBack || 12);
  const cacheKey = `bls_${seriesId}_${startYear}_${endYear}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const payload = {
        seriesid: [seriesId],
        startyear: String(startYear),
        endyear: String(endYear),
      };
      if (process.env.BLS_API_KEY) payload.registrationKey = process.env.BLS_API_KEY;

      const json = await fetchJson(BLS_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const series = json?.Results?.series?.[0]?.data || [];
      return series
        .filter((row) => String(row.period).startsWith('M') && row.period !== 'M13')
        .map((row) => ({
          date: `${row.year}-${String(row.period).replace('M', '')}-01`,
          value: Number(row.value),
        }))
        .filter((row) => Number.isFinite(row.value))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    options.force,
  );
}
