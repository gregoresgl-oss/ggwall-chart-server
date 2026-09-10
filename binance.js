/**
 * binance.js
 * Fetches OHLC candlestick data from Binance API (free, no API key needed)
 */

// Coin ID → Binance trading pair mapping
const COIN_SYMBOL_MAP = {
  'cosmos':       'ATOMUSDT',
  'osmosis':      'OSMOUSDT',
  'saga-2':       'SAGAUSDT',
  'dymension':    'DYMUSDT',
  'cardano':      'ADAUSDT',
  'celestia':     'TIAUSDT',
  'bitcoin':      'BTCUSDT',
  'ethereum':     'ETHUSDT',
  'secret':       'SCRTUSDT',
};

// Coins NOT available on Binance (no candlestick charts)
const UNSUPPORTED_COINS = ['juno-network', 'stargaze', 'akash-network'];

// Period → optimal interval & limit (50-300 candles sweet spot)
const PERIOD_CONFIG = {
  '4h':  { interval: '5m',  limit: 48  },
  '24h': { interval: '5m',  limit: 288 },
  '7d':  { interval: '1h',  limit: 168 },
  '30d': { interval: '4h',  limit: 180 },
  '90d': { interval: '1d',  limit: 90  },
};

/**
 * Fetch OHLC data from Binance
 * @param {string} coinId - e.g. "cosmos", "bitcoin"
 * @param {string} period - e.g. "7d", "30d"
 * @returns {Promise<Array>} Array of OHLC candle objects
 */
async function fetchOHLC(coinId, period) {
  // Check if coin is supported
  if (UNSUPPORTED_COINS.includes(coinId)) {
    throw new Error(`Coin "${coinId}" is not available on Binance. No candlestick charts possible.`);
  }

  const symbol = COIN_SYMBOL_MAP[coinId];
  if (!symbol) {
    throw new Error(`Unknown coin: "${coinId}". Supported: ${Object.keys(COIN_SYMBOL_MAP).join(', ')}`);
  }

  const config = PERIOD_CONFIG[period];
  if (!config) {
    throw new Error(`Unknown period: "${period}". Supported: ${Object.keys(PERIOD_CONFIG).join(', ')}`);
  }

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${config.interval}&limit=${config.limit}`;
  console.log(`[Binance] Fetching ${symbol} ${period} → ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Binance API error ${response.status}: ${text}`);
  }

  const raw = await response.json();

  // Parse Binance kline format into clean OHLC objects
  // Binance returns: [openTime, open, high, low, close, volume, closeTime, ...]
  const candles = raw.map(k => ({
    time:   Math.floor(k[0] / 1000), // Convert ms → seconds (TradingView format)
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  console.log(`[Binance] Got ${candles.length} candles for ${symbol} ${period}`);
  return candles;
}

module.exports = { fetchOHLC, COIN_SYMBOL_MAP, PERIOD_CONFIG, UNSUPPORTED_COINS };
