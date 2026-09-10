/**
 * chart-renderer.js
 * Renders GGWALL professional charts using TradingView Lightweight Charts in a
 * headless Chromium browser (Puppeteer), then screenshots to PNG.
 *
 * Phase 1: Candlestick + MA7/MA25 + Alert lines → 800×450px
 */

const puppeteer = require('puppeteer');

// Chart color palette (matches GGWALL design)
const COLORS = {
  bg:         '#161a2b',
  bgPanel:    '#1c2036',
  green:      '#1baf7a',
  red:        '#e34b48',
  ma7:        '#e8a030',
  ma25:       '#5ca8e8',
  bb:         '#8878d6',
  rsi:        '#d4a0f0',
  grid:       'rgba(255,255,255,0.05)',
  border:     '#333a52',
  text:       '#888888',
  textLight:  '#cccccc',
};

/**
 * Build the full HTML page that renders the chart
 * Puppeteer will load this and screenshot it.
 */
function buildChartHTML(candles, indicatorData, meta) {
  const { coinLabel, period, indicators } = meta;
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  // Determine which panels to show (Phase 1: always show volume if data exists)
  const showVolume = true; // Always Phase 1+
  const showRSI    = indicators.includes('rsi') && indicatorData.rsi?.length > 0;

  // Chart heights
  const candleHeight = 300;
  const volumeHeight = showVolume ? 90  : 0;
  const rsiHeight    = showRSI   ? 90  : 0;
  const totalHeight  = candleHeight + volumeHeight + rsiHeight + 120; // +120 for header/footer

  // Serialize data for injection into the HTML
  const candlesJSON   = JSON.stringify(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
  const volumeJSON    = JSON.stringify(indicatorData.volume || []);
  const ma7JSON       = JSON.stringify(indicatorData.ma7 || []);
  const ma25JSON      = JSON.stringify(indicatorData.ma25 || []);
  const bbUpperJSON   = JSON.stringify(indicatorData.bb?.upper || []);
  const bbLowerJSON   = JSON.stringify(indicatorData.bb?.lower || []);
  const rsiJSON       = JSON.stringify(indicatorData.rsi || []);
  const alertUpJSON   = JSON.stringify(indicatorData.alerts?.alertUp || []);
  const alertDownJSON = JSON.stringify(indicatorData.alerts?.alertDown || []);

  // Price change % from first to last candle
  const firstClose  = candles[0].close;
  const priceChange = ((currentPrice - firstClose) / firstClose * 100).toFixed(2);
  const changeColor = priceChange >= 0 ? COLORS.green : COLORS.red;
  const changeSign  = priceChange >= 0 ? '+' : '';

  // Format price (auto decimal places based on value)
  const formatPrice = (p) => {
    if (p >= 1000) return p.toFixed(2);
    if (p >= 1)    return p.toFixed(4);
    return p.toFixed(6);
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: ${COLORS.bg};
    font-family: 'Courier New', monospace;
    width: 1200px;
    overflow: hidden;
  }

  /* ── Header ── */
  #header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  #header-left { display: flex; flex-direction: column; gap: 3px; }
  #title { color: ${COLORS.textLight}; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
  #indicators-row { display: flex; gap: 12px; font-size: 10px; }
  .ind-ma7  { color: ${COLORS.ma7}; }
  .ind-ma25 { color: ${COLORS.ma25}; }
  .ind-bb   { color: ${COLORS.bb}; }
  .ind-alert { color: ${COLORS.red}; }
  #current-price { color: ${COLORS.green}; font-size: 20px; font-weight: bold; letter-spacing: 1px; }

  /* ── Charts ── */
  #charts { position: relative; }
  #candlestick-chart { width: 1200px; height: ${candleHeight}px; }
  #volume-chart      { width: 1200px; height: ${volumeHeight}px; ${showVolume ? '' : 'display:none;'} }
  #rsi-chart         { width: 1200px; height: ${rsiHeight}px;    ${showRSI   ? '' : 'display:none;'} }

  /* Panel labels */
  .panel-label {
    position: absolute;
    right: 8px;
    font-size: 9px;
    color: ${COLORS.text};
    z-index: 10;
    pointer-events: none;
  }
  #vol-label { top: ${candleHeight + 4}px; }
  #rsi-label { top: ${candleHeight + volumeHeight + 4}px; }

  /* ── Footer ── */
  #footer {
    background: ${COLORS.bgPanel};
    padding: 8px 14px;
    display: flex;
    gap: 16px;
    align-items: center;
    font-size: 11px;
    color: ${COLORS.text};
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  #footer .val { color: ${COLORS.textLight}; font-weight: bold; }
  #footer .change { color: ${changeColor}; font-weight: bold; }

  /* ── Branding ── */
  #branding {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 14px 8px;
    font-size: 10px;
    color: #555;
  }
  #branding-left { display: flex; align-items: center; gap: 6px; }
  .logo {
    width: 18px; height: 18px; border-radius: 50%;
    background: ${COLORS.green};
    color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: bold;
  }
</style>
</head>
<body>

<!-- Header -->
<div id="header">
  <div id="header-left">
    <div id="title">${coinLabel} · ${period.toUpperCase()} · GGWALL</div>
    <div id="indicators-row">
      ${indicators.includes('ma7')    ? `<span class="ind-ma7">MA7: <span id="ma7-val">---</span></span>` : ''}
      ${indicators.includes('ma25')   ? `<span class="ind-ma25">MA25: <span id="ma25-val">---</span></span>` : ''}
      ${indicators.includes('bb')     ? `<span class="ind-bb">BB(20,2)</span>` : ''}
      ${indicators.includes('alerts') ? `<span class="ind-alert">Alert: +5% / -5%</span>` : ''}
    </div>
  </div>
  <div id="current-price">${formatPrice(currentPrice)}</div>
</div>

<!-- Charts -->
<div id="charts" style="position:relative;">
  <div id="candlestick-chart"></div>
  <div id="volume-chart"></div>
  <div id="rsi-chart"></div>
  ${showVolume ? `<div class="panel-label" id="vol-label">Vol</div>` : ''}
  ${showRSI    ? `<div class="panel-label" id="rsi-label">RSI</div>` : ''}
</div>

<!-- Footer OHLC bar -->
<div id="footer">
  <span>O: <span class="val">${formatPrice(lastCandle.open)}</span></span>
  <span>H: <span class="val">${formatPrice(lastCandle.high)}</span></span>
  <span>L: <span class="val">${formatPrice(lastCandle.low)}</span></span>
  <span>C: <span class="val">${formatPrice(lastCandle.close)}</span></span>
  <span class="change">${changeSign}${priceChange}%</span>
</div>

<!-- Branding -->
<div id="branding">
  <div id="branding-left">
    <div class="logo">G</div>
    <span>@GGWALLBot</span>
  </div>
  <span>Powered by GGWALL</span>
</div>

<script src="https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"></script>
<script>
  // Injected data
  const candleData   = ${candlesJSON};
  const volumeData   = ${volumeJSON};
  const ma7Data      = ${ma7JSON};
  const ma25Data     = ${ma25JSON};
  const bbUpperData  = ${bbUpperJSON};
  const bbLowerData  = ${bbLowerJSON};
  const rsiData      = ${rsiJSON};
  const alertUpData  = ${alertUpJSON};
  const alertDownData= ${alertDownJSON};

  const showVolume = ${showVolume};
  const showRSI    = ${showRSI};

  // Common chart options
  const commonOpts = {
    layout: { background: { color: '${COLORS.bg}' }, textColor: '${COLORS.text}' },
    grid: {
      vertLines: { color: '${COLORS.grid}' },
      horzLines: { color: '${COLORS.grid}' },
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '${COLORS.border}' },
    timeScale: { borderColor: '${COLORS.border}' },
  };

  // ── Candlestick Chart ──
  const candleChart = LightweightCharts.createChart(document.getElementById('candlestick-chart'), {
    ...commonOpts,
    width: 1200,
    height: ${candleHeight},
    timeScale: { borderColor: '${COLORS.border}', visible: ${!showVolume && !showRSI} },
  });

  // Candlesticks
  const candleSeries = candleChart.addCandlestickSeries({
    upColor:        '${COLORS.green}',
    downColor:      '${COLORS.red}',
    borderUpColor:  '${COLORS.green}',
    borderDownColor:'${COLORS.red}',
    wickUpColor:    '${COLORS.green}',
    wickDownColor:  '${COLORS.red}',
  });
  candleSeries.setData(candleData);

  // MA7 (orange)
  if (ma7Data.length > 0) {
    const ma7Series = candleChart.addLineSeries({ color: '${COLORS.ma7}', lineWidth: 2 });
    ma7Series.setData(ma7Data);
    // Update header
    const lastMA7 = ma7Data[ma7Data.length - 1];
    const el = document.getElementById('ma7-val');
    if (el) el.textContent = lastMA7.value.toFixed(4);
  }

  // MA25 (blue)
  if (ma25Data.length > 0) {
    const ma25Series = candleChart.addLineSeries({ color: '${COLORS.ma25}', lineWidth: 1.5 });
    ma25Series.setData(ma25Data);
    const lastMA25 = ma25Data[ma25Data.length - 1];
    const el = document.getElementById('ma25-val');
    if (el) el.textContent = lastMA25.value.toFixed(4);
  }

  // Bollinger Bands (purple dashed)
  if (bbUpperData.length > 0) {
    const bbUpper = candleChart.addLineSeries({
      color: '${COLORS.bb}', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
    });
    bbUpper.setData(bbUpperData);

    const bbLower = candleChart.addLineSeries({
      color: '${COLORS.bb}', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
    });
    bbLower.setData(bbLowerData);
  }

  // Alert +5% (green dotted)
  if (alertUpData.length > 0) {
    const alertUp = candleChart.addLineSeries({
      color: '${COLORS.green}', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      crosshairMarkerVisible: false,
    });
    alertUp.setData(alertUpData);

    const alertDown = candleChart.addLineSeries({
      color: '${COLORS.red}', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      crosshairMarkerVisible: false,
    });
    alertDown.setData(alertDownData);
  }

  // ── Volume Chart ──
  let volumeChart = null;
  if (showVolume) {
    volumeChart = LightweightCharts.createChart(document.getElementById('volume-chart'), {
      ...commonOpts,
      width: 1200,
      height: ${volumeHeight},
      timeScale: { borderColor: '${COLORS.border}', visible: !showRSI },
    });
    const volSeries = volumeChart.addHistogramSeries({ priceFormat: { type: 'volume' } });
    volSeries.setData(volumeData);
  }

  // ── RSI Chart ──
  let rsiChart = null;
  if (showRSI) {
    rsiChart = LightweightCharts.createChart(document.getElementById('rsi-chart'), {
      ...commonOpts,
      width: 1200,
      height: ${rsiHeight},
      rightPriceScale: {
        borderColor: '${COLORS.border}',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { borderColor: '${COLORS.border}', timeVisible: true },
    });

    const rsiSeries = rsiChart.addLineSeries({ color: '${COLORS.rsi}', lineWidth: 1.5 });
    rsiSeries.setData(rsiData);

    // Overbought 70 (red dashed)
    const rsi70Data = rsiData.map(d => ({ time: d.time, value: 70 }));
    const rsi70 = rsiChart.addLineSeries({
      color: '${COLORS.red}', lineWidth: 0.5,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      crosshairMarkerVisible: false,
    });
    rsi70.setData(rsi70Data);

    // Oversold 30 (green dashed)
    const rsi30Data = rsiData.map(d => ({ time: d.time, value: 30 }));
    const rsi30 = rsiChart.addLineSeries({
      color: '${COLORS.green}', lineWidth: 0.5,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      crosshairMarkerVisible: false,
    });
    rsi30.setData(rsi30Data);
  }

  // ── Sync all charts (time axis) ──
  const allCharts = [candleChart, volumeChart, rsiChart].filter(Boolean);
  allCharts.forEach(source => {
    source.timeScale().subscribeVisibleLogicalRangeChange(range => {
      allCharts.forEach(target => {
        if (target !== source) target.timeScale().setVisibleLogicalRange(range);
      });
    });
  });

  // Fit all charts to content
  allCharts.forEach(c => c.timeScale().fitContent());

  // Signal render complete
  window.__CHART_READY__ = true;
</script>
</body>
</html>`;
}

/**
 * Render chart to PNG buffer using Puppeteer
 * @param {Array} candles - OHLC candle array
 * @param {Object} indicatorData - Calculated indicator data
 * @param {Object} meta - { coinLabel, period, indicators }
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderChart(candles, indicatorData, meta) {
  const html = buildChartHTML(candles, indicatorData, meta);

  let browser;
  try {
    console.log('[Renderer] Launching Puppeteer...');
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
    await page.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 1 });

    // Load HTML content
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for TradingView charts to render
    await page.waitForFunction(() => window.__CHART_READY__ === true, { timeout: 15000 });

    // Small extra wait for chart animations to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Screenshot only the chart body (auto-fit to content height)
    const body = await page.$('body');
    const screenshot = await body.screenshot({ type: 'png' });

    console.log(`[Renderer] Screenshot captured: ${screenshot.length} bytes`);
    return screenshot;

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { renderChart };
