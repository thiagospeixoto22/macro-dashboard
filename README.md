# Global Macro Monitor

A polished, dark-mode macro dashboard built as a React + Node web app. It is designed to give a macro investor a fast daily read on:

- price action
- rates and curve shape
- liquidity and monetary policy
- inflation and wage pressure
- cyclical sector leadership
- cross-asset confirmation/divergence
- breadth / positioning proxies
- daily P&L / thesis validation for a local positions book

## Why this is a React app instead of a single HTML file

A single file would be lighter, but this build is cleaner and more audit-friendly because it:

- keeps API keys in a `.env` file on the server side rather than exposing them to the browser
- separates data-fetching from UI rendering
- keeps source mapping explicit
- makes it easier to add new indicators later
- supports local caching and graceful error handling

## Quick setup

1. **Install Node.js 18+**
2. In this project folder, run:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`
4. Paste your keys into `.env`
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open the local Vite URL shown in your terminal (typically `http://localhost:5173`)

## Production-style local run

If you want the React app built and served by the Node server:

```bash
npm run build
npm run start
```

Then open `http://localhost:8787`

## Where to paste API keys

Put them in the root `.env` file:

```env
FRED_API_KEY=your_fred_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
BLS_API_KEY=
PORT=8787
MARKET_PRICE_PROVIDER=stooq
```

## Source mapping by section

### 1) Price Action Across Markets
- **Default provider for broad ETF / sector proxies:** Stooq daily history
- **FX pairs:** Alpha Vantage `FX_DAILY`
- **10Y Treasury yield:** official U.S. Treasury daily par yield curve

### 2) Interest Rates & Yield Curve
- **2Y / 10Y / 3M / 5Y real yields:** official U.S. Treasury daily curve files
- **2s10s / 3m10y:** derived inside the app from official Treasury tenors
- **IG / HY credit spreads:** FRED

### 3) Liquidity & Monetary Policy
- **Fed funds, SOFR, prime, WALCL, M2, NFCI:** FRED

### 4) Inflation Indicators
- **CPI, Core CPI, PPI, Unemployment, Payrolls, Wage proxy:** BLS API
- **Breakeven inflation:** FRED
- **Commodity basket:** derived from GLD + CPER + USO proxy histories

### 5) Leading Economic Sectors
- XHB, IYT, XRT, SOXX, KRE and supporting sector ETFs use Stooq proxy histories

### 6) Cross-Asset Signals
- Derived from the above price/rate series

### 7) Breadth / Positioning
- Transparent free-data proxies only
- Percentage above moving averages
- Positive-return breadth
- Cyclicals vs defensives
- VIX + NFCI overlay
- Sector heatmap and correlation matrix

### 8) Daily P&L / Thesis Validation
- User-entered book stored in `localStorage`
- Current prices can be pulled from the app’s quote endpoint or manually overridden

## Exact series IDs / symbols used and why

### Official macro / rate series

| Metric | Series / source | Why this was chosen |
|---|---|---|
| Fed funds | `DFF` (FRED) | Standard effective policy/funding benchmark |
| SOFR | `SOFR` (FRED) | Current secured overnight funding reference |
| Prime rate | `DPRIME` (FRED) | Useful bank lending-rate transmission signal |
| Fed balance sheet | `WALCL` (FRED) | Clean weekly liquidity balance-sheet measure |
| M2 | `M2SL` (FRED) | Broad money trend |
| NFCI | `NFCI` (FRED) | Free financial-conditions regime proxy |
| 10Y breakeven | `T10YIE` (FRED) | Market inflation expectations |
| IG spread | `BAMLC0A0CM` (FRED) | Free IG credit-spread proxy |
| HY spread | `BAMLH0A0HYM2` (FRED) | Free HY credit-spread proxy |
| VIX | `VIXCLS` (FRED) | Free sentiment / implied-volatility proxy |
| CPI | `CUUR0000SA0` (BLS) | Headline CPI-U level for YoY calculation |
| Core CPI | `CUUR0000SA0L1E` (BLS) | Core inflation level for YoY calculation |
| PPI | `WPUFD4` (BLS) | Final-demand producer prices |
| Unemployment | `LNS14000000` (BLS) | Standard U-3 unemployment rate |
| Payrolls | `CES0000000001` (BLS) | Nonfarm employment level |
| Wages | `CES0500000003` (BLS) | Average hourly earnings proxy |
| Nominal Treasury curve | official Treasury daily par yield curve | Best free official source for 2Y / 10Y / 3M |
| Real Treasury curve | official Treasury daily real yield curve | Best free official source for 5Y real yield |

### Market / sector price proxies

| Display metric | Symbol used | Why this was chosen |
|---|---|---|
| S&P 500 | `SPY` | Highly liquid tradable proxy |
| Nasdaq 100 | `QQQ` | Clean liquid growth proxy |
| Russell 2000 | `IWM` | Liquid small-cap proxy |
| International equity | `EFA` | Good developed ex-U.S. proxy |
| Gold | `GLD` | Widely used gold proxy |
| Copper | `CPER` | Free liquid copper ETF proxy |
| Crude oil | `USO` | Simple liquid oil proxy |
| U.S. dollar | `UUP` | Good free dollar proxy when DXY feed is not free |
| EUR/USD | Alpha Vantage FX | Direct FX pair |
| USD/JPY | Alpha Vantage FX | Direct FX pair |
| Homebuilders | `XHB` | Cyclical housing-sensitive proxy |
| Transports | `IYT` | Goods-flow / cyclicality proxy |
| Retail | `XRT` | Consumer discretionary/retail signal |
| Semiconductors | `SOXX` | Leading growth/capex signal |
| Regional banks | `KRE` | Credit transmission / domestic banking signal |
| Industrials | `XLI` | Industrial-cyclical cross-check |
| Financials | `XLF` | Sector rotation breadth support |
| Consumer staples | `XLP` | Defensive sector proxy |
| Utilities | `XLU` | Defensive sector proxy |
| Health care | `XLV` | Defensive sector proxy |
| Emerging markets | `EEM` | Useful against dollar strength |

## Known limitations / free data constraints

1. **Alpha Vantage free tier is too tight for a full 15+ symbol dashboard.**
   That is why the default broad market-price adapter uses Stooq daily history for ETFs/sector proxies and reserves Alpha Vantage for FX.

2. **This is not a tick-by-tick terminal.**
   The dashboard is designed for daily macro monitoring, not intraday execution.

3. **Some “perfect” institutional breadth feeds are not freely available.**
   The breadth section therefore uses transparent proxies instead of pretending to have full exchange-level breadth tapes.

4. **ETF proxies are proxies.**
   For some assets, the cleanest free path is a liquid ETF proxy rather than a licensed institutional cash index feed.

5. **BLS release cadence is monthly.**
   The app clearly shows observation dates so stale-by-design monthly data is not mistaken for daily updates.

6. **Positions persistence is local only.**
   The thesis-validation book is stored in browser `localStorage` on your machine.

## How to swap in a different API later

The cleanest way is to edit the server adapters instead of rewriting the UI:

- `server/services/marketData.js` → swap the market-price provider
- `server/services/fred.js` → swap FRED for another macro source
- `server/services/bls.js` → swap labor/inflation data source
- `server/services/treasury.js` → swap or extend Treasury curve handling
- `server/mappings.js` → update symbols, series IDs, source labels, and explanations

The UI reads a normalized payload from `/api/dashboard`, so as long as those server adapters still return the same shape, the front end should continue to work.

## Notes on auditability

- No widget is allowed to silently show fabricated data
- Observation dates are preserved
- Source labels are shown in the UI
- Derived metrics are labeled as derived
- Missing data should surface as `—` instead of fake zeros

