/**
 * coingecko.js
 * Fetches price data for all GGWALL coins from CoinGecko API
 */

// All coins we track → CoinGecko ID
const COINGECKO_IDS = [
  'bitcoin',
  'ethereum',
  'cardano',
  'cosmos',
  'osmosis',
  'celestia',
  'saga-2',
  'dymension',
  'secret',
  'juno-network',
];

// Coin metadata (emoji, symbol)
const COIN_META = {
  'bitcoin':      { symbol: 'BTC',  emoji: '🪙', group: 'major' },
  'ethereum':     { symbol: 'ETH',  emoji: '💎', group: 'major' },
  'cardano':      { symbol: 'ADA',  emoji: '💜', group: 'major' },
  'cosmos':       { symbol: 'ATOM', emoji: '⚛️', group: 'cosmos' },
  'osmosis':      { symbol: 'OSMO', emoji: '🌊', group: 'cosmos' },
  'celestia':     { symbol: 'TIA',  emoji: '✨', group: 'cosmos' },
  'saga-2':       { symbol: 'SAGA', emoji: '⭐', group: 'cosmos' },
  'dymension':    { symbol: 'DYM',  emoji: '💫', group: 'cosmos' },
  'secret':       { symbol: 'SCRT', emoji: '🔒', group: 'cosmos' },
  'juno-network': { symbol: 'JUNO', emoji: '🟣', group: 'cosmos' },
};

/**
 * Fetch prices from CoinGecko
 * @returns {Promise<Array>} Array of coin price objects
 */
async function fetchPrices() {
  const ids = COINGECKO_IDS.join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&price_change_percentage=24h,7d&sparkline=true`;

  console.log('[CoinGecko] Fetching prices...');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CoinGecko API error ${response.status}`);
  }

  const raw = await response.json();

  // Map to clean objects
  const coins = raw.map(c => ({
    id:          c.id,
    symbol:      COIN_META[c.id]?.symbol || c.symbol.toUpperCase(),
    emoji:       COIN_META[c.id]?.emoji  || '🪙',
    group:       COIN_META[c.id]?.group  || 'major',
    rank:        c.market_cap_rank,
    price:       c.current_price,
    change24h:   c.price_change_percentage_24h,
    change7d:    c.price_change_percentage_7d_in_currency,
    high24h:     c.high_24h,
    low24h:      c.low_24h,
    marketCap:   c.market_cap,
    image:      c.image,
    sparkline:  c.sparkline_in_7d?.price || [],
  }));

  console.log(`[CoinGecko] Got prices for ${coins.length} coins`);
  return coins;
}

module.exports = { fetchPrices, COIN_META };
