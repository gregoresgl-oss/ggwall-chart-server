/**
 * coingecko.js
 * Fetches price data for all GGWALL coins from CoinGecko API
 * Two calls: one with sparkline, one with volume + ATH
 */

const COINGECKO_IDS = [
  'bitcoin', 'ethereum', 'cardano', 'cosmos', 'osmosis',
  'celestia', 'saga-2', 'dymension', 'secret', 'juno-network',
];

const COIN_META = {
  'bitcoin':      { symbol: 'BTC',  emoji: '🪙', group: 'major'  },
  'ethereum':     { symbol: 'ETH',  emoji: '💎', group: 'major'  },
  'cardano':      { symbol: 'ADA',  emoji: '💜', group: 'major'  },
  'cosmos':       { symbol: 'ATOM', emoji: '⚛️', group: 'cosmos' },
  'osmosis':      { symbol: 'OSMO', emoji: '🌊', group: 'cosmos' },
  'celestia':     { symbol: 'TIA',  emoji: '✨', group: 'cosmos' },
  'saga-2':       { symbol: 'SAGA', emoji: '⭐', group: 'cosmos' },
  'dymension':    { symbol: 'DYM',  emoji: '💫', group: 'cosmos' },
  'secret':       { symbol: 'SCRT', emoji: '🔒', group: 'cosmos' },
  'juno-network': { symbol: 'JUNO', emoji: '🟣', group: 'cosmos' },
};

async function fetchPrices() {
  const ids = COINGECKO_IDS.join(',');

  // Call 1: sparkline data
  const url1 = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&price_change_percentage=24h,7d&sparkline=true`;

  // Call 2: volume + ATH (sparkline=false gives full volume data)
  const url2 = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&price_change_percentage=24h,7d&sparkline=false`;

  console.log('[CoinGecko] Fetching prices (2 calls)...');
  const [res1, res2] = await Promise.all([fetch(url1), fetch(url2)]);

  if (!res1.ok || !res2.ok) throw new Error(`CoinGecko API error`);

  const [raw1, raw2] = await Promise.all([res1.json(), res2.json()]);

  // Build volume + ATH map from second call
  const extraData = {};
  for (const c of raw2) {
    extraData[c.id] = {
      volume24h: c.total_volume,
      ath:       c.ath,
      athChange: c.ath_change_percentage,
    };
  }

  const coins = raw1.map(c => ({
    id:        c.id,
    symbol:    COIN_META[c.id]?.symbol || c.symbol.toUpperCase(),
    emoji:     COIN_META[c.id]?.emoji  || '🪙',
    group:     COIN_META[c.id]?.group  || 'major',
    rank:      c.market_cap_rank,
    price:     c.current_price,
    change24h: c.price_change_percentage_24h,
    change7d:  c.price_change_percentage_7d_in_currency,
    high24h:   c.high_24h,
    low24h:    c.low_24h,
    marketCap: c.market_cap,
    volume24h: extraData[c.id]?.volume24h || 0,
    ath:       extraData[c.id]?.ath || 0,
    athChange: extraData[c.id]?.athChange || 0,
    image:     c.image,
    sparkline: c.sparkline_in_7d?.price || [],
  }));

  console.log(`[CoinGecko] Got prices for ${coins.length} coins`);
  return coins;
}

module.exports = { fetchPrices, COIN_META };

