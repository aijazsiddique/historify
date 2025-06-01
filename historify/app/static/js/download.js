/**
 * Bulk Download functionality
 */

let availableSymbols = [];
let selectedSymbols = new Set();
let downloadInProgress = false;
let downloadStats = {
    total: 0,
    success: 0,
    failed: 0,
    pending: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadSymbols();
    setDefaultDates();
    
    // Set up form submission
    document.getElementById('download-form').addEventListener('submit', handleDownload);
});

async function loadSymbols() {
    try {
        const response = await fetch('/api/symbols');
        if (response.ok) {
            availableSymbols = await response.json();
            displaySymbols();
        } else {
            document.getElementById('symbol-grid').innerHTML = 
                `<p class="text-center text-red-500">Failed to load symbols. Status: ${response.status}</p>`;
        }
    } catch (error) {
        console.error('Error loading symbols:', error);
        document.getElementById('symbol-grid').innerHTML = 
            `<p class="text-center text-red-500">Error: ${error.message}</p>`;
        showToast('Error loading symbols', 'error');
    }
}

function displaySymbols() {
    const grid = document.getElementById('symbol-grid');
    if (!grid) {
        return;
    }
    
    if (availableSymbols.length === 0) {
        grid.innerHTML = '<p class="text-center col-span-full text-gray-500">No symbols available</p>';
        return;
    }
    
    grid.innerHTML = '';
    
    try {
        availableSymbols.forEach(symbol => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
            label.innerHTML = `
                <input type="checkbox" class="checkbox checkbox-sm checkbox-primary symbol-checkbox" 
                   value="${symbol.symbol}" data-exchange="${symbol.exchange}"
                   onchange="updateSelectedCount()">
                <span class="text-sm">${symbol.symbol}</span>
                <span class="text-xs text-gray-500">${symbol.exchange}</span>
            `;
            grid.appendChild(label);
        });
    } catch (error) {
        console.error('[DOWNLOAD] Error creating symbol checkboxes:', error);
    }
}

function filterSymbols() {
    const searchTerm = document.getElementById('symbol-search').value.toLowerCase();
    const labels = document.querySelectorAll('#symbol-grid label');
    
    labels.forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            label.style.display = 'flex';
        } else {
            label.style.display = 'none';
        }
    });
}

function selectAllSymbols() {
    document.querySelectorAll('.symbol-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateSelectedCount();
}

function clearAllSymbols() {
    document.querySelectorAll('.symbol-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.symbol-checkbox:checked');
    document.getElementById('selected-count').textContent = checked.length;
    
    selectedSymbols.clear();
    checked.forEach(checkbox => {
        selectedSymbols.add({
            symbol: checkbox.value,
            exchange: checkbox.dataset.exchange
        });
    });
}

function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
}

async function handleDownload(e) {
    e.preventDefault();
    
    if (selectedSymbols.size === 0) {
        showToast('Please select at least one symbol', 'warning');
        return;
    }
    
    if (downloadInProgress) {
        showToast('Download already in progress', 'warning');
        return;
    }
    
    downloadInProgress = true;
    document.getElementById('download-btn').disabled = true;
    document.getElementById('progress-section').classList.remove('hidden');
    
    // Reset stats
    downloadStats = {
        total: selectedSymbols.size,
        success: 0,
        failed: 0,
        pending: selectedSymbols.size
    };
    updateProgressUI();
    
    // Prepare data
    const symbols = Array.from(selectedSymbols).map(s => s.symbol);
    const exchanges = Array.from(selectedSymbols).map(s => s.exchange);
    const formData = {
        symbols: symbols,
        exchanges: exchanges,
        start_date: document.getElementById('start-date').value,
        end_date: document.getElementById('end-date').value,
        interval: document.getElementById('interval').value,
        mode: document.querySelector('input[name="mode"]:checked').value
    };
    
    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            handleDownloadResult(result);
        } else {
            const error = await response.json();
            showToast(error.message || 'Download failed', 'error');
            resetDownloadUI();
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed: ' + error.message, 'error');
        resetDownloadUI();
    }
}

function handleDownloadResult(result) {
    // Update stats
    downloadStats.success = result.success ? result.success.length : 0;
    downloadStats.failed = result.failed ? result.failed.length : 0;
    downloadStats.pending = 0;
    
    updateProgressUI();
    
    // Show individual results
    const progressList = document.getElementById('symbol-progress-list');
    progressList.innerHTML = '';
    
    // Add successful downloads
    if (result.success) {
        result.success.forEach(symbol => {
            addSymbolProgress(symbol, 'success');
        });
    }
    
    // Add failed downloads
    if (result.failed) {
        result.failed.forEach(item => {
            addSymbolProgress(item.symbol, 'failed', item.error);
        });
    }
    
    // Show completion message
    if (downloadStats.failed > 0) {
        showToast(`Download completed with ${downloadStats.failed} errors`, 'warning');
        document.getElementById('retry-btn').disabled = false;
    } else {
        showToast('Download completed successfully', 'success');
    }
    
    // Add to download history
    addToDownloadHistory({
        date: new Date().toISOString(),
        symbols: downloadStats.total,
        success: downloadStats.success,
        failed: downloadStats.failed
    });
    
    // Reset UI
    downloadInProgress = false;
    document.getElementById('download-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    
    // Cancel button doesn't have an ID in the HTML, use querySelector instead
    const cancelBtn = document.querySelector('button[onclick="cancelDownload()"]');
    if (cancelBtn) {
        cancelBtn.disabled = true;
    }
}

function addSymbolProgress(symbol, status, error = null) {
    const progressList = document.getElementById('symbol-progress-list');
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700';
    
    const statusIcon = {
        'success': 'fa-check-circle text-success',
        'failed': 'fa-times-circle text-error',
        'pending': 'fa-spinner fa-spin text-warning',
        'downloading': 'fa-download text-info'
    }[status];
    
    item.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${statusIcon}"></i>
            <span class="font-medium">${symbol}</span>
        </div>
        ${error ? `<span class="text-xs text-error">${error}</span>` : ''}
    `;
    
    progressList.appendChild(item);
}

function updateProgressUI() {
    // Update counts
    document.getElementById('success-count').textContent = downloadStats.success;
    document.getElementById('failed-count').textContent = downloadStats.failed;
    document.getElementById('pending-count').textContent = downloadStats.pending;
    
    // Update progress bar
    const percentage = Math.round((downloadStats.success + downloadStats.failed) / downloadStats.total * 100);
    document.getElementById('overall-percentage').textContent = percentage + '%';
    document.getElementById('overall-progress-bar').style.width = percentage + '%';
    
    // Update status
    if (downloadStats.pending > 0) {
        document.getElementById('progress-status').textContent = `Downloading ${downloadStats.total - downloadStats.pending} of ${downloadStats.total}`;
    } else {
        document.getElementById('progress-status').textContent = 'Completed';
    }
}

function pauseDownload() {
    // In a real implementation, this would pause the download
    showToast('Pause functionality not implemented', 'info');
}

function cancelDownload() {
    if (confirm('Are you sure you want to cancel the download?')) {
        downloadInProgress = false;
        resetDownloadUI();
        showToast('Download cancelled', 'info');
    }
}

function retryFailed() {
    // In a real implementation, this would retry failed downloads
    showToast('Retry functionality not implemented', 'info');
}

function resetDownloadUI() {
    downloadInProgress = false;
    document.getElementById('download-btn').disabled = false;
    document.getElementById('pause-btn').disabled = false;
    
    // Cancel button doesn't have an ID in the HTML, use querySelector instead
    const cancelBtn = document.querySelector('button[onclick="cancelDownload()"]');
    if (cancelBtn) {
        cancelBtn.disabled = false;
    }
    
    document.getElementById('retry-btn').disabled = true;
    document.getElementById('progress-section').classList.add('hidden');
}

function addToDownloadHistory(download) {
    // Get download history container
    const historyContainer = document.getElementById('download-history');
    
    // Clear "no downloads" message if present
    if (historyContainer.textContent.includes('No recent downloads')) {
        historyContainer.innerHTML = '';
    }
    
    // Create a new history item
    const item = document.createElement('div');
    item.className = 'bg-gray-50 dark:bg-gray-700 p-3 rounded';
    
    // Format date for display
    const date = new Date(download.date);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    // Create status class based on success rate
    let statusClass = 'text-success';
    if (download.failed > 0 && download.success > 0) {
        statusClass = 'text-warning';
    } else if (download.failed > 0 && download.success === 0) {
        statusClass = 'text-error';
    }
    
    item.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <span class="text-sm font-medium">${formattedDate}</span>
                <p class="text-xs text-gray-500 mt-1">Symbols: ${download.symbols}</p>
            </div>
            <div class="text-right">
                <span class="${statusClass} font-medium">
                    ${download.success}/${download.symbols} complete
                </span>
                ${download.failed > 0 ? 
                    `<p class="text-xs text-error mt-1">${download.failed} failed</p>` : 
                    ''}
            </div>
        </div>
    `;
    
    // Add to the history container (at the top)
    historyContainer.insertBefore(item, historyContainer.firstChild);
    
    // Store in local storage for persistence
    saveDownloadHistory();
}

function saveDownloadHistory() {
    // In a real implementation, this would save history to local storage or the server
    // This is a placeholder function
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} text-${type}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}