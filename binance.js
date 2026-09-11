/**
 * binance.js
 * Fetches OHLC candlestick data from Binance API (free, no API key needed)
 * Falls back to CoinGecko API for coins not listed on Binance (e.g. JUNO)
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

// Coins that use CoinGecko instead of Binance
// coin ID here must match CoinGecko's coin ID
const COINGECKO_COINS = {
  'juno-network': 'juno-network',
};

// Coins with no support at all
const UNSUPPORTED_COINS = ['stargaze', 'akash-network'];

// Period → optimal interval & limit for Binance (50-300 candles sweet spot)
const PERIOD_CONFIG = {
  '4h':  { interval: '5m',  limit: 48  },
  '24h': { interval: '5m',  limit: 288 },
  '7d':  { interval: '1h',  limit: 168 },
  '30d': { interval: '4h',  limit: 180 },
  '90d': { interval: '1d',  limit: 90  },
};

// CoinGecko period → days param
const COINGECKO_PERIOD_CONFIG = {
  '7d':  { days: 7  },
  '30d': { days: 30 },
  '90d': { days: 90 },
};

/**
 * Fetch OHLC from CoinGecko (for JUNO and other non-Binance coins)
 * Returns hourly candles — only supports 7d/30d/90d
 */
async function fetchOHLCFromCoinGecko(coinId, period) {
  const config = COINGECKO_PERIOD_CONFIG[period];
  if (!config) {
    throw new Error(`Period "${period}" not supported for ${coinId}. Use 7d, 30d, or 90d.`);
  }

  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${config.days}`;
  console.log(`[CoinGecko] Fetching ${coinId} ${period} → ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CoinGecko API error ${response.status}: ${text}`);
  }

  const raw = await response.json();

  // CoinGecko returns: [timestamp, open, high, low, close]  (no volume)
  const candles = raw.map(k => ({
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: 0, // CoinGecko OHLC endpoint doesn't provide volume
  }));

  console.log(`[CoinGecko] Got ${candles.length} candles for ${coinId} ${period}`);
  return candles;
}

/**
 * Fetch OHLC data — routes to Binance or CoinGecko based on coin
 * @param {string} coinId - e.g. "cosmos", "juno-network"
 * @param {string} period - e.g. "7d", "30d"
 * @returns {Promise<Array>} Array of OHLC candle objects
 */
async function fetchOHLC(coinId, period) {
  // Unsupported coins
  if (UNSUPPORTED_COINS.includes(coinId)) {
    throw new Error(`Coin "${coinId}" is not available. No chart data source found.`);
  }

  // CoinGecko coins (JUNO etc.)
  if (COINGECKO_COINS[coinId]) {
    return fetchOHLCFromCoinGecko(COINGECKO_COINS[coinId], period);
  }

  // Binance coins
  const symbol = COIN_SYMBOL_MAP[coinId];
  if (!symbol) {
    throw new Error(`Unknown coin: "${coinId}".`);
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

  const candles = raw.map(k => ({
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  console.log(`[Binance] Got ${candles.length} candles for ${symbol} ${period}`);
  return candles;
}

module.exports = { fetchOHLC, COIN_SYMBOL_MAP, COINGECKO_COINS, PERIOD_CONFIG, UNSUPPORTED_COINS };
