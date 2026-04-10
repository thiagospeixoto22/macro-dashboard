import { withCache } from './cache.js';
import { fetchJson } from './http.js';

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const TTL = 60 * 60 * 1000;

function normalizeBlsRows(rows = []) {
  return rows
    .filter((row) => String(row.period).startsWith('M') && row.period !== 'M13')
    .map((row) => ({
      date: `${row.year}-${String(row.period).replace('M', '')}-01`,
      value: Number(row.value),
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export async function fetchBlsSeriesBatch(seriesIds, options = {}) {
  const ids = [...new Set(seriesIds)];
  const endYear = new Date().getFullYear();
  const startYear = endYear - (options.yearsBack || 12);
  const cacheKey = `bls_batch_${ids.slice().sort().join('_')}_${startYear}_${endYear}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const payload = {
        seriesid: ids,
        startyear: String(startYear),
        endyear: String(endYear),
        calculations: true,
      };

      if (process.env.BLS_API_KEY) {
        payload.registrationKey = process.env.BLS_API_KEY;
      }

      const json = await fetchJson(BLS_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const seriesList = json?.Results?.series || [];
      const out = Object.fromEntries(ids.map((id) => [id, []]));

      for (const series of seriesList) {
        out[series.seriesID] = normalizeBlsRows(series.data || []);
      }

      return out;
    },
    options.force,
  );
}

export async function fetchBlsSeries(seriesId, options = {}) {
  const result = await fetchBlsSeriesBatch([seriesId], options);
  return result[seriesId] || [];
}