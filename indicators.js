/**
 * indicators.js
 * Technical indicator calculations for GGWALL charts
 * All functions return arrays in TradingView Lightweight Charts format: { time, value }
 */

/**
 * Moving Average (MA)
 * @param {Array} candles - OHLC candle array
 * @param {number} period - MA period (e.g. 7, 25)
 * @returns {Array} [{ time, value }]
 */
function calculateMA(candles, period) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue; // Not enough data yet
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    result.push({
      time:  candles[i].time,
      value: parseFloat((sum / period).toFixed(6)),
    });
  }
  return result;
}

/**
 * Bollinger Bands (BB)
 * @param {Array} candles - OHLC candle array
 * @param {number} period - BB period (default: 20)
 * @param {number} multiplier - Standard deviation multiplier (default: 2)
 * @returns {{ upper, middle, lower }} Each is [{ time, value }]
 */
function calculateBB(candles, period = 20, multiplier = 2) {
  const upper = [], middle = [], lower = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;

    const slice = candles.slice(i - period + 1, i + 1).map(c => c.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    const time = candles[i].time;
    upper.push({ time, value: parseFloat((mean + multiplier * sd).toFixed(6)) });
    middle.push({ time, value: parseFloat(mean.toFixed(6)) });
    lower.push({ time, value: parseFloat((mean - multiplier * sd).toFixed(6)) });
  }

  return { upper, middle, lower };
}

/**
 * RSI - Relative Strength Index (Wilder's smoothing)
 * @param {Array} candles - OHLC candle array
 * @param {number} period - RSI period (default: 14)
 * @returns {Array} [{ time, value }]
 */
function calculateRSI(candles, period = 14) {
  const result = [];
  if (candles.length < period + 1) return result;

  // Initial average gain/loss over first `period` candles
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time:  candles[period].time,
    value: parseFloat((100 - 100 / (1 + firstRS)).toFixed(2)),
  });

  // Wilder's smoothing for remaining candles
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({
      time:  candles[i].time,
      value: parseFloat((100 - 100 / (1 + rs)).toFixed(2)),
    });
  }

  return result;
}

/**
 * Alert bands: horizontal lines at ±5% from current price
 * @param {Array} candles - OHLC candle array
 * @param {number} currentPrice - Current/last close price
 * @returns {{ alertUp, alertDown }} Each is [{ time, value }]
 */
function calculateAlerts(candles, currentPrice) {
  const alertUpPrice   = parseFloat((currentPrice * 1.05).toFixed(6));
  const alertDownPrice = parseFloat((currentPrice * 0.95).toFixed(6));

  const alertUp   = candles.map(c => ({ time: c.time, value: alertUpPrice }));
  const alertDown = candles.map(c => ({ time: c.time, value: alertDownPrice }));

  return { alertUp, alertDown, alertUpPrice, alertDownPrice };
}

/**
 * Volume data formatted for TradingView histogram series
 * @param {Array} candles - OHLC candle array
 * @returns {Array} [{ time, value, color }]
 */
function formatVolume(candles) {
  return candles.map(c => ({
    time:  c.time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(27,175,122,0.7)' : 'rgba(227,75,72,0.7)',
  }));
}

/**
 * Calculate all indicators based on requested list
 * @param {Array} candles - OHLC candle array
 * @param {string[]} indicators - e.g. ["ma7","ma25","bb","rsi","alerts"]
 * @returns {Object} All calculated indicator data
 */
function calculateAll(candles, indicators) {
  const result = {};
  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];

  if (indicators.includes('ma7')) {
    result.ma7 = calculateMA(candles, 7);
  }
  if (indicators.includes('ma25')) {
    result.ma25 = calculateMA(candles, 25);
  }
  if (indicators.includes('bb')) {
    result.bb = calculateBB(candles, 20, 2);
  }
  if (indicators.includes('rsi')) {
    result.rsi = calculateRSI(candles, 14);
  }
  if (indicators.includes('alerts')) {
    result.alerts = calculateAlerts(candles, currentPrice);
  }

  // Volume is always included
  result.volume = formatVolume(candles);

  return result;
}

module.exports = { calculateMA, calculateBB, calculateRSI, calculateAlerts, formatVolume, calculateAll };
