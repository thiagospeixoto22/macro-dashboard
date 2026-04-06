import Papa from 'papaparse';
import { withCache } from './cache.js';
import { fetchJson, fetchText } from './http.js';

const TTL = 24 * 60 * 60 * 1000;

function parseStooqCsv(csv) {
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return (parsed.data || [])
    .map((row) => ({ date: row.Date, value: Number(row.Close) }))
    .filter((row) => row.date && Number.isFinite(row.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export async function fetchStooqHistory(providerSymbol, options = {}) {
  const cacheKey = `stooq_${providerSymbol}`;
  return withCache(
    cacheKey,
    TTL,
    async () => {
      const csv = await fetchText(`https://stooq.com/q/d/l/?s=${providerSymbol}&i=d`);
      return parseStooqCsv(csv);
    },
    options.force,
  );
}

export async function fetchFmpHistory(symbol, options = {}) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error('Missing FMP_API_KEY in .env');
  }

  const upper = symbol.trim().toUpperCase();
  const cacheKey = `fmp_history_${upper}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const url =
        `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(
          upper,
        )}&apikey=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url);
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`FMP HTTP ${response.status}: ${text.slice(0, 220)}`);
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`FMP returned non-JSON: ${text.slice(0, 220)}`);
      }

      if (json?.['Error Message']) throw new Error(`FMP error: ${json['Error Message']}`);
      if (json?.Error) throw new Error(`FMP error: ${json.Error}`);
      if (json?.message) throw new Error(`FMP error: ${json.message}`);

      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.historical)
          ? json.historical
          : Array.isArray(json?.data)
            ? json.data
            : [];

      return rows
        .map((row) => ({
          date: row.date,
          value: Number(row.adjClose ?? row.close ?? row.price),
        }))
        .filter((row) => row.date && Number.isFinite(row.value))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    options.force,
  );
}

export async function fetchAlphaVantageCommodity(config, options = {}) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ALPHA_VANTAGE_API_KEY in .env');
  }

  const cacheKey = `av_commodity_${config.avFunction}_${config.avSymbol || 'none'}_${config.interval || 'default'}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const params = new URLSearchParams({
        function: config.avFunction,
        apikey: apiKey,
      });

      if (config.avSymbol) params.set('symbol', config.avSymbol);
      if (config.interval) params.set('interval', config.interval);

      const json = await fetchJson(`https://www.alphavantage.co/query?${params.toString()}`);

      if (json.Note) throw new Error(`Alpha Vantage rate limit: ${json.Note}`);
      if (json.Information) throw new Error(`Alpha Vantage info: ${json.Information}`);
      if (json['Error Message']) throw new Error(`Alpha Vantage error: ${json['Error Message']}`);

      const rows = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.values)
          ? json.values
          : Array.isArray(json?.historical)
            ? json.historical
            : [];

      if (rows.length) {
        return rows
          .map((row) => ({
            date: row.date,
            value: Number(row.value ?? row.close ?? row.price),
          }))
          .filter((row) => row.date && Number.isFinite(row.value))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      const seriesKey = Object.keys(json).find((key) =>
        key.toLowerCase().includes('time series'),
      );
      const data = json?.[seriesKey] || {};

      return Object.entries(data)
        .map(([date, values]) => ({
          date,
          value: Number(values.value ?? values['4. close'] ?? values.close),
        }))
        .filter((row) => row.date && Number.isFinite(row.value))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    options.force,
  );
}

export async function fetchAlphaVantageQuote(symbol, options = {}) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ALPHA_VANTAGE_API_KEY in .env');
  }

  const upper = symbol.trim().toUpperCase();
  const cacheKey = `av_quote_${upper}`;

  return withCache(
    cacheKey,
    15 * 60 * 1000,
    async () => {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
        upper,
      )}&apikey=${apiKey}`;

      const json = await fetchJson(url);

      if (json.Note) throw new Error(`Alpha Vantage rate limit: ${json.Note}`);
      if (json.Information) throw new Error(`Alpha Vantage info: ${json.Information}`);
      if (json['Error Message']) throw new Error(`Alpha Vantage error: ${json['Error Message']}`);

      const q = json['Global Quote'] || {};
      const price = Number(q['05. price']);
      const previousClose = Number(q['08. previous close']);
      const date = q['07. latest trading day'];

      if (!Number.isFinite(price)) {
        throw new Error(`No quote data returned for ${upper}`);
      }

      return {
        symbol: upper,
        date,
        price,
        previousClose: Number.isFinite(previousClose) ? previousClose : null,
      };
    },
    options.force,
  );
}

export async function fetchAlphaVantageFx(fromSymbol, toSymbol, options = {}) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ALPHA_VANTAGE_API_KEY in .env');
  }

  const cacheKey = `avfx_${fromSymbol}_${toSymbol}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${fromSymbol}&to_symbol=${toSymbol}&outputsize=full&apikey=${apiKey}`;
      const json = await fetchJson(url);

      if (json.Note) throw new Error(`Alpha Vantage rate limit: ${json.Note}`);

      const seriesKey = Object.keys(json).find((key) =>
        key.toLowerCase().includes('time series fx'),
      );
      const data = json?.[seriesKey] || {};

      return Object.entries(data)
        .map(([date, values]) => ({
          date,
          value: Number(values['4. close']),
        }))
        .filter((row) => Number.isFinite(row.value))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    options.force,
  );
}

export async function fetchAlphaVantageEquity(symbol, options = {}) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ALPHA_VANTAGE_API_KEY in .env');
  }

  const cacheKey = `av_equity_direct_${symbol.toUpperCase()}`;

  return withCache(
    cacheKey,
    TTL,
    async () => {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(
        symbol,
      )}&outputsize=full&apikey=${apiKey}`;

      const json = await fetchJson(url);

      if (json.Note) throw new Error(`Alpha Vantage rate limit: ${json.Note}`);

      const key = Object.keys(json).find((item) =>
        item.toLowerCase().includes('time series'),
      );
      const data = json?.[key] || {};

      return Object.entries(data)
        .map(([date, values]) => ({
          date,
          value: Number(values['5. adjusted close'] || values['4. close']),
        }))
        .filter((row) => Number.isFinite(row.value))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    options.force,
  );
}

export async function fetchGenericTickerHistory(symbol, options = {}) {
  const marketPriceProvider = (process.env.MARKET_PRICE_PROVIDER || 'stooq').toLowerCase();

  if (marketPriceProvider === 'fmp') {
    try {
      const series = await fetchFmpHistory(symbol, options);
      return {
        provider: 'Financial Modeling Prep',
        providerSymbol: symbol.toUpperCase(),
        series,
      };
    } catch (error) {
      const msg = String(error.message || error);
      if (msg.includes('402') || msg.includes('403') || msg.toLowerCase().includes('premium')) {
        const series = await fetchAlphaVantageEquity(symbol, options);
        return {
          provider: 'Alpha Vantage',
          providerSymbol: symbol.toUpperCase(),
          series,
        };
      }
      throw error;
    }
  }

  if (marketPriceProvider === 'alphavantage') {
    const series = await fetchAlphaVantageEquity(symbol, options);
    return {
      provider: 'Alpha Vantage',
      providerSymbol: symbol.toUpperCase(),
      series,
    };
  }

  const normalized = symbol.trim().toLowerCase();
  const candidates = normalized.includes('.') ? [normalized] : [`${normalized}.us`, normalized];

  for (const candidate of candidates) {
    try {
      const series = await fetchStooqHistory(candidate, options);
      if (series.length) {
        return {
          provider: 'Stooq',
          providerSymbol: candidate,
          series,
        };
      }
    } catch {
      // try next candidate
    }
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return {
      provider: 'Unknown',
      providerSymbol: symbol,
      series: [],
    };
  }

  const series = await fetchAlphaVantageEquity(symbol, options);
  return {
    provider: 'Alpha Vantage',
    providerSymbol: symbol.toUpperCase(),
    series,
  };
}