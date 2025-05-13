/**
 * Charts functionality for Historify app - Part 1: Core Initialization
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const symbolSelector = document.getElementById('symbol-selector');
  const timeframeSelector = document.getElementById('timeframe-selector');
  const chartPlaceholder = document.getElementById('chart-placeholder');
  const tvChartContainer = document.getElementById('tv-chart-container');
  const chartTabs = document.querySelectorAll('[data-chart-type]');
  const autoUpdateToggle = document.getElementById('auto-update-toggle');
  
  // Chart indicators elements
  const maTypeSelect = document.getElementById('ma-type');
  const maPeriodInput = document.getElementById('ma-period');
  const addMaBtn = document.getElementById('add-ma-btn');
  const rsiPeriodInput = document.getElementById('rsi-period');
  const addRsiBtn = document.getElementById('add-rsi-btn');
  const addMacdBtn = document.getElementById('add-macd-btn');
  const activeIndicators = document.getElementById('active-indicators');
  
  // Chart instance and data
  let chart = null;
  let chartData = [];
  let candleSeries = null;
  let activeIndicatorSeries = [];
  let chartType = 'candles';
  let autoUpdateInterval = null;
  
  // Event listeners
  symbolSelector.addEventListener('change', handleSymbolChange);
  timeframeSelector.addEventListener('change', handleTimeframeChange);
  chartTabs.forEach(tab => tab.addEventListener('click', handleChartTypeChange));
  autoUpdateToggle.addEventListener('change', handleAutoUpdateToggle);
  
  // Indicator buttons
  addMaBtn.addEventListener('click', addMovingAverage);
  addRsiBtn.addEventListener('click', addRSI);
  addMacdBtn.addEventListener('click', addMACD);
  
  // Initialize chart if a symbol is selected
  if (symbolSelector.value) {
    handleSymbolChange();
  }
});
