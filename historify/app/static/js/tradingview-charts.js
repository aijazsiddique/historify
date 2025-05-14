/**
 * TradingView Charts Implementation for Historify
 * This file implements TradingView charts with synchronized indicators
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if dark mode is active
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    // DOM Elements
    const symbolSelector = document.getElementById('symbol-selector');
    const exchangeSelector = document.getElementById('exchange-selector');
    const timeframeSelector = document.getElementById('timeframe-selector');
    const emaPeriodInput = document.getElementById('ema-period');
    const rsiPeriodInput = document.getElementById('rsi-period');
    const fetchDataBtn = document.getElementById('fetch-data-btn');
    const autoUpdateToggle = document.getElementById('auto-update-toggle');
    const dataSummary = document.getElementById('data-summary');
    
    // Indicator elements
    const emaIndicator = document.getElementById('ema-indicator');
    const rsiIndicator = document.getElementById('rsi-indicator');
    const emaPeriodLabel = document.getElementById('ema-period-label');
    const rsiPeriodLabel = document.getElementById('rsi-period-label');
    
    // Chart containers
    const chartContainer = document.getElementById('chart');
    const rsiContainer = document.getElementById('rsiChart');
    
    // Chart instances
    let mainChart = null;
    let rsiChart = null;
    
    // Series instances
    let candleSeries = null;
    let emaSeries = null;
    let rsiSeries = null;
    
    // Data
    let chartData = [];
    let autoUpdateInterval = null;
    
    // Chart options
    const chartOptions = {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        layout: {
            background: { type: 'solid', color: isDarkMode ? '#1f2937' : 'white' },
            textColor: isDarkMode ? '#f3f4f6' : '#1f2937',
            fontFamily: 'Inter, sans-serif',
        },
        grid: {
            vertLines: {
                color: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                style: 1, // Solid line style
            },
            horzLines: {
                color: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                style: 1, // Solid line style
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                color: isDarkMode ? 'rgba(156, 163, 175, 0.5)' : 'rgba(75, 85, 99, 0.3)',
                width: 1,
                style: 2, // Dashed line
            },
            horzLine: {
                color: isDarkMode ? 'rgba(156, 163, 175, 0.5)' : 'rgba(75, 85, 99, 0.3)',
                width: 1,
                style: 2, // Dashed line
            },
        },
        rightPriceScale: {
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            scaleMargins: {
                top: 0.1, 
                bottom: 0.2,
            },
        },
        timeScale: {
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            timeVisible: true,
            secondsVisible: false,
            // Format timestamps correctly
            localization: {
                timeFormatter: (timestamp) => {
                    const date = new Date(timestamp * 1000);
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                },
                dateFormatter: (timestamp) => {
                    const date = new Date(timestamp * 1000);
                    return date.toLocaleDateString();
                },
            },
        },
    };
    
    // RSI chart options
    const rsiChartOptions = {
        ...chartOptions,
        width: rsiContainer.clientWidth,
        height: rsiContainer.clientHeight,
        rightPriceScale: {
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        },
    };
    
    // Initialize charts
    function initializeCharts() {
        try {
            console.log('Initializing charts with LightweightCharts version:', LightweightCharts.version);
            
            // Create main chart
            mainChart = LightweightCharts.createChart(chartContainer, chartOptions);
            
            // Create RSI chart
            rsiChart = LightweightCharts.createChart(rsiContainer, rsiChartOptions);
            
            // Add candlestick series - using the correct API for version 3.8.0
            candleSeries = mainChart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });
            
            // Add EMA series
            emaSeries = mainChart.addLineSeries({
                color: '#2962FF',
                lineWidth: 2,
                priceLineVisible: false,
            });
            
            // Add RSI series
            rsiSeries = rsiChart.addLineSeries({
                color: '#f44336',
                lineWidth: 2,
                priceLineVisible: false,
            });
            
            console.log('Charts initialized successfully');
            showToast('success', 'Charts initialized successfully');
        } catch (error) {
            console.error('Error initializing charts:', error);
            showToast('error', 'Failed to initialize charts: ' + error.message);
        }
        
        // Add reference lines for RSI
        const rsiOverSold = rsiChart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.3)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            priceLineVisible: false,
        });
        
        const rsiOverBought = rsiChart.addLineSeries({
            color: 'rgba(41, 98, 255, 0.3)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            priceLineVisible: false,
        });
        
        // Add reference lines at 30 and 70
        rsiOverSold.setData([
            { time: { year: 2000, month: 1, day: 1 }, value: 30 },
            { time: { year: 2050, month: 1, day: 1 }, value: 30 },
        ]);
        
        rsiOverBought.setData([
            { time: { year: 2000, month: 1, day: 1 }, value: 70 },
            { time: { year: 2050, month: 1, day: 1 }, value: 70 },
        ]);
        
        // Simple crosshair synchronization - just pass the time value
        mainChart.subscribeCrosshairMove((param) => {
            if (!param || !param.time) {
                return;
            }
            
            // No need to try to sync the crosshair directly - the logical range sync will handle it
        });
        
        rsiChart.subscribeCrosshairMove((param) => {
            if (!param || !param.time) {
                return;
            }
            
            // No need to try to sync the crosshair directly - the logical range sync will handle it
        });
        
        // Sync visible logical range between charts (using the approach from the sample code)
        function syncVisibleLogicalRange(chart1, chart2) {
            chart1.timeScale().subscribeVisibleLogicalRangeChange(logicalRange => {
                if (logicalRange && chart2) {
                    try {
                        chart2.timeScale().setVisibleLogicalRange(logicalRange);
                    } catch (error) {
                        console.error('Error syncing logical ranges:', error);
                    }
                }
            });
            
            chart2.timeScale().subscribeVisibleLogicalRangeChange(logicalRange => {
                if (logicalRange && chart1) {
                    try {
                        chart1.timeScale().setVisibleLogicalRange(logicalRange);
                    } catch (error) {
                        console.error('Error syncing logical ranges:', error);
                    }
                }
            });
        }
        
        // Apply synchronization
        syncVisibleLogicalRange(mainChart, rsiChart);
        
        // Handle window resize
        window.addEventListener('resize', handleResize);
    }
    
    // Handle window resize
    function handleResize() {
        if (mainChart && rsiChart) {
            mainChart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
            rsiChart.resize(rsiContainer.clientWidth, rsiContainer.clientHeight);
        }
    }
    
    // Fetch chart data from the server
    async function fetchChartData() {
        try {
            // Show loading state
            showLoading(true);
            
            // Map interval values to API format if needed
            let apiInterval = timeframeSelector.value;
            if (apiInterval === 'D') apiInterval = '1d';
            if (apiInterval === 'W') apiInterval = '1w';
            
            // Fetch data from API
            const response = await fetch(`/charts/api/chart-data/${symbolSelector.value}/${exchangeSelector.value}/${apiInterval}/${emaPeriodInput.value}/${rsiPeriodInput.value}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Process and display data
            if (data.candlestick && data.candlestick.length > 0) {
                // Store chart data
                chartData = data.candlestick;
                
                // Update candlestick series
                if (candleSeries) {
                    candleSeries.setData(data.candlestick);
                } else {
                    console.error('Candlestick series not initialized');
                    showToast('error', 'Chart not properly initialized. Please refresh the page.');
                    return;
                }
                
                // Update EMA series
                if (data.ema && data.ema.length > 0 && emaSeries) {
                    emaSeries.setData(data.ema);
                    document.getElementById('ema-indicator').style.display = 'inline-flex';
                } else if (emaSeries) {
                    emaSeries.setData([]);
                    document.getElementById('ema-indicator').style.display = 'none';
                }
                
                // Update RSI series
                if (data.rsi && data.rsi.length > 0 && rsiSeries) {
                    rsiSeries.setData(data.rsi);
                    document.getElementById('rsi-container').style.display = 'block';
                    document.getElementById('rsi-indicator').style.display = 'inline-flex';
                } else if (rsiSeries) {
                    rsiSeries.setData([]);
                    document.getElementById('rsi-container').style.display = 'none';
                    document.getElementById('rsi-indicator').style.display = 'none';
                }
                
                // Fit content
                if (mainChart) {
                    mainChart.timeScale().fitContent();
                }
                
                if (rsiChart) {
                    rsiChart.timeScale().fitContent();
                }
                
                // Update data summary
                updateDataSummary(symbolSelector.value, exchangeSelector.value, timeframeSelector.value, data.candlestick);
                
                // Show success message
                showToast('success', `Loaded ${data.candlestick.length} data points for ${symbolSelector.value}`);
            } else {
                showToast('error', `No data available for ${symbolSelector.value} (${exchangeSelector.value}) with ${timeframeSelector.value} interval`);
            }
        } catch (error) {
            console.error('Error fetching chart data:', error);
            showToast('error', error.message || 'Failed to fetch chart data');
        } finally {
            showLoading(false);
        }
    }
    
    // Format candlestick data for TradingView
    function formatCandlestickData(data) {
        // The data is already in the correct format with time objects
        // Just return it directly
        return data;
    }
    
    // Format indicator data for TradingView
    function formatIndicatorData(data) {
        if (!data) return [];
        
        // The indicator data is already in the correct format with time objects
        // Just return it directly
        return data;
    }
    
    // Format histogram data for MACD
    function formatHistogramData(histogramData, macdData) {
        if (!histogramData || !macdData) return [];
        
        // Add colors to the histogram data based on value
        return histogramData.map((item) => {
            const color = item.value >= 0 ? '#26a69a' : '#ef5350';
            return {
                ...item,  // Keep the original time object and value
                color     // Add color property
            };
        });
    }
    
    // Update data summary
    function updateDataSummary(data) {
        if (!data || data.length === 0) {
            dataSummary.innerHTML = '<p class="text-gray-500">No data available</p>';
            return;
        }
        
        try {
            // Get the latest candle
            const latest = data[data.length - 1];
            
            // Check if we have valid data
            if (!latest || typeof latest !== 'object' || !latest.open || !latest.close) {
                dataSummary.innerHTML = '<p class="text-gray-500">Invalid data format</p>';
                return;
            }
            
            // Calculate change
            const change = latest.close - latest.open;
            const changePercent = (change / latest.open) * 100;
            const changeSign = change >= 0 ? '+' : '';
            const formattedChange = `${changeSign}${change.toFixed(2)} (${changeSign}${changePercent.toFixed(2)}%)`;
            
            // Format date from timestamp - with safety checks
            let formattedDate = 'N/A';
            if (latest.time) {
                try {
                    // Handle both timestamp (number) and object formats
                    let date;
                    if (typeof latest.time === 'number') {
                        // Unix timestamp in seconds
                        date = new Date(latest.time * 1000);
                    } else if (typeof latest.time === 'object' && 
                              latest.time.year !== undefined && 
                              latest.time.month !== undefined && 
                              latest.time.day !== undefined) {
                        // Object format with year, month, day
                        date = new Date(
                            latest.time.year, 
                            latest.time.month,  // JavaScript months are 0-based
                            latest.time.day, 
                            latest.time.hour || 0, 
                            latest.time.minute || 0
                        );
                    } else {
                        throw new Error('Invalid time format');
                    }
                    
                    formattedDate = date.toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                    });
                } catch (error) {
                    console.error('Error formatting date:', error);
                }
            }
            
            // Generate HTML
            const changeClass = change >= 0 ? 'text-success' : 'text-error';
            
            dataSummary.innerHTML = `
                <table class="table table-compact w-full">
                    <tbody>
                        <tr>
                            <td class="font-semibold">Symbol</td>
                            <td>${symbolSelector.value} (${exchangeSelector.value})</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Interval</td>
                            <td>${timeframeSelector.value}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Last Updated</td>
                            <td>${formattedDate}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Open</td>
                            <td>${latest.open.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">High</td>
                            <td>${latest.high.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Low</td>
                            <td>${latest.low.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Close</td>
                            <td>${latest.close.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Change</td>
                            <td class="${changeClass}">${formattedChange}</td>
                        </tr>
                        <tr>
                            <td class="font-semibold">Volume</td>
                            <td>${latest.volume.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('Error updating data summary:', error);
            dataSummary.innerHTML = '<p class="text-gray-500">Error updating data summary</p>';
        }
    }
    
    // Setup auto-update
    function setupAutoUpdate() {
        // Clear existing interval
        if (autoUpdateInterval) {
            clearInterval(autoUpdateInterval);
            autoUpdateInterval = null;
        }
        
        // Setup new interval if auto-update is enabled
        if (autoUpdateToggle.checked) {
            const interval = timeframeSelector.value;
            let updateFrequency = 60000; // Default to 1 minute
            
            // Set update frequency based on interval
            switch (interval) {
                case '1m':
                    updateFrequency = 10000; // 10 seconds
                    break;
                case '5m':
                    updateFrequency = 30000; // 30 seconds
                    break;
                case '15m':
                case '30m':
                    updateFrequency = 60000; // 1 minute
                    break;
                case '1h':
                    updateFrequency = 5 * 60000; // 5 minutes
                    break;
                default:
                    updateFrequency = 15 * 60000; // 15 minutes for daily/weekly
            }
            
            autoUpdateInterval = setInterval(fetchChartData, updateFrequency);
            showToast('info', `Auto-update enabled (every ${updateFrequency / 1000} seconds)`);
        }
    }
    
    // Show/hide loading state
    function showLoading(isLoading) {
        // You can implement loading indicators here
        fetchDataBtn.disabled = isLoading;
        fetchDataBtn.innerHTML = isLoading ? 
            '<span class="loading loading-spinner loading-xs"></span> Loading...' : 
            'Apply';
    }
    
    // Show toast notification
    function showToast(type, message) {
        // Check if toast container exists, if not create it
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast toast-top-right';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '1rem';
            toastContainer.style.right = '1rem';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `alert ${type === 'error' ? 'alert-error' : type === 'success' ? 'alert-success' : 'alert-info'}`;
        toast.style.marginBottom = '0.5rem';
        toast.style.width = 'auto';
        toast.style.maxWidth = '24rem';
        toast.style.animation = 'slideInRight 0.3s, fadeOut 0.5s 2.5s forwards';
        
        // Add icon based on type
        let icon = '';
        if (type === 'error') icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
        else if (type === 'success') icon = '<i class="fas fa-check-circle mr-2"></i>';
        else icon = '<i class="fas fa-info-circle mr-2"></i>';
        
        // Set content
        toast.innerHTML = `
            <div class="flex items-start">
                ${icon}
                <span>${message}</span>
                <button class="btn btn-ghost btn-xs btn-circle ml-2" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);
        
        // Log to console as well
        console.log(`[${type}] ${message}`);
    }
    
    // Event listeners
    fetchDataBtn.addEventListener('click', fetchChartData);
    
    autoUpdateToggle.addEventListener('change', () => {
        setupAutoUpdate();
    });
    
    // Listen for theme changes
    document.addEventListener('themeChange', (event) => {
        const isDarkMode = event.detail.theme === 'dark';
        updateChartsTheme(isDarkMode);
    });
    
    // Function to update charts theme
    function updateChartsTheme(isDarkMode) {
        // Update main chart theme
        mainChart.applyOptions({
            layout: {
                background: { type: 'solid', color: isDarkMode ? '#1f2937' : 'white' },
                textColor: isDarkMode ? '#f3f4f6' : '#1f2937',
            },
            grid: {
                vertLines: {
                    color: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                },
                horzLines: {
                    color: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                },
            },
            rightPriceScale: {
                borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            },
            timeScale: {
                borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            },
        });
        
        // Update RSI chart theme
        rsiChart.applyOptions({
            layout: {
                background: { type: 'solid', color: isDarkMode ? '#1f2937' : 'white' },
                textColor: isDarkMode ? '#f3f4f6' : '#1f2937',
            },
            grid: {
                vertLines: {
                    color: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                },
                horzLines: {
                    color: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                },
            },
            rightPriceScale: {
                borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            },
            timeScale: {
                borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            },
        });
        
        // Show toast notification
        showToast('info', `Applied ${isDarkMode ? 'dark' : 'light'} theme to charts`);
    }
    
    // Close buttons for indicators
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indicator = e.target.getAttribute('data-indicator');
            toggleIndicator(indicator, false);
        });
    });
    
    // Toggle indicator visibility
    function toggleIndicator(indicator, show) {
        switch (indicator) {
            case 'ema':
                emaIndicator.style.display = show ? 'inline-flex' : 'none';
                emaSeries.applyOptions({ visible: show });
                break;
            case 'rsi':
                rsiIndicator.style.display = show ? 'inline-flex' : 'none';
                document.getElementById('rsi-container').style.display = show ? 'block' : 'none';
                break;
            case 'macd':
                macdIndicator.style.display = show ? 'inline-flex' : 'none';
                document.getElementById('macd-container').style.display = show ? 'block' : 'none';
                break;
        }
    }
    
    // Initialize on page load
    initializeCharts();
    
    // Load data if symbol is selected
    if (symbolSelector.value) {
        fetchChartData();
    }
});
