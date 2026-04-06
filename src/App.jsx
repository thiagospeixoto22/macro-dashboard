import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const POSITIONS_KEY = 'macro-dashboard-positions-v1';
const NOTES_KEY = 'macro-dashboard-notes-v1';
const RANGES = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'];

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
}

function formatCompactNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  return Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(value);
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'percent') return `${formatNumber(value, 2)}%`;
  if (unit === 'billionsUsd') return `$${formatCompactNumber(value, 1)}B`;
  if (unit === 'usd') return `$${formatNumber(value, 2)}`;
  if (unit === 'thousands') return `${formatNumber(value, 0)}k`;
  if (unit === 'index') return formatNumber(value, 2);
  if (unit === 'price') return `${formatNumber(value, 2)}`;
  return formatNumber(value, 2);
}

function formatChange(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'percent' && Math.abs(value) < 100) return `${value >= 0 ? '+' : ''}${formatNumber(value * 100, 0)} bp`;
  return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
}

function statusClass(status) {
  if (!status) return 'neutral';
  const lower = String(status).toLowerCase();
  if (['bullish', 'positive', 'improving', 'confirming', 'risk-on', 'cooling'].some((x) => lower.includes(x))) return 'positive';
  if (['bearish', 'negative', 'tightening', 'contradicting', 'risk-off', 'reaccelerating'].some((x) => lower.includes(x))) return 'negative';
  return 'neutral';
}

function applyRange(series = [], rangeKey = '1Y') {
  if (!series.length || rangeKey === 'MAX') return series;
  const lastDate = new Date(series.at(-1).date);
  const start = new Date(lastDate);
  if (rangeKey === '1W') start.setDate(start.getDate() - 7);
  if (rangeKey === '1M') start.setMonth(start.getMonth() - 1);
  if (rangeKey === '3M') start.setMonth(start.getMonth() - 3);
  if (rangeKey === '6M') start.setMonth(start.getMonth() - 6);
  if (rangeKey === 'YTD') start.setMonth(0, 1);
  if (rangeKey === '1Y') start.setFullYear(start.getFullYear() - 1);
  if (rangeKey === '5Y') start.setFullYear(start.getFullYear() - 5);
  return series.filter((point) => new Date(point.date) >= start);
}

function movingAverage(series, window) {
  return series.map((point, index) => {
    if (index + 1 < window) return { date: point.date, value: null };
    const slice = series.slice(index + 1 - window, index + 1);
    const value = slice.reduce((sum, item) => sum + item.value, 0) / window;
    return { date: point.date, value };
  });
}

function normalizeSeries(series) {
  if (!series.length || !Number.isFinite(series[0].value) || series[0].value === 0) return series;
  const base = series[0].value;
  return series.map((point) => ({ ...point, value: (point.value / base) * 100 }));
}

function alignSeriesToLabels(series, labels) {
  const map = new Map((series || []).map((point) => [point.date, point.value]));
  return labels.map((label) => (map.has(label) ? map.get(label) : null));
}

function computeTrend(series) {
  if (series.length < 210) return 'neutral';
  const ma50 = movingAverage(series, 50).at(-1)?.value;
  const ma200 = movingAverage(series, 200).at(-1)?.value;
  const latest = series.at(-1)?.value;
  if (![ma50, ma200, latest].every(Number.isFinite)) return 'neutral';
  if (latest > ma50 && ma50 > ma200) return 'bullish';
  if (latest < ma50 && ma50 < ma200) return 'bearish';
  return 'neutral';
}

function computePositionMetrics(position, quoteMap) {
  const quote = quoteMap[position.ticker?.toUpperCase()];
  const series = quote?.series || [];
  const latest = Number(position.currentPrice || quote?.latest?.value);
  const previous = Number(quote?.previous?.value);
  const entry = Number(position.entryPrice);
  const size = Number(position.size);
  const sign = position.direction === 'short' ? -1 : 1;
  const dailyPnL = [latest, previous, size].every(Number.isFinite) ? (latest - previous) * size * sign : null;
  const totalPnL = [latest, entry, size].every(Number.isFinite) ? (latest - entry) * size * sign : null;
  return {
    latest,
    previous,
    dailyPnL,
    totalPnL,
    trend: series.length ? computeTrend(series) : 'neutral',
    provider: quote?.provider || 'Manual',
    series,
  };
}

function buildThesisValidation(positions, quoteMap) {
  const enriched = positions.map((position) => ({
    ...position,
    metrics: computePositionMetrics(position, quoteMap),
  }));
  const flags = [];
  let aligned = 0;
  let contradicted = 0;

  enriched.forEach((item) => {
    const { direction, ticker, metrics } = item;
    if (!ticker) return;
    const favorableTrend =
      (direction === 'long' && metrics.trend === 'bullish') ||
      (direction === 'short' && metrics.trend === 'bearish');
    const favorablePnL = Number.isFinite(metrics.totalPnL) ? metrics.totalPnL > 0 : false;

    if (favorableTrend || favorablePnL) aligned += 1;
    if (!favorableTrend && metrics.trend !== 'neutral') {
      contradicted += 1;
      flags.push(`${ticker}: current trend is ${metrics.trend} against a ${direction} stance.`);
    }
    if (Number.isFinite(metrics.totalPnL) && metrics.totalPnL < 0) {
      flags.push(`${ticker}: total P&L is negative, so market action is not validating the entry yet.`);
    }
  });

  let headline = 'No positions loaded yet.';
  if (positions.length) {
    if (contradicted === 0 && aligned >= Math.ceil(positions.length / 2)) {
      headline = 'Your book is mostly behaving as expected.';
    } else if (contradicted >= Math.ceil(positions.length / 2)) {
      headline = 'Market action is contradicting a meaningful share of the book.';
    } else {
      headline = 'The book is mixed: some positions are confirming, but there are mismatches to review.';
    }
  }

  return { headline, flags, aligned, contradicted, enriched };
}

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function SourcePill({ label }) {
  return <span className="source-pill">{label}</span>;
}

function Sparkline({ series = [], tone = 'neutral' }) {
  const trimmed = applyRange(series, '6M').slice(-120);
  const data = {
    labels: trimmed.map((point) => point.date),
    datasets: [
      {
        data: trimmed.map((point) => point.value),
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        fill: true,
        borderColor: tone === 'positive' ? '#38d39f' : tone === 'negative' ? '#ff6b6b' : '#8ea2c8',
        backgroundColor: tone === 'positive' ? 'rgba(56, 211, 159, 0.08)' : tone === 'negative' ? 'rgba(255, 107, 107, 0.08)' : 'rgba(142, 162, 200, 0.08)',
      },
    ],
  };
  return (
    <div className="sparkline-wrap">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  );
}

function SectionShell({ title, subtitle, actions, children }) {
  return (
    <section className="section-shell">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MarketCard({ card, unit = 'price', onOpen }) {
  const tone = statusClass(card.trend);
  return (
    <button type="button" className="market-card" onClick={() => onOpen(card.id)}>
      <div className="card-topline">
        <div>
          <h3>{card.name}</h3>
          <div className="card-subline">{card.symbol || 'Series'}</div>
        </div>
        <Badge tone={tone}>{card.trend}</Badge>
      </div>
      <div className="market-value">{formatValue(card.latest?.value, unit)}</div>
      <div className="stat-grid compact four-col">
        <div>
          <span>Daily</span>
          <strong>{formatChange(card.changes?.daily, unit === 'percent' ? 'percent' : 'price')}</strong>
        </div>
        <div>
          <span>1W</span>
          <strong>{formatChange(card.changes?.oneWeek, unit === 'percent' ? 'percent' : 'price')}</strong>
        </div>
        <div>
          <span>1M</span>
          <strong>{formatChange(card.changes?.oneMonth, unit === 'percent' ? 'percent' : 'price')}</strong>
        </div>
        <div>
          <span>3M</span>
          <strong>{formatChange(card.changes?.threeMonths, unit === 'percent' ? 'percent' : 'price')}</strong>
        </div>
        <div>
          <span>1Y</span>
          <strong>{formatChange(card.changes?.oneYear, unit === 'percent' ? 'percent' : 'price')}</strong>
        </div>
        <div>
          <span>Momentum</span>
          <strong>{card.momentum}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{card.breakout}</strong>
        </div>
        <div>
          <span>Obs.</span>
          <strong>{card.latest?.date || '—'}</strong>
        </div>
      </div>
      <Sparkline series={card.series} tone={tone} />
      <div className="card-footer">
        <SourcePill label={card.sourceLabel} />
        <span className="explain-text" title={card.explanation}>ⓘ Explain</span>
      </div>
    </button>
  );
}

function MetricsStrip({ items }) {
  return (
    <div className="metrics-strip">
      {items.map((item) => (
        <div className="metric-chip" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function HeatmapCell({ value }) {
  const tone = !Number.isFinite(value) ? 'neutral' : value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  return <td className={`heat-cell ${tone}`}>{Number.isFinite(value) ? formatNumber(value, 2) : '—'}</td>;
}

function CorrelationCell({ value }) {
  let tone = 'neutral';
  if (Number.isFinite(value)) {
    if (value > 0.25) tone = 'positive';
    if (value < -0.25) tone = 'negative';
  }
  return <td className={`heat-cell ${tone}`}>{Number.isFinite(value) ? formatNumber(value, 2) : '—'}</td>;
}

function ChartModal({ open, chartable, comparison, allChartables, onClose }) {
  const chartRef = useRef(null);
  const [range, setRange] = useState('1Y');
  const [compareId, setCompareId] = useState('');
  const [showMa, setShowMa] = useState(true);
  const [normalize, setNormalize] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompareId('');
    setRange('1Y');
    setShowMa(true);
    setNormalize(false);
  }, [open, chartable?.id]);

  if (!open || !chartable) return null;
  const compatible = Object.values(allChartables).filter(
    (item) => item.id !== chartable.id && item.unit === chartable.unit,
  );
  const baseSeries = applyRange(chartable.series || [], range);
  const ma50 = movingAverage(baseSeries, 50);
  const ma200 = movingAverage(baseSeries, 200);
  const compareSeriesRaw = compareId ? applyRange(allChartables[compareId]?.series || [], range) : [];
  const chartBase = normalize ? normalizeSeries(baseSeries) : baseSeries;
  const chartCompare = normalize ? normalizeSeries(compareSeriesRaw) : compareSeriesRaw;

  const datasets = [
    {
      label: chartable.name,
      data: chartBase.map((point) => point.value),
      borderColor: '#6aa6ff',
      backgroundColor: 'rgba(106,166,255,0.12)',
      pointRadius: 0,
      tension: 0.2,
      borderWidth: 2,
      fill: true,
    },
  ];

  if (showMa) {
    datasets.push(
      {
        label: '50-day MA',
        data: ma50.map((point) => point.value),
        borderColor: '#38d39f',
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0.2,
      },
      {
        label: '200-day MA',
        data: ma200.map((point) => point.value),
        borderColor: '#ffb454',
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0.2,
      },
    );
  }

  if (compareId && chartCompare.length) {
    datasets.push({
      label: allChartables[compareId].name,
      data: chartCompare.map((point) => point.value),
      borderColor: '#c88cff',
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.2,
      borderDash: [6, 4],
    });
  }

  const modalLabels = chartBase.map((point) => point.date);
  const alignedDatasets = datasets.map((dataset) => ({ ...dataset, data: Array.isArray(dataset.data) ? dataset.data : dataset.data }));
  if (compareId && chartCompare.length) {
    alignedDatasets[alignedDatasets.length - 1].data = alignSeriesToLabels(chartCompare, modalLabels);
  }
  const data = {
    labels: modalLabels,
    datasets: alignedDatasets,
  };

  const exportChart = () => {
    if (!chartRef.current) return;
    const link = document.createElement('a');
    link.download = `${chartable.id}-${range}.png`;
    link.href = chartRef.current.toBase64Image('image/png', 1);
    link.click();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{chartable.name}</h3>
            <p>{chartable.sourceLabel} · latest observation {chartable.series?.at(-1)?.date || '—'}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>

        <div className="chart-toolbar">
          <div className="range-group">
            {RANGES.map((item) => (
              <button
                type="button"
                key={item}
                className={range === item ? 'range active' : 'range'}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <label>
              Compare
              <select value={compareId} onChange={(event) => setCompareId(event.target.value)}>
                <option value="">None</option>
                {compatible.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="check-label">
              <input type="checkbox" checked={showMa} onChange={(e) => setShowMa(e.target.checked)} />
              Moving averages
            </label>
            <label className="check-label">
              <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} />
              Normalize
            </label>
            <button type="button" className="ghost-button" onClick={exportChart}>Export PNG</button>
          </div>
        </div>

        <div className="modal-chart-area">
          <Line
            ref={chartRef}
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: { legend: { display: true } },
              scales: {
                x: { ticks: { color: '#9fb0cf', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { ticks: { color: '#9fb0cf' }, grid: { color: 'rgba(255,255,255,0.06)' } },
              },
            }}
          />
        </div>

        <div className="modal-foot-grid">
          <div className="info-box">
            <div className="info-title">Explain this metric</div>
            <p>{chartable.explanation}</p>
          </div>
          <div className="info-box">
            <div className="info-title">Source mapping</div>
            <p>{chartable.sourceLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionsPanel({ chartables }) {
  const [positions, setPositions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(POSITIONS_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES_KEY) || '');
  const [quoteMap, setQuoteMap] = useState({});

  useEffect(() => {
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions)); } catch {}
  }, [positions]);

  useEffect(() => {
    try { localStorage.setItem(NOTES_KEY, notes); } catch {}
  }, [notes]);

  useEffect(() => {
    const tickers = [...new Set(positions.map((p) => p.ticker?.trim().toUpperCase()).filter(Boolean))];
    tickers.forEach((ticker) => {
      if (quoteMap[ticker]) return;
      const known = Object.values(chartables).find((item) => item.name === ticker || item.id === ticker.toLowerCase() || item.symbol === ticker);
      if (known) {
        setQuoteMap((prev) => ({
          ...prev,
          [ticker]: {
            provider: known.sourceLabel,
            latest: known.series?.at(-1),
            previous: known.series?.at(-2),
            series: known.series || [],
          },
        }));
        return;
      }
      fetch(`/api/quote/${ticker}`)
        .then((res) => res.json())
        .then((json) => setQuoteMap((prev) => ({ ...prev, [ticker]: json })))
        .catch(() => setQuoteMap((prev) => ({ ...prev, [ticker]: { provider: 'Lookup failed', series: [] } })));
    });
  }, [positions, quoteMap, chartables]);

  const validation = useMemo(() => buildThesisValidation(positions, quoteMap), [positions, quoteMap]);

  const updatePosition = (index, key, value) => {
    setPositions((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addRow = () => setPositions((prev) => [...prev, { ticker: '', direction: 'long', size: '', entryPrice: '', currentPrice: '', notes: '' }]);
  const removeRow = (index) => setPositions((prev) => prev.filter((_, i) => i !== index));

  const importCsv = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const mapped = data.map((row) => ({
          ticker: row.ticker || row.Ticker || '',
          direction: (row.direction || row.Direction || 'long').toLowerCase(),
          size: row.size || row.Size || '',
          entryPrice: row.entryPrice || row.EntryPrice || row['Entry Price'] || '',
          currentPrice: row.currentPrice || row.CurrentPrice || row['Current Price'] || '',
          notes: row.notes || row.Notes || '',
        }));
        setPositions(mapped);
      },
    });
  };

  return (
    <SectionShell
      title="Daily P&L / Thesis Validation"
      subtitle="Editable local book with automatic persistence in localStorage."
      actions={
        <div className="section-actions">
          <button type="button" className="ghost-button" onClick={addRow}>Add position</button>
          <label className="upload-button">
            Upload CSV
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          </label>
        </div>
      }
    >
      <div className="thesis-box">
        <div>
          <div className="info-title">Thesis validation</div>
          <p>{validation.headline}</p>
        </div>
        <MetricsStrip
          items={[
            { label: 'Aligned', value: validation.aligned },
            { label: 'Contradicted', value: validation.contradicted },
            { label: 'Positions', value: positions.length },
          ]}
        />
      </div>

      {validation.flags.length ? (
        <div className="flag-list">
          {validation.flags.slice(0, 8).map((flag) => (
            <div key={flag} className="flag-item">⚑ {flag}</div>
          ))}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Direction</th>
              <th>Size</th>
              <th>Entry</th>
              <th>Current</th>
              <th>Daily P&L</th>
              <th>Total P&L</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => {
              const metrics = computePositionMetrics(position, quoteMap);
              return (
                <tr key={`${position.ticker}-${index}`}>
                  <td>
                    <input value={position.ticker} onChange={(e) => updatePosition(index, 'ticker', e.target.value.toUpperCase())} />
                  </td>
                  <td>
                    <select value={position.direction} onChange={(e) => updatePosition(index, 'direction', e.target.value)}>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </td>
                  <td><input value={position.size} onChange={(e) => updatePosition(index, 'size', e.target.value)} /></td>
                  <td><input value={position.entryPrice} onChange={(e) => updatePosition(index, 'entryPrice', e.target.value)} /></td>
                  <td><input value={position.currentPrice} onChange={(e) => updatePosition(index, 'currentPrice', e.target.value)} placeholder={metrics.latest ? String(metrics.latest) : 'auto'} /></td>
                  <td className={metrics.dailyPnL > 0 ? 'positive-text' : metrics.dailyPnL < 0 ? 'negative-text' : ''}>
                    {Number.isFinite(metrics.dailyPnL) ? `$${formatNumber(metrics.dailyPnL, 2)}` : '—'}
                  </td>
                  <td className={metrics.totalPnL > 0 ? 'positive-text' : metrics.totalPnL < 0 ? 'negative-text' : ''}>
                    {Number.isFinite(metrics.totalPnL) ? `$${formatNumber(metrics.totalPnL, 2)}` : '—'}
                  </td>
                  <td><input value={position.notes} onChange={(e) => updatePosition(index, 'notes', e.target.value)} /></td>
                  <td><button type="button" className="danger-button" onClick={() => removeRow(index)}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notes-panel">
        <div className="info-title">Manual note-taking panel</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your macro thesis, catalysts, or review notes here." />
      </div>
    </SectionShell>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedChart, setSelectedChart] = useState('');

  const loadDashboard = async (force = false) => {
    try {
      force ? setRefreshing(true) : setLoading(true);
      setError('');
      const response = await fetch(`/api/dashboard${force ? '?force=1' : ''}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load dashboard');
      setDashboard(json);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard(false);
  }, []);

  const chartables = dashboard?.sections?.chartables || {};
  const selectedChartable = selectedChart ? chartables[selectedChart] : null;

  if (loading) {
    return (
      <div className="app-shell loading-screen">
        <div className="loading-card">
          <h1>Global Macro Monitor</h1>
          <p>Loading official macro data, Treasury curves, and market proxies…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell loading-screen">
        <div className="loading-card error-card">
          <h1>Global Macro Monitor</h1>
          <p>{error}</p>
          <button type="button" className="ghost-button" onClick={() => loadDashboard(false)}>Retry</button>
        </div>
      </div>
    );
  }

  const priceAction = dashboard.sections.priceAction;
  const rates = dashboard.sections.rates;
  const liquidity = dashboard.sections.liquidity;
  const inflation = dashboard.sections.inflation;
  const breadth = dashboard.sections.breadth;
  const crossAsset = dashboard.sections.crossAsset;
  const sectors = dashboard.sections.sectors.leaders;

  const yieldCurveData = {
    labels: rates.yieldCurve.map((point) => point.tenor),
    datasets: [
      {
        label: 'Yield Curve',
        data: rates.yieldCurve.map((point) => point.value),
        backgroundColor: 'rgba(106,166,255,0.7)',
        borderRadius: 8,
      },
    ],
  };

  const inflationCompareSeries = ['cpi_yoy', 'core_cpi_yoy', 'ppi_yoy', 'wage_yoy', 'breakeven_10y']
    .map((id) => chartables[id])
    .filter(Boolean);

  const inflationLabels = applyRange(chartables.cpi_yoy?.series || [], '5Y').map((point) => point.date);
  const inflationChart = {
    labels: inflationLabels,
    datasets: inflationCompareSeries.map((series, idx) => ({
      label: series.name,
      data: alignSeriesToLabels(applyRange(series.series || [], '5Y'), inflationLabels),
      borderColor: ['#6aa6ff', '#38d39f', '#ffb454', '#c88cff', '#ff6b6b'][idx % 5],
      pointRadius: 0,
      tension: 0.2,
      borderWidth: 2,
    })),
  };

  return (
    <div className="app-shell">
      <header className="hero-header">
        <div>
          <div className="eyebrow">Institutional-style macro dashboard</div>
          <h1>Global Macro Monitor</h1>
          <p>
            A Druckenmiller-style read on price action, rates, liquidity, inflation, cyclicals, breadth, and
            whether your own book is behaving correctly.
          </p>
        </div>
        <div className="hero-actions">
          <div className="summary-chip big">
            <span>Macro regime</span>
            <strong>{dashboard.summary.regime}</strong>
          </div>
          <div className="summary-chip">
            <span>Liquidity</span>
            <strong>{dashboard.summary.liquidityRegime}</strong>
          </div>
          <div className="summary-chip">
            <span>Inflation</span>
            <strong>{dashboard.summary.inflationRegime}</strong>
          </div>
          <button type="button" className="ghost-button" onClick={() => loadDashboard(true)}>
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>
      </header>

      <div className="top-summary-row">
        <div className="summary-panel">
          <div className="info-title">Daily summary</div>
          <p>{dashboard.summary.text}</p>
          <div className="timestamp-row">
            <span>Last dashboard build: {dashboard.generatedAt}</span>
            <span>Curve date: {rates.lastCurveDate || '—'}</span>
          </div>
        </div>
        <div className="summary-panel">
          <div className="info-title">Source integrity notes</div>
          <p>{dashboard.sourceNotes.marketPriceProvider}</p>
          <p>{dashboard.sourceNotes.breadthProxy}</p>
        </div>
      </div>

      {dashboard.errors?.length ? (
        <div className="warning-banner">
          Some feeds returned partial data: {dashboard.errors.join(' · ')}
        </div>
      ) : null}

      <SectionShell title="1) Price Action Across Markets" subtitle={dashboard.explanations.priceAction}>
        <div className="market-grid">
          {priceAction.map((card) => (
            <MarketCard key={card.id} card={card} unit={card.id === 'us10y' ? 'percent' : 'price'} onOpen={setSelectedChart} />
          ))}
        </div>
      </SectionShell>

      <SectionShell title="2) Interest Rates & Yield Curve" subtitle={dashboard.explanations.rates}>
        <div className="split-grid two-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Rate metrics</h3>
              <Badge tone={statusClass(rates.curveSignal)}>{rates.curveSignal}</Badge>
            </div>
            <div className="metric-list">
              {rates.metrics.map((metric) => (
                <button type="button" className="metric-row" key={metric.id} onClick={() => setSelectedChart(metric.id)}>
                  <div>
                    <div className="metric-name">{metric.name}</div>
                    <div className="metric-source">{metric.sourceLabel}</div>
                  </div>
                  <div className="metric-values">
                    <strong>{formatValue(metric.latest?.value, metric.unit)}</strong>
                    <span>{formatChange(metric.changes?.oneMonth, metric.unit)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="panel yield-panel">
            <div className="panel-head">
              <h3>Current yield curve</h3>
              <SourcePill label="U.S. Treasury official daily curve" />
            </div>
            <div className="bar-chart-wrap">
              <Bar
                data={yieldCurveData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#9fb0cf' }, grid: { display: false } },
                    y: { ticks: { color: '#9fb0cf' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell title="3) Liquidity & Monetary Policy" subtitle={dashboard.explanations.liquidity}>
        <MetricsStrip
          items={[
            { label: 'Liquidity regime', value: liquidity.summary.regime },
            { label: 'Fed - SOFR', value: formatChange(liquidity.summary.spreadFedToSofr, 'percent') },
            { label: 'Prime - Fed', value: formatChange(liquidity.summary.spreadPrimeToFed, 'percent') },
          ]}
        />
        <div className="market-grid compact-grid">
          {liquidity.metrics.map((metric) => (
            <button type="button" className="metric-card" key={metric.id} onClick={() => setSelectedChart(metric.id)}>
              <div className="card-topline">
                <div>
                  <h3>{metric.name}</h3>
                  <div className="card-subline">{metric.latest?.date || '—'}</div>
                </div>
                <SourcePill label={metric.sourceLabel} />
              </div>
              <div className="market-value small">{formatValue(metric.latest?.value, metric.unit)}</div>
              <div className="stat-grid compact two-up">
                <div><span>1M</span><strong>{formatChange(metric.changes?.oneMonth, metric.unit)}</strong></div>
                <div><span>3M</span><strong>{formatChange(metric.changes?.threeMonths, metric.unit)}</strong></div>
              </div>
            </button>
          ))}
        </div>
      </SectionShell>

      <SectionShell title="4) Inflation Indicators" subtitle={dashboard.explanations.inflation}>
        <div className="split-grid two-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Inflation regime</h3>
              <Badge tone={statusClass(inflation.regime)}>{inflation.regime}</Badge>
            </div>
            <div className="metric-list">
              {inflation.metrics.map((metric) => (
                <button type="button" className="metric-row" key={metric.id} onClick={() => setSelectedChart(metric.id)}>
                  <div>
                    <div className="metric-name">{metric.name}</div>
                    <div className="metric-source">{metric.sourceLabel}</div>
                  </div>
                  <div className="metric-values">
                    <strong>{formatValue(metric.latest?.value, metric.unit)}</strong>
                    <span>Prior {formatValue(metric.prior?.value, metric.unit)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="panel large-chart-panel">
            <div className="panel-head">
              <h3>Inflation comparison chart</h3>
              <span className="metric-source">Hover for exact release dates</span>
            </div>
            <div className="chart-area medium">
              <Line
                data={inflationChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  scales: {
                    x: { ticks: { color: '#9fb0cf', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { ticks: { color: '#9fb0cf' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell title="5) Leading Economic Sectors" subtitle={dashboard.explanations.sectors}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>RS vs SPY (3M)</th>
                <th>1M</th>
                <th>3M</th>
                <th>6M</th>
                <th>Trend</th>
                <th>Leadership score</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="link-button" onClick={() => setSelectedChart(row.id)}>{row.name}</button>
                  </td>
                  <td>{Number.isFinite(row.relativeStrength) ? formatNumber(row.relativeStrength, 2) + '%' : '—'}</td>
                  <td>{Number.isFinite(row.oneMonth) ? formatNumber(row.oneMonth, 2) + '%' : '—'}</td>
                  <td>{Number.isFinite(row.threeMonths) ? formatNumber(row.threeMonths, 2) + '%' : '—'}</td>
                  <td>{Number.isFinite(row.sixMonths) ? formatNumber(row.sixMonths, 2) + '%' : '—'}</td>
                  <td><Badge tone={statusClass(row.trend)}>{row.trend}</Badge></td>
                  <td>{formatNumber(row.leadershipScore, 1)}</td>
                  <td>{row.sourceLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell title="6) Global Macro Cross-Asset Signals" subtitle="Highlights where market relationships are confirming or contradicting the macro tape.">
        <div className="cross-grid">
          {crossAsset.map((item) => (
            <div key={item.id} className="panel cross-panel">
              <div className="panel-head">
                <h3>{item.title}</h3>
                <Badge tone={statusClass(item.verdict)}>{item.verdict}</Badge>
              </div>
              <p>{item.explanation}</p>
              <div className="stat-grid compact two-up">
                <div><span>60D corr</span><strong>{Number.isFinite(item.correlation60d) ? formatNumber(item.correlation60d, 2) : '—'}</strong></div>
                <div><span>3M gap</span><strong>{Number.isFinite(item.returnGap3m) ? formatNumber(item.returnGap3m, 2) : '—'}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell title="7) Market Breadth & Positioning" subtitle={dashboard.explanations.breadth}>
        <MetricsStrip
          items={[
            { label: '% above 50DMA', value: Number.isFinite(breadth.percentAbove50) ? `${formatNumber(breadth.percentAbove50, 1)}%` : '—' },
            { label: '% above 200DMA', value: Number.isFinite(breadth.percentAbove200) ? `${formatNumber(breadth.percentAbove200, 1)}%` : '—' },
            { label: 'Positive 1M breadth', value: Number.isFinite(breadth.positive1M) ? `${formatNumber(breadth.positive1M, 1)}%` : '—' },
            { label: 'Cyclicals - defensives (3M)', value: Number.isFinite(breadth.cyclicalVsDefensive3M) ? `${formatNumber(breadth.cyclicalVsDefensive3M, 2)}%` : '—' },
            { label: 'VIX', value: formatValue(breadth.vixLatest?.value, 'index') },
            { label: 'NFCI', value: formatValue(breadth.nfciLatest?.value, 'index') },
          ]}
        />

        <div className="split-grid two-col">
          <div className="panel">
            <div className="panel-head">
              <h3>Sector rotation heatmap</h3>
              <span className="metric-source">Tracked ETF proxy set</span>
            </div>
            <div className="table-wrap">
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>1M</th>
                    <th>3M</th>
                    <th>RS 1M</th>
                    <th>RS 3M</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {breadth.sectorHeatmap.map((row) => (
                    <tr key={row.id}>
                      <td><button type="button" className="link-button" onClick={() => setSelectedChart(row.id)}>{row.name}</button></td>
                      <HeatmapCell value={row.oneMonth} />
                      <HeatmapCell value={row.threeMonths} />
                      <HeatmapCell value={row.relative1M} />
                      <HeatmapCell value={row.relative3M} />
                      <HeatmapCell value={row.score} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>60D correlation matrix</h3>
              <span className="metric-source">Selected cross-asset set</span>
            </div>
            <div className="table-wrap">
              <table className="data-table compact-table matrix-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    {breadth.correlationMatrix.map((col) => <th key={col.id}>{col.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {breadth.correlationMatrix.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      {row.values.map((value, index) => <CorrelationCell key={`${row.id}-${index}`} value={value} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SectionShell>

      <PositionsPanel chartables={chartables} />

      <footer className="footer-note">
        Built for auditability: every widget keeps its source label, observation date, and a path to swap providers later.
      </footer>

      <ChartModal
        open={Boolean(selectedChart)}
        chartable={selectedChartable}
        allChartables={chartables}
        onClose={() => setSelectedChart('')}
      />
    </div>
  );
}
