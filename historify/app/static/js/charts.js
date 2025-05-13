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

/**
 * Charts functionality for Historify app - Part 2: Functions for Chart Handling
 */

/**
 * Handle symbol change
 */
function handleSymbolChange() {
    const symbol = symbolSelector.value;
    const timeframe = timeframeSelector.value;
    
    if (!symbol) return;
    
    // Update URL for better sharing/bookmarking
    const url = new URL(window.location);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('timeframe', timeframe);
    window.history.replaceState({}, '', url);
    
    // Fetch and display chart data
    fetchChartData(symbol, timeframe);
  }
  
  /**
   * Handle timeframe change
   */
  function handleTimeframeChange() {
    const symbol = symbolSelector.value;
    const timeframe = timeframeSelector.value;
    
    if (!symbol) return;
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('timeframe', timeframe);
    window.history.replaceState({}, '', url);
    
    // Fetch and display chart data
    fetchChartData(symbol, timeframe);
  }
  
  /**
   * Handle chart type change
   */
  function handleChartTypeChange(event) {
    // Update active tab
    chartTabs.forEach(tab => tab.classList.remove('tab-active'));
    event.currentTarget.classList.add('tab-active');
    
    // Get selected chart type
    chartType = event.currentTarget.getAttribute('data-chart-type');
    
    // Update chart if it exists
    if (chart && candleSeries) {
      // Remove existing series
      chart.removeSeries(candleSeries);
      
      // Add new series based on type
      switch (chartType) {
        case 'line':
          candleSeries = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            priceLineVisible: true,
          });
          
          // Convert OHLC data to line data (use close prices)
          const lineData = chartData.map(item => ({
            time: item.time,
            value: item.close
          }));
          
          candleSeries.setData(lineData);
          break;
          
        case 'area':
          candleSeries = chart.addAreaSeries({
            topColor: 'rgba(41, 98, 255, 0.3)',
            bottomColor: 'rgba(41, 98, 255, 0.05)',
            lineColor: '#2962FF',
            lineWidth: 2
          });
          
          // Convert OHLC data to area data (use close prices)
          const areaData = chartData.map(item => ({
            time: item.time,
            value: item.close
          }));
          
          candleSeries.setData(areaData);
          break;
          
        default: // candles
          candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
          });
          
          candleSeries.setData(chartData);
      }
      
      // Re-add indicators
      redrawIndicators();
    }
  }
  
  /**
   * Handle auto update toggle
   */
  function handleAutoUpdateToggle() {
    const isEnabled = autoUpdateToggle.checked;
    
    if (isEnabled) {
      // Enable auto-update (every 30 seconds)
      autoUpdateInterval = setInterval(() => {
        const symbol = symbolSelector.value;
        const timeframe = timeframeSelector.value;
        
        if (symbol) {
          fetchChartData(symbol, timeframe, true);
        }
      }, 30000);
    } else {
      // Disable auto-update
      if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
      }
    }
  }
  
  /**
   * Fetch chart data from the API
   */
  function fetchChartData(symbol, timeframe, isUpdate = false) {
    // Show loading state if not an update
    if (!isUpdate) {
      chartPlaceholder.style.display = 'flex';
      tvChartContainer.style.display = 'none';
      chartPlaceholder.innerHTML = `
        <div class="text-center">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="mt-4">Loading chart data for ${symbol}...</p>
        </div>
      `;
    }
    
    // Calculate default date range based on timeframe
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '1m':
      case '5m':
      case '15m':
        startDate.setDate(endDate.getDate() - 7); // 1 week for minute data
        break;
      case '30m':
      case '1h':
        startDate.setDate(endDate.getDate() - 30); // 1 month for hour data
        break;
      case '1w':
        startDate.setFullYear(endDate.getFullYear() - 2); // 2 years for weekly data
        break;
      default: // 1d
        startDate.setFullYear(endDate.getFullYear() - 1); // 1 year for daily data
    }
    
    const startDateString = startDate.toISOString().split('T')[0];
    const endDateString = endDate.toISOString().split('T')[0];
    
    // Fetch data from the API
    fetch(`/api/data?symbol=${symbol}&start_date=${startDateString}&end_date=${endDateString}&timeframe=${timeframe}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }
        return response.json();
      })
      .then(data => {
        // Store chart data
        chartData = data;
        
        // Initialize or update chart
        if (!chart) {
          initializeChart(data);
        } else if (isUpdate) {
          updateChartData(data);
        } else {
          resetChart(data);
        }
        
        // Update data summary
        updateDataSummary(symbol, data);
        
        // Hide placeholder, show chart
        chartPlaceholder.style.display = 'none';
        tvChartContainer.style.display = 'block';
      })
      .catch(error => {
        console.error('Error fetching chart data:', error);
        chartPlaceholder.innerHTML = `
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="mt-4">Failed to load chart data</p>
            <p class="text-sm text-gray-500 mt-2">${error.message}</p>
            <button class="btn btn-primary mt-4" onclick="handleSymbolChange()">Try Again</button>
          </div>
        `;
      });
  }

  
/**
 * Charts functionality for Historify app - Part 3.1: Chart Initialization & Core Utilities
 */

/**
 * Initialize the chart with data
 */
function initializeChart(data) {
    // Create chart
    chart = LightweightCharts.createChart(tvChartContainer, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: getComputedStyle(document.documentElement).getPropertyValue('--text-base-content').trim() || '#333'
      },
      grid: {
        vertLines: { color: 'rgba(120, 120, 120, 0.15)' },
        horzLines: { color: 'rgba(120, 120, 120, 0.15)' }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(120, 120, 120, 0.3)'
      },
      rightPriceScale: {
        borderColor: 'rgba(120, 120, 120, 0.3)'
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal
      },
      width: tvChartContainer.clientWidth,
      height: tvChartContainer.clientHeight
    });
    
    // Add series based on chart type
    switch (chartType) {
      case 'line':
        candleSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          priceLineVisible: true,
        });
        
        // Convert OHLC data to line data (use close prices)
        const lineData = data.map(item => ({
          time: item.time,
          value: item.close
        }));
        
        candleSeries.setData(lineData);
        break;
        
      case 'area':
        candleSeries = chart.addAreaSeries({
          topColor: 'rgba(41, 98, 255, 0.3)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
          lineColor: '#2962FF',
          lineWidth: 2
        });
        
        // Convert OHLC data to area data (use close prices)
        const areaData = data.map(item => ({
          time: item.time,
          value: item.close
        }));
        
        candleSeries.setData(areaData);
        break;
        
      default: // candles
        candleSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350'
        });
        
        candleSeries.setData(data);
    }
    
    // Handle resize
    window.addEventListener('resize', handleResize);
    
    // Set up auto-update if enabled
    if (autoUpdateToggle.checked) {
      handleAutoUpdateToggle();
    }
  }
  
  /**
   * Update chart data (for real-time updates)
   */
  function updateChartData(newData) {
    if (!chart || !candleSeries || !newData.length) return;
    
    // Check if we have new data points
    const lastKnownTime = chartData.length > 0 ? chartData[chartData.length - 1].time : 0;
    const newDataPoints = newData.filter(item => item.time > lastKnownTime);
    
    if (newDataPoints.length === 0) return;
    
    // Add new data points
    if (chartType === 'line' || chartType === 'area') {
      newDataPoints.forEach(item => {
        candleSeries.update({
          time: item.time,
          value: item.close
        });
      });
    } else {
      newDataPoints.forEach(item => {
        candleSeries.update(item);
      });
    }
    
    // Update stored chart data
    chartData = [...chartData, ...newDataPoints];
    
    // Update indicators
    updateIndicators(newDataPoints);
  }
  
  /**
   * Reset chart with new data
   */
  function resetChart(data) {
    if (!chart) return;
    
    // Remove existing series
    if (candleSeries) {
      chart.removeSeries(candleSeries);
    }
    
    // Remove all indicator series
    activeIndicatorSeries.forEach(series => {
      chart.removeSeries(series.series);
    });
    
    // Clear active indicators
    activeIndicatorSeries = [];
    activeIndicators.innerHTML = '<span class="badge badge-outline">No active indicators</span>';
    
    // Add new series based on chart type
    switch (chartType) {
      case 'line':
        candleSeries = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          priceLineVisible: true,
        });
        
        // Convert OHLC data to line data (use close prices)
        const lineData = data.map(item => ({
          time: item.time,
          value: item.close
        }));
        
        candleSeries.setData(lineData);
        break;
        
      case 'area':
        candleSeries = chart.addAreaSeries({
          topColor: 'rgba(41, 98, 255, 0.3)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
          lineColor: '#2962FF',
          lineWidth: 2
        });
        
        // Convert OHLC data to area data (use close prices)
        const areaData = data.map(item => ({
          time: item.time,
          value: item.close
        }));
        
        candleSeries.setData(areaData);
        break;
        
      default: // candles
        candleSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350'
        });
        
        candleSeries.setData(data);
    }
  }
  
  /**
   * Handle window resize
   */
  function handleResize() {
    if (chart) {
      chart.resize(
        tvChartContainer.clientWidth,
        tvChartContainer.clientHeight
      );
    }
  }
  
  /**
   * Format date for display
   */
  function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  }
  
  /**
   * Simple Moving Average calculation
   */
  function calculateSMA(data, period) {
    const sma = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push({ time: data[i].time, value: null });
        continue;
      }
      
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      
      sma.push({
        time: data[i].time,
        value: sum / period
      });
    }
    
    return sma;
  }
  
  /**
 * Charts functionality for Historify app - Part 3.2: Indicators & Data Summary
 */

/**
 * Add a Moving Average indicator to the chart
 */
function addMovingAverage() {
    if (!chart || !candleSeries || !chartData.length) return;
    
    const type = maTypeSelect.value; // 'sma' or 'ema'
    const period = parseInt(maPeriodInput.value);
    
    if (isNaN(period) || period < 1) {
      showToast('error', 'Please enter a valid period');
      return;
    }
    
    // Check if this indicator already exists
    const existingIndex = activeIndicatorSeries.findIndex(
      ind => ind.type === type && ind.params.period === period
    );
    
    if (existingIndex >= 0) {
      showToast('warning', `${type.toUpperCase()}(${period}) is already active`);
      return;
    }
    
    // Calculate indicator values
    let data;
    if (type === 'sma') {
      data = calculateSMA(chartData, period);
    } else { // EMA
      data = calculateEMA(chartData, period);
    }
    
    // Add line series for the indicator
    const series = chart.addLineSeries({
      color: getRandomColor(),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: `${type.toUpperCase()}(${period})`,
      pane: 0
    });
    
    series.setData(data);
    
    // Add to active indicators
    const indicatorId = `${type}-${period}-${Date.now()}`;
    activeIndicatorSeries.push({
      id: indicatorId,
      type: type,
      series: series,
      params: { period }
    });
    
    // Update active indicators display
    updateActiveIndicatorsDisplay();
  }
  
  /**
   * Add RSI indicator to the chart
   */
  function addRSI() {
    if (!chart || !candleSeries || !chartData.length) return;
    
    const period = parseInt(rsiPeriodInput.value);
    
    if (isNaN(period) || period < 1) {
      showToast('error', 'Please enter a valid period');
      return;
    }
    
    // Check if RSI already exists
    const existingIndex = activeIndicatorSeries.findIndex(
      ind => ind.type === 'rsi'
    );
    
    if (existingIndex >= 0) {
      showToast('warning', 'RSI indicator is already active');
      return;
    }
    
    // Calculate RSI
    const rsiData = calculateRSI(chartData, period);
    
    // Add separate pane for RSI
    const rsiSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      pane: 1,
      title: `RSI(${period})`,
      priceFormat: {
        type: 'custom',
        minMove: 0.01,
        formatter: value => Math.round(value * 100) / 100
      }
    });
    
    rsiSeries.setData(rsiData);
    
    // Add to active indicators
    const indicatorId = `rsi-${period}-${Date.now()}`;
    activeIndicatorSeries.push({
      id: indicatorId,
      type: 'rsi',
      series: rsiSeries,
      params: { period }
    });
    
    // Update active indicators display
    updateActiveIndicatorsDisplay();
  }
  
  /**
   * Add MACD indicator to the chart
   */
  function addMACD() {
    if (!chart || !candleSeries || !chartData.length) return;
    
    // Check if MACD already exists
    const existingIndex = activeIndicatorSeries.findIndex(
      ind => ind.type === 'macd'
    );
    
    if (existingIndex >= 0) {
      showToast('warning', 'MACD indicator is already active');
      return;
    }
    
    // Default MACD parameters
    const fastPeriod = 12;
    const slowPeriod = 26;
    const signalPeriod = 9;
    
    // Calculate MACD
    const macdData = calculateMACD(chartData, fastPeriod, slowPeriod, signalPeriod);
    
    // Add separate pane for MACD
    const macdLineSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      pane: 1,
      title: 'MACD Line',
      priceFormat: {
        type: 'custom',
        minMove: 0.01,
        formatter: value => Math.round(value * 100) / 100
      }
    });
    
    const signalLineSeries = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      pane: 1,
      title: 'Signal Line',
      priceFormat: {
        type: 'custom',
        minMove: 0.01,
        formatter: value => Math.round(value * 100) / 100
      }
    });
    
    const histogramSeries = chart.addHistogramSeries({
      pane: 1,
      title: 'Histogram',
      priceFormat: {
        type: 'custom',
        minMove: 0.01,
        formatter: value => Math.round(value * 100) / 100
      }
    });
    
    // Set series data
    macdLineSeries.setData(macdData.macdLine);
    signalLineSeries.setData(macdData.signalLine);
    histogramSeries.setData(macdData.histogram);
    
    // Add to active indicators
    const indicatorId = `macd-${Date.now()}`;
    activeIndicatorSeries.push({
      id: indicatorId,
      type: 'macd',
      series: [macdLineSeries, signalLineSeries, histogramSeries],
      params: { fastPeriod, slowPeriod, signalPeriod }
    });
    
    // Update active indicators display
    updateActiveIndicatorsDisplay();
  }
  
  /**
   * Update active indicators display
   */
  function updateActiveIndicatorsDisplay() {
    if (activeIndicatorSeries.length === 0) {
      activeIndicators.innerHTML = '<span class="badge badge-outline">No active indicators</span>';
      return;
    }
    
    let html = '';
    activeIndicatorSeries.forEach(indicator => {
      let title = '';
      
      switch (indicator.type) {
        case 'sma':
          title = `SMA(${indicator.params.period})`;
          break;
        case 'ema':
          title = `EMA(${indicator.params.period})`;
          break;
        case 'rsi':
          title = `RSI(${indicator.params.period})`;
          break;
        case 'macd':
          title = 'MACD(12,26,9)';
          break;
      }
      
      html += `
        <div class="badge badge-primary gap-2">
          ${title}
          <svg onclick="removeIndicator('${indicator.id}')" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
            class="inline-block w-4 h-4 stroke-current cursor-pointer">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
      `;
    });
    
    activeIndicators.innerHTML = html;
  }
  
  /**
   * Remove indicator from chart
   */
  function removeIndicator(indicatorId) {
    const index = activeIndicatorSeries.findIndex(ind => ind.id === indicatorId);
    
    if (index < 0) return;
    
    const indicator = activeIndicatorSeries[index];
    
    // Remove series from chart
    if (Array.isArray(indicator.series)) {
      indicator.series.forEach(series => chart.removeSeries(series));
    } else {
      chart.removeSeries(indicator.series);
    }
    
    // Remove from active indicators list
    activeIndicatorSeries.splice(index, 1);
    
    // Update display
    updateActiveIndicatorsDisplay();
  }
  
  /**
   * Update indicators with new data points
   */
  function updateIndicators(newDataPoints) {
    if (!activeIndicatorSeries.length || !newDataPoints.length) return;
    
    // For each indicator, recalculate and update
    activeIndicatorSeries.forEach(indicator => {
      switch (indicator.type) {
        case 'sma':
          const smaData = calculateSMA(chartData, indicator.params.period);
          const lastSmaPoint = smaData[smaData.length - 1];
          indicator.series.update(lastSmaPoint);
          break;
        case 'ema':
          const emaData = calculateEMA(chartData, indicator.params.period);
          const lastEmaPoint = emaData[emaData.length - 1];
          indicator.series.update(lastEmaPoint);
          break;
        // Other indicators would be handled similarly
      }
    });
  }
  
  /**
   * Redraw all indicators (used when chart type changes)
   */
  function redrawIndicators() {
    if (!activeIndicatorSeries.length) return;
    
    // Make a copy of indicators before clearing them
    const indicators = [...activeIndicatorSeries];
    
    // Remove all indicators
    activeIndicatorSeries.forEach(indicator => {
      if (Array.isArray(indicator.series)) {
        indicator.series.forEach(series => chart.removeSeries(series));
      } else {
        chart.removeSeries(indicator.series);
      }
    });
    
    activeIndicatorSeries = [];
    
    // Re-add each indicator
    indicators.forEach(indicator => {
      switch (indicator.type) {
        case 'sma':
          // Re-add SMA with same params
          const period = indicator.params.period;
          maTypeSelect.value = 'sma';
          maPeriodInput.value = period;
          addMovingAverage();
          break;
        case 'ema':
          // Re-add EMA with same params
          const emaPeriod = indicator.params.period;
          maTypeSelect.value = 'ema';
          maPeriodInput.value = emaPeriod;
          addMovingAverage();
          break;
        case 'rsi':
          // Re-add RSI with same params
          rsiPeriodInput.value = indicator.params.period;
          addRSI();
          break;
        case 'macd':
          // Re-add MACD
          addMACD();
          break;
      }
    });
  }
  
  /**
   * Update data summary table
   */
  function updateDataSummary(symbol, data) {
    const dataSummaryTable = document.getElementById('data-summary-table');
    
    if (!dataSummaryTable) return;
    
    if (!data || data.length === 0) {
      dataSummaryTable.innerHTML = `
        <tr>
          <td colspan="4" class="text-center">
            <span>No data available</span>
          </td>
        </tr>
      `;
      return;
    }
    
    // Find date range
    const firstPoint = data[0];
    const lastPoint = data[data.length - 1];
    
    const firstDate = formatDate(firstPoint.time);
    const lastDate = formatDate(lastPoint.time);
    
    dataSummaryTable.innerHTML = `
      <tr>
        <td>${symbol}</td>
        <td>${firstDate} to ${lastDate}</td>
        <td>${data.length.toLocaleString()}</td>
        <td>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</td>
      </tr>
    `;
  }
  
  /**
   * Calculate EMA (Exponential Moving Average)
   */
  function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const emaData = [];
    let ema = 0;
    
    for (let i = 0; i < data.length; i++) {
      const close = data[i].close;
      
      if (i < period - 1) {
        emaData.push({ time: data[i].time, value: null });
        continue;
      }
      
      if (i === period - 1) {
        // First EMA uses SMA as seed value
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        ema = sum / period;
      } else {
        // EMA formula: EMA = Price(t) * k + EMA(y) * (1 - k)
        ema = close * k + ema * (1 - k);
      }
      
      emaData.push({
        time: data[i].time,
        value: ema
      });
    }
    
    return emaData;
  }
  
  /**
   * Calculate RSI (Relative Strength Index)
   */
  function calculateRSI(data, period) {
    const rsiData = [];
    let gains = 0;
    let losses = 0;
    
    // Push null for the first `period` data points
    for (let i = 0; i < period; i++) {
      rsiData.push({ time: data[i].time, value: null });
    }
    
    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change >= 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calculate RSI for the rest of the data
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      
      // Update average gain and loss
      avgGain = ((avgGain * (period - 1)) + (change >= 0 ? change : 0)) / period;
      avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? Math.abs(change) : 0)) / period;
      
      // Calculate RS and RSI
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      rsiData.push({
        time: data[i].time,
        value: rsi
      });
    }
    
    return rsiData;
  }
  
  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  function calculateMACD(data, fastPeriod, slowPeriod, signalPeriod) {
    // Calculate fast EMA
    const fastEMA = calculateEMA(data, fastPeriod);
    
    // Calculate slow EMA
    const slowEMA = calculateEMA(data, slowPeriod);
    
    // Calculate MACD line (fast EMA - slow EMA)
    const macdLine = [];
    for (let i = 0; i < data.length; i++) {
      const fastValue = fastEMA[i].value;
      const slowValue = slowEMA[i].value;
      
      if (fastValue === null || slowValue === null) {
        macdLine.push({
          time: data[i].time,
          value: null
        });
        continue;
      }
      
      macdLine.push({
        time: data[i].time,
        value: fastValue - slowValue
      });
    }
    
    // Calculate signal line (9-period EMA of MACD line)
    const signalLine = [];
    let signalEma = null;
    
    for (let i = 0; i < macdLine.length; i++) {
      if (i < slowPeriod + signalPeriod - 2) {
        signalLine.push({
          time: data[i].time,
          value: null
        });
        continue;
      }
      
      if (signalEma === null) {
        // Calculate first signal value (SMA of MACD line for signal period)
        let sum = 0;
        let count = 0;
        
        for (let j = 0; j < signalPeriod; j++) {
          const macdValue = macdLine[i - j].value;
          if (macdValue !== null) {
            sum += macdValue;
            count++;
          }
        }
        
        signalEma = sum / count;
      } else {
        // EMA calculation for signal line
        const k = 2 / (signalPeriod + 1);
        signalEma = macdLine[i].value * k + signalEma * (1 - k);
      }
      
      signalLine.push({
        time: data[i].time,
        value: signalEma
      });
    }
    
    // Calculate histogram (MACD line - signal line)
    const histogram = [];
    
    for (let i = 0; i < data.length; i++) {
      const macdValue = macdLine[i].value;
      const signalValue = signalLine[i].value;
      
      if (macdValue === null || signalValue === null) {
        histogram.push({
          time: data[i].time,
          value: null,
          color: 'rgba(0, 0, 0, 0)'
        });
        continue;
      }
      
      const histValue = macdValue - signalValue;
      const color = histValue >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)';
      
      histogram.push({
        time: data[i].time,
        value: histValue,
        color
      });
    }
    
    return {
      macdLine,
      signalLine,
      histogram
    };
  }
  
  /**
   * Get a random color for indicators
   */
  function getRandomColor() {
    const colors = [
      '#2962FF', // blue
      '#FF6D00', // orange
      '#2e7d32', // green
      '#d32f2f', // red
      '#9c27b0', // purple
      '#00796b', // teal
      '#f57c00', // deep orange
      '#607d8b'  // blue gray
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Show a toast notification
   */
  function showToast(type, message) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast toast-top toast-end z-50';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} mb-2`;
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        ${type === 'success' 
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'}
      </svg>
      <span>${message}</span>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
  