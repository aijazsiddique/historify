/**
 * Dashboard functionality for Historify app
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const symbolCheckboxesContainer = document.getElementById('symbol-checkboxes');
  const selectAllCheckbox = document.getElementById('select-all-symbols');
  const intervalSelect = document.getElementById('interval-select');
  const dateRangeSelect = document.getElementById('date-range');
  const customDateRange = document.getElementById('custom-date-range');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const downloadForm = document.getElementById('download-form');
  const downloadBtn = document.getElementById('download-btn');
  const downloadStatus = document.getElementById('download-status');
  const latestDataTable = document.getElementById('latest-data-table');
  
  // Set default dates for custom range
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  startDateInput.valueAsDate = thirtyDaysAgo;
  endDateInput.valueAsDate = today;
  
  // Load watchlist symbols for checkboxes
  loadWatchlistSymbols();
  
  // Latest data section has been removed
  
  // Event listeners
  dateRangeSelect.addEventListener('change', handleDateRangeChange);
  downloadForm.addEventListener('submit', handleDownloadSubmit);
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', handleSelectAllChange);
  }
  // Listen for changes in the symbol checkboxes container to rebind select-all if needed
  symbolCheckboxesContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('symbol-checkbox')) {
      updateSelectAllCheckboxState();
    }
  });
  
  /**
   * Load watchlist symbols to populate checkboxes
   */
  function loadWatchlistSymbols() {
    fetch('/watchlist/items')
      .then(response => response.json())
      .then(data => {
        if (data.length === 0) {
          symbolCheckboxesContainer.innerHTML = `
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No symbols in watchlist. Add symbols in the <a href="/watchlist" class="link link-primary">Watchlist</a> page.</span>
            </div>
          `;
          return;
        }
        
        let checkboxesHtml = '';
        data.forEach(item => {
          checkboxesHtml += `
            <div class="form-control">
              <label class="label cursor-pointer justify-start">
                <input type="checkbox" class="checkbox checkbox-primary symbol-checkbox" value="${item.symbol}" data-exchange="${item.exchange}"/>
                <span class="label-text ml-2">${item.symbol} (${item.exchange}) - ${item.name || item.symbol}</span>
              </label>
            </div>
          `;
        });
        
        symbolCheckboxesContainer.innerHTML = checkboxesHtml;
        // Add event listeners to newly created checkboxes for individual changes
        const individualSymbolCheckboxes = document.querySelectorAll('.symbol-checkbox');
        individualSymbolCheckboxes.forEach(checkbox => {
          checkbox.addEventListener('change', updateSelectAllCheckboxState);
        });
        updateSelectAllCheckboxState(); // Initial check for Select All state
      })
      .catch(error => {
        console.error('Error loading watchlist:', error);
        symbolCheckboxesContainer.innerHTML = `
          <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error loading watchlist symbols. Please try refreshing the page.</span>
          </div>
        `;
      });
  }
  
  /**
   * Handle date range selection change
   */
  function handleDateRangeChange() {
    const selectedValue = dateRangeSelect.value;
    
    if (selectedValue === 'custom') {
      customDateRange.classList.remove('hidden');
    } else {
      customDateRange.classList.add('hidden');
    }
  }
  
  /**
   * Handle Select All checkbox change
   */
  function handleSelectAllChange() {
    const individualSymbolCheckboxes = document.querySelectorAll('.symbol-checkbox');
    individualSymbolCheckboxes.forEach(checkbox => {
      checkbox.checked = selectAllCheckbox.checked;
    });
    updateSelectAllCheckboxState();
  }

  /**
   * Update Select All checkbox based on individual checkbox states
   */
  function updateSelectAllCheckboxState() {
    if (!selectAllCheckbox) return; // Guard if select-all is not on the page
    const individualSymbolCheckboxes = document.querySelectorAll('.symbol-checkbox');
    const allChecked = Array.from(individualSymbolCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(individualSymbolCheckboxes).some(cb => cb.checked);
    
    if (individualSymbolCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = !allChecked && someChecked;
  }
  
  /**
   * Convert date range selection to actual start/end dates
   */
  function getDateRange() {
    const selectedValue = dateRangeSelect.value;
    const today = new Date();
    let startDate = new Date();
    let endDate = today;
    
    switch (selectedValue) {
      case 'today':
        startDate = today;
        break;
      case '5d':
        startDate.setDate(today.getDate() - 5);
        break;
      case '30d':
        startDate.setDate(today.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(today.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case '2y':
        startDate.setFullYear(today.getFullYear() - 2);
        break;
      case '5y':
        startDate.setFullYear(today.getFullYear() - 5);
        break;
      case '10y':
        startDate.setFullYear(today.getFullYear() - 10);
        break;
      case 'custom':
        startDate = new Date(startDateInput.value);
        endDate = new Date(endDateInput.value);
        break;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
  
  /**
   * Handle download form submission
   */
  function handleDownloadSubmit(event) {
    event.preventDefault();
    
    // Get selected symbols and their exchanges
    const checkboxes = document.querySelectorAll('.symbol-checkbox:checked');
    const symbols = Array.from(checkboxes).map(cb => cb.value);
    const exchanges = Array.from(checkboxes).map(cb => cb.dataset.exchange || 'NSE'); // Get exchange from data attribute, default to NSE
    const interval = intervalSelect ? intervalSelect.value : 'D'; // get selected interval

    if (symbols.length === 0) {
      showStatus('error', 'Please select at least one symbol.');
      return;
    }
    
    // Get date range
    const { startDate, endDate } = getDateRange();
    
    // Get download mode
    const downloadMode = document.querySelector('input[name="download-mode"]:checked').value;
    
    // Show loading state
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span> Downloading...`;
    
    // Show initial status
    showStatus('info', `Starting download for ${symbols.length} symbols...`);
    
    // Make API request
    fetch('/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbols,
        exchanges,
        interval, // send interval to backend
        start_date: startDate,
        end_date: endDate,
        mode: downloadMode
      })
    })
      .then(response => response.json())
      .then(data => {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<span>Download Data</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>`;
        
        // Show completion status
        if (data.status === 'success') {
          showStatus('success', `Successfully downloaded data for ${data.success.length} symbols.`);
        } else if (data.status === 'partial') {
          showStatus('warning', data.message);
          
          // Show failed symbols
          data.failed.forEach(item => {
            showStatus('error', `Failed to download ${item.symbol}: ${item.error}`);
          });
        } else {
          showStatus('error', data.message || 'Download failed.');
        }
        
        // Latest data section has been removed, so no need to refresh it
      })
      .catch(error => {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<span>Download Data</span>`;
        showStatus('error', 'Download failed. Please try again.');
        console.error('Download error:', error);
      });
  }
  
  /**
   * Show a status message
   */
  function showStatus(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    
    let alertClass = '';
    let icon = '';
    
    switch (type) {
      case 'success':
        alertClass = 'alert-success';
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        break;
      case 'warning':
        alertClass = 'alert-warning';
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
        break;
      case 'error':
        alertClass = 'alert-error';
        icon = '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        break;
      default:
        alertClass = 'alert-info';
        icon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
    
    const statusHtml = `
      <div class="alert ${alertClass} mb-2">
        ${icon}
        <div>
          <div class="font-bold">${timestamp}</div>
          <div class="text-sm">${message}</div>
        </div>
      </div>
    `;
    
    // Add new status to the top
    downloadStatus.innerHTML = statusHtml + downloadStatus.innerHTML;
    
    // Limit number of status messages
    const statusElements = downloadStatus.querySelectorAll('.alert');
    if (statusElements.length > 10) {
      statusElements[statusElements.length - 1].remove();
    }
  }
  
  // loadLatestData function removed as requested
});
