/**
 * prices-renderer.js
 * Renders GGWALL Prices panel as PNG using Puppeteer
 * v2: Sharp image, coin logos, sparklines, rank colors, aligned layout
 */

const puppeteer = require('puppeteer');

const COLORS = {
  bg:        '#161a2b',
  bgPanel:   '#1c2036',
  bgRow:     '#1e2338',
  green:     '#1baf7a',
  red:       '#e34b48',
  text:      '#888888',
  textLight: '#cccccc',
  textDim:   '#444455',
  border:    'rgba(255,255,255,0.06)',
  gold:      '#e8a030',
  silver:    '#a0a8b8',
  rankGold:  '#f0c040',
  rankSilv:  '#b0b8c8',
  rankBronz: '#c08040',
};

// Rank color based on market cap position
function rankColor(rank) {
  if (rank <= 10)  return COLORS.rankGold;
  if (rank <= 100) return COLORS.rankSilv;
  return COLORS.textDim;
}

// Format price
function formatPrice(p) {
  if (!p) return '$0.00';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)    return '$' + p.toFixed(4);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}

// Format large numbers
function formatLarge(n) {
  if (!n) return 'N/A';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toLocaleString();
}

// Format % change
function formatChange(pct) {
  if (pct == null) return { text: 'N/A', color: COLORS.text, arrow: '' };
  const sign = pct >= 0 ? '+' : '';
  return {
    text:  sign + pct.toFixed(2) + '%',
    color: pct >= 0 ? COLORS.green : COLORS.red,
    arrow: pct >= 0 ? '▲' : '▼',
  };
}

// Build SVG sparkline from sparkline data
function buildSparkline(sparkData, change7d) {
  if (!sparkData || sparkData.length < 2) return '';
  const prices = sparkData.filter(p => p != null);
  if (prices.length < 2) return '';

  const W = 80, H = 28;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((p - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const color = (change7d >= 0) ? COLORS.green : COLORS.red;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  </svg>`;
}

function buildPricesHTML(coins, timestamp) {
  const majorCoins  = coins.filter(c => c.group === 'major');
  const cosmosCoins = coins.filter(c => c.group === 'cosmos');

  function renderCoinRow(coin) {
    const c24 = formatChange(coin.change24h);
    const c7d = formatChange(coin.change7d);
    const rc  = rankColor(coin.rank);
    const sparkSvg = buildSparkline(coin.sparkline, coin.change7d || 0);

    const logoHtml = coin.image
      ? `<img class="coin-logo" src="${coin.image}" alt="${coin.symbol}" onerror="this.style.display='none'">`
      : `<span class="coin-emoji">${coin.emoji}</span>`;

    return `
    <div class="coin-row">
      <div class="row-main">
        <span class="rank" style="color:${rc}">#${coin.rank}</span>
        ${logoHtml}
        <span class="symbol">${coin.symbol}</span>
        <span class="price">${formatPrice(coin.price)}</span>
        <div class="changes">
          <span class="change" style="color:${c24.color}">24h: ${c24.text} ${c24.arrow}</span>
          <span class="change" style="color:${c7d.color}">7d: ${c7d.text} ${c7d.arrow}</span>
        </div>
        <div class="sparkline">${sparkSvg}</div>
      </div>
      <div class="row-meta">
        <span class="meta-item">MCap: <b>${formatLarge(coin.marketCap)}</b></span>
        <span class="meta-item">Vol: <b>${formatLarge(coin.volume24h)}</b></span>
        <span class="meta-item">H: <b style="color:${COLORS.green}">${formatPrice(coin.high24h)}</b></span>
        <span class="meta-item">L: <b style="color:${COLORS.red}">${formatPrice(coin.low24h)}</b></span>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: ${COLORS.bg};
    font-family: 'Courier New', monospace;
    width: 800px;
    overflow: hidden;
  }

  /* Header */
  #header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px 10px;
    border-bottom: 1px solid ${COLORS.border};
  }
  #header-title { color: ${COLORS.textLight}; font-size: 15px; font-weight: bold; letter-spacing: 0.5px; }
  #header-time  { color: ${COLORS.text}; font-size: 11px; }

  /* Group header */
  .group-header {
    padding: 7px 16px 5px;
    font-size: 10px;
    font-weight: bold;
    color: ${COLORS.gold};
    letter-spacing: 2px;
    text-transform: uppercase;
    border-bottom: 1px solid ${COLORS.border};
    background: ${COLORS.bgPanel};
  }

  /* Coin row */
  .coin-row {
    padding: 7px 16px 6px;
    border-bottom: 1px solid ${COLORS.border};
    background: ${COLORS.bg};
  }

  .row-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rank {
    font-size: 10px;
    width: 38px;
    text-align: right;
    flex-shrink: 0;
  }

  .coin-logo {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }
  .coin-emoji { font-size: 16px; flex-shrink: 0; }

  .symbol {
    color: ${COLORS.textLight};
    font-size: 13px;
    font-weight: bold;
    width: 46px;
    flex-shrink: 0;
  }

  .price {
    color: ${COLORS.green};
    font-size: 13px;
    font-weight: bold;
    width: 110px;
    flex-shrink: 0;
  }

  .changes {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }
  .change { font-size: 11px; font-weight: bold; }

  .sparkline {
    width: 80px;
    height: 28px;
    flex-shrink: 0;
    opacity: 0.85;
  }

  .row-meta {
    display: flex;
    gap: 14px;
    padding-left: 48px;
    margin-top: 3px;
  }
  .meta-item { color: ${COLORS.text}; font-size: 10px; }
  .meta-item b { color: ${COLORS.textLight}; }

  /* Divider */
  .group-divider { height: 5px; background: ${COLORS.bgPanel}; }

  /* Footer */
  #footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 16px;
    background: ${COLORS.bgPanel};
    border-top: 1px solid ${COLORS.border};
  }
  #footer-left { display: flex; align-items: center; gap: 6px; }
  .logo {
    width: 18px; height: 18px; border-radius: 50%;
    background: ${COLORS.green}; color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: bold;
  }
  #footer span { color: #555; font-size: 10px; }
</style>
</head>
<body>

<div id="header">
  <div id="header-title">💰 GGWALL Prices</div>
  <div id="header-time">🕐 ${timestamp} UTC</div>
</div>

<div class="group-header">🌍 Major</div>
${majorCoins.map(renderCoinRow).join('')}

<div class="group-divider"></div>

<div class="group-header">⚛️ Cosmos Ecosystem</div>
${cosmosCoins.map(renderCoinRow).join('')}

<div id="footer">
  <div id="footer-left">
    <div class="logo">G</div>
    <span>@GGWALLBot</span>
  </div>
  <span>Powered by GGWALL · Data: CoinGecko</span>
</div>

</body>
</html>`;
}

async function renderPrices(coins) {
  const now = new Date();
  const timestamp = now.toISOString().slice(11, 16);
  const html = buildPricesHTML(coins, timestamp);

  let browser;
  try {
    console.log('[PricesRenderer] Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    // deviceScaleFactor: 2 = double resolution = sharp image
    await page.setViewport({ width: 800, height: 1400, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(resolve => setTimeout(resolve, 500));

    const body = await page.$('body');
    const screenshot = await body.screenshot({ type: 'png' });

    console.log(`[PricesRenderer] Done: ${screenshot.length} bytes`);
    return screenshot;

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { renderPrices };
