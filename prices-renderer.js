/**
 * prices-renderer.js
 * Renders GGWALL Prices panel as PNG using Puppeteer
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
  textDim:   '#555566',
  border:    'rgba(255,255,255,0.06)',
  gold:      '#e8a030',
};

// Format price with smart decimal places
function formatPrice(p) {
  if (!p) return '$0.00';
  if (p >= 1000)  return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)     return '$' + p.toFixed(4);
  if (p >= 0.01)  return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}

// Format large numbers (market cap, volume)
function formatLarge(n) {
  if (!n) return 'N/A';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toLocaleString();
}

// Format % change
function formatChange(pct) {
  if (pct == null) return { text: 'N/A', color: COLORS.text };
  const sign = pct >= 0 ? '+' : '';
  return {
    text:  sign + pct.toFixed(2) + '%',
    color: pct >= 0 ? COLORS.green : COLORS.red,
    arrow: pct >= 0 ? '▲' : '▼',
  };
}

function buildPricesHTML(coins, timestamp) {
  const majorCoins  = coins.filter(c => c.group === 'major');
  const cosmosCoins = coins.filter(c => c.group === 'cosmos');

  function renderCoinRow(coin) {
    const c24  = formatChange(coin.change24h);
    const c7d  = formatChange(coin.change7d);
    return `
    <div class="coin-row">
      <div class="coin-left">
        <span class="rank">#${coin.rank}</span>
        <span class="emoji">${coin.emoji}</span>
        <span class="symbol">${coin.symbol}</span>
        <span class="price">${formatPrice(coin.price)}</span>
      </div>
      <div class="coin-right">
        <span class="change" style="color:${c24.color}">24h: ${c24.text} ${c24.arrow}</span>
        <span class="change" style="color:${c7d.color}">7d: ${c7d.text} ${c7d.arrow}</span>
      </div>
      <div class="coin-meta">
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
  #header-title {
    color: ${COLORS.textLight};
    font-size: 15px;
    font-weight: bold;
    letter-spacing: 0.5px;
  }
  #header-time {
    color: ${COLORS.text};
    font-size: 11px;
  }

  /* Group header */
  .group-header {
    padding: 8px 16px 6px;
    font-size: 11px;
    font-weight: bold;
    color: ${COLORS.gold};
    letter-spacing: 1px;
    border-bottom: 1px solid ${COLORS.border};
    background: ${COLORS.bgPanel};
  }

  /* Coin row */
  .coin-row {
    padding: 8px 16px;
    border-bottom: 1px solid ${COLORS.border};
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: ${COLORS.bg};
  }
  .coin-row:hover { background: ${COLORS.bgRow}; }

  .coin-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rank   { color: ${COLORS.textDim}; font-size: 11px; width: 32px; }
  .emoji  { font-size: 14px; }
  .symbol { color: ${COLORS.textLight}; font-size: 13px; font-weight: bold; width: 50px; }
  .price  { color: ${COLORS.green}; font-size: 14px; font-weight: bold; margin-left: 4px; }

  .coin-right {
    display: flex;
    gap: 20px;
    padding-left: 90px;
  }
  .change { font-size: 12px; font-weight: bold; }

  .coin-meta {
    display: flex;
    gap: 16px;
    padding-left: 90px;
  }
  .meta-item { color: ${COLORS.text}; font-size: 10px; }
  .meta-item b { color: ${COLORS.textLight}; }

  /* Divider between groups */
  .group-divider { height: 6px; background: ${COLORS.bgPanel}; }

  /* Footer */
  #footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: ${COLORS.bgPanel};
    border-top: 1px solid ${COLORS.border};
  }
  #footer-left { display: flex; align-items: center; gap: 6px; }
  .logo {
    width: 18px; height: 18px; border-radius: 50%;
    background: ${COLORS.green};
    color: white;
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

<div class="group-header">🌍 MAJOR</div>
${majorCoins.map(renderCoinRow).join('')}

<div class="group-divider"></div>

<div class="group-header">⚛️ COSMOS ECOSYSTEM</div>
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
  const timestamp = now.toISOString().slice(11, 16); // HH:MM

  const html = buildPricesHTML(coins, timestamp);

  let browser;
  try {
    console.log('[PricesRenderer] Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 300));

    const body = await page.$('body');
    const screenshot = await body.screenshot({ type: 'png' });

    console.log(`[PricesRenderer] Done: ${screenshot.length} bytes`);
    return screenshot;

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { renderPrices };
