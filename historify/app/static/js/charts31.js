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
