/**
 * server.js
 * GGWALL Chart Server - Express API
 *
 * POST /chart
 * Body: { coin, period, indicators }
 * Returns: PNG image
 *
 * GET /health
 * Returns: { status: "ok" }
 */

const express = require('express');
const { fetchOHLC, COIN_SYMBOL_MAP } = require('./binance');
const { calculateAll } = require('./indicators');
const { renderChart } = require('./chart-renderer');

const app = express();
app.use(express.json());

// Default indicators per period (matches telegram-bot.ts logic)
function getDefaultIndicators(period) {
  switch (period) {
    case '4h':  return ['alerts'];
    case '24h': return ['ma7', 'alerts'];
    case '7d':  return ['ma7', 'ma25', 'alerts'];
    case '30d': return ['ma7', 'ma25', 'rsi', 'alerts'];
    case '90d': return ['ma7', 'ma25', 'rsi'];
    default:    return ['ma7'];
  }
}

// Coin ID → display label
function getCoinLabel(coinId) {
  const labels = {
    'cosmos':    'ATOM/USDT',
    'osmosis':   'OSMO/USDT',
    'saga-2':    'SAGA/USDT',
    'dymension': 'DYM/USDT',
    'cardano':   'ADA/USDT',
    'celestia':  'TIA/USDT',
    'bitcoin':   'BTC/USDT',
    'ethereum':  'ETH/USDT',
    'secret':    'SCRT/USDT',
  };
  return labels[coinId] || coinId.toUpperCase();
}

// ────────────────────────────────────────────────────────────
// GET /health - Health check
// ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ggwall-chart-server', timestamp: new Date().toISOString() });
});

// ────────────────────────────────────────────────────────────
// POST /chart - Generate chart PNG
// ────────────────────────────────────────────────────────────
app.post('/chart', async (req, res) => {
  const startTime = Date.now();

  try {
    // Parse & validate request
    const { coin, period, indicators: reqIndicators } = req.body;

    if (!coin) {
      return res.status(400).json({ error: 'Missing required field: coin' });
    }
    if (!period) {
      return res.status(400).json({ error: 'Missing required field: period' });
    }

    const validPeriods = ['4h', '24h', '7d', '30d', '90d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` });
    }

    // Use provided indicators or fall back to period defaults
    const indicators = Array.isArray(reqIndicators) ? reqIndicators : getDefaultIndicators(period);

    console.log(`\n[/chart] Request: coin=${coin} period=${period} indicators=[${indicators.join(',')}]`);

    // 1. Fetch OHLC data from Binance
    const candles = await fetchOHLC(coin, period);

    // 2. Calculate indicators
    const indicatorData = calculateAll(candles, indicators);

    // 3. Render chart to PNG
    const meta = {
      coinLabel:  getCoinLabel(coin),
      period,
      indicators,
    };
    const pngBuffer = await renderChart(candles, indicatorData, meta);

    // 4. Return PNG
    res.set('Content-Type', 'image/png');
    res.set('X-Render-Time', `${Date.now() - startTime}ms`);
    res.send(pngBuffer);

    console.log(`[/chart] Done in ${Date.now() - startTime}ms`);

  } catch (err) {
    console.error('[/chart] Error:', err.message);

    // Return appropriate error status
    if (err.message.includes('not available on Binance') || err.message.includes('Unknown coin')) {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /coins - List supported coins
// ────────────────────────────────────────────────────────────
app.get('/coins', (req, res) => {
  const supported = Object.keys(COIN_SYMBOL_MAP).map(id => ({
    id,
    symbol: COIN_SYMBOL_MAP[id],
  }));
  res.json({ supported, unsupported: ['juno-network', 'stargaze', 'akash-network'] });
});

// ────────────────────────────────────────────────────────────
// Start server
// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 GGWALL Chart Server running on port ${PORT}`);
  console.log(`   Health: GET  /health`);
  console.log(`   Chart:  POST /chart`);
  console.log(`   Coins:  GET  /coins\n`);
});
