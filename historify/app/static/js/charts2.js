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
