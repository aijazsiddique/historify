/**
 * Bulk Data Export functionality
 */

let availableSymbols = [];
let selectedSymbols = new Set();
let exportQueue = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadSymbols();
    loadExportQueue();
    
    // Set up form submission
    document.getElementById('export-form').addEventListener('submit', handleExport);
    
    // Set default dates
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
});

async function loadSymbols() {
    try {
        const response = await fetch('/api/symbols');
        if (response.ok) {
            availableSymbols = await response.json();
            displaySymbols();
        } else {
            document.getElementById('symbol-checkboxes').innerHTML = 
                `<p class="text-center text-red-500">Failed to load symbols. Status: ${response.status}</p>`;
        }
    } catch (error) {
        console.error('Error loading symbols:', error);
        document.getElementById('symbol-checkboxes').innerHTML = 
            `<p class="text-center text-red-500">Error: ${error.message}</p>`;
        showToast('Error loading symbols', 'error');
    }
}

function displaySymbols() {
    const container = document.getElementById('symbol-checkboxes');
    if (!container) {
        return;
    }
    
    container.innerHTML = '';
    
    if (availableSymbols.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No symbols available</p>';
        return;
    }
    
    // Group symbols by exchange
    const grouped = {};
    try {
        availableSymbols.forEach(symbol => {
            if (!symbol.exchange) {
                symbol.exchange = 'Unknown';
            }
            
            if (!grouped[symbol.exchange]) {
                grouped[symbol.exchange] = [];
            }
            grouped[symbol.exchange].push(symbol);
        });
    } catch (error) {
        console.error('Error processing symbols:', error);
        container.innerHTML = `<p class="text-center text-red-500">Error processing symbols: ${error.message}</p>`;
        return;
    }
    
    // Display grouped symbols
    Object.entries(grouped).forEach(([exchange, symbols]) => {
        const group = document.createElement('div');
        group.className = 'mb-4';
        
        const header = document.createElement('h4');
        header.className = 'font-medium text-sm text-gray-700 dark:text-gray-300 mb-2';
        header.textContent = exchange;
        group.appendChild(header);
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-2';
        
        symbols.forEach(symbol => {
            const label = document.createElement('label');
            label.className = 'flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded';
            label.innerHTML = `
                <input type="checkbox" class="checkbox checkbox-sm checkbox-primary symbol-checkbox" 
                       value="${symbol.symbol}" data-exchange="${symbol.exchange}"
                       onchange="updateSelectedCount()">
                <span class="text-sm">${symbol.symbol}</span>
            `;
            grid.appendChild(label);
        });
        
        group.appendChild(grid);
        container.appendChild(group);
    });
}

function filterSymbols() {
    const searchTerm = document.getElementById('symbol-search').value.toLowerCase();
    const checkboxes = document.querySelectorAll('.symbol-checkbox');
    
    checkboxes.forEach(checkbox => {
        const label = checkbox.parentElement;
        const symbol = checkbox.value.toLowerCase();
        
        if (symbol.includes(searchTerm)) {
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

function deselectAllSymbols() {
    document.querySelectorAll('.symbol-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedCount();
}

function selectWatchlist() {
    // In a real app, this would select only watchlist symbols
    deselectAllSymbols();
    // For demo, select first 10
    const checkboxes = document.querySelectorAll('.symbol-checkbox');
    for (let i = 0; i < Math.min(10, checkboxes.length); i++) {
        checkboxes[i].checked = true;
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.symbol-checkbox:checked');
    document.getElementById('selected-count').textContent = checked.length;
    
    // Update selected symbols set
    selectedSymbols.clear();
    checked.forEach(checkbox => {
        selectedSymbols.add({
            symbol: checkbox.value,
            exchange: checkbox.dataset.exchange
        });
    });
}

function toggleCustomDateRange() {
    const dateRange = document.getElementById('date-range').value;
    const customRange = document.getElementById('custom-date-range');
    
    if (dateRange === 'custom') {
        customRange.classList.remove('hidden');
    } else {
        customRange.classList.add('hidden');
    }
}

async function handleExport(e) {
    e.preventDefault();
    
    if (selectedSymbols.size === 0) {
        showToast('Please select at least one symbol', 'warning');
        return;
    }
    
    const exportBtn = document.getElementById('export-btn');
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        const formData = getExportFormData();
        
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.download_url) {
                // Direct download for all formats now
                window.location.href = result.download_url;
                showToast('Export started - download will begin shortly', 'success');
            } else {
                showToast('Export failed - no download URL received', 'error');
            }
        } else {
            const error = await response.json();
            showToast(error.message || 'Export failed', 'error');
        }
    } catch (error) {
        console.error('Export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-file-export"></i> Start Export';
    }
}

function getExportFormData() {
    const dateRange = document.getElementById('date-range').value;
    let startDate, endDate;
    
    if (dateRange === 'custom') {
        startDate = document.getElementById('start-date').value;
        endDate = document.getElementById('end-date').value;
    } else {
        // Calculate dates based on selection
        endDate = new Date();
        startDate = new Date();
        
        switch (dateRange) {
            case '1m':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case '3m':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case '6m':
                startDate.setMonth(startDate.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case '2y':
                startDate.setFullYear(startDate.getFullYear() - 2);
                break;
            case 'ytd':
                startDate = new Date(startDate.getFullYear(), 0, 1);
                break;
            case 'all':
                startDate = null;
                endDate = null;
                break;
        }
        
        if (startDate) startDate = startDate.toISOString().split('T')[0];
        if (endDate) endDate = endDate.toISOString().split('T')[0];
    }
    
    return {
        symbols: Array.from(selectedSymbols),
        start_date: startDate,
        end_date: endDate,
        interval: document.getElementById('interval').value,
        format: document.querySelector('input[name="format"]:checked').value,
        include_metadata: document.getElementById('include-metadata').checked,
        include_headers: document.getElementById('include-headers').checked,
        include_summary: document.getElementById('include-summary').checked
    };
}

async function previewExport() {
    if (selectedSymbols.size === 0) {
        showToast('Please select at least one symbol', 'warning');
        return;
    }
    
    const modal = document.getElementById('preview-modal');
    const formData = getExportFormData();
    
    // Update preview summary
    document.getElementById('preview-symbols').textContent = selectedSymbols.size;
    document.getElementById('preview-range').textContent = formData.start_date && formData.end_date 
        ? `${formData.start_date} to ${formData.end_date}` 
        : 'All available data';
    document.getElementById('preview-format').textContent = formData.format.toUpperCase();
    
    // Estimate size (rough calculation)
    const estimatedRows = selectedSymbols.size * 250; // Assume ~250 trading days per year
    const estimatedSize = estimatedRows * 100; // ~100 bytes per row
    document.getElementById('preview-size').textContent = formatFileSize(estimatedSize);
    
    // Generate sample data
    generatePreviewTable(formData);
    
    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.modal-backdrop').classList.add('show');
        modal.querySelector('.modal-content').classList.add('show');
    }, 10);
}

function generatePreviewTable(formData) {
    const thead = document.getElementById('preview-thead');
    const tbody = document.getElementById('preview-tbody');
    
    // Clear existing content
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    // Create headers
    const headers = formData.format === 'combined' 
        ? ['Symbol', 'Exchange', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        : ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'];
    
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider';
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    
    // Create sample rows
    const sampleDates = [];
    for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        sampleDates.push(date.toISOString().split('T')[0]);
    }
    
    const firstSymbol = Array.from(selectedSymbols)[0];
    
    sampleDates.forEach((date, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900';
        
        // Generate sample prices
        const open = (Math.random() * 100 + 1000).toFixed(2);
        const high = (parseFloat(open) + Math.random() * 20).toFixed(2);
        const low = (parseFloat(open) - Math.random() * 20).toFixed(2);
        const close = (Math.random() * (high - low) + parseFloat(low)).toFixed(2);
        const volume = Math.floor(Math.random() * 1000000);
        
        if (formData.format === 'combined') {
            row.innerHTML = `
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${firstSymbol.symbol}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${firstSymbol.exchange}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${date}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${open}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${high}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${low}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${close}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${volume.toLocaleString()}</td>
            `;
        } else {
            row.innerHTML = `
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${date}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${open}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${high}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${low}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${close}</td>
                <td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${volume.toLocaleString()}</td>
            `;
        }
        
        tbody.appendChild(row);
    });
}

function closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    modal.querySelector('.modal-backdrop').classList.remove('show');
    modal.querySelector('.modal-content').classList.remove('show');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// Export Queue Management
async function loadExportQueue() {
    try {
        const response = await fetch('/api/export/queue');
        if (response.ok) {
            exportQueue = await response.json();
            displayExportQueue();
        }
    } catch (error) {
        console.error('Error loading export queue:', error);
    }
}

function displayExportQueue() {
    const container = document.getElementById('export-queue');
    const queueSection = document.getElementById('export-queue-section');
    
    if (exportQueue.length === 0) {
        // Hide the entire queue section when empty
        if (queueSection) {
            queueSection.style.display = 'none';
        }
        return;
    }
    
    // Show the queue section when there are items
    if (queueSection) {
        queueSection.style.display = 'block';
    }
    
    container.innerHTML = '';
    
    exportQueue.forEach(job => {
        const jobElement = document.createElement('div');
        jobElement.className = 'flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg';
        
        const statusIcon = {
            'pending': 'fa-clock text-warning',
            'processing': 'fa-spinner fa-spin text-info',
            'completed': 'fa-check-circle text-success',
            'failed': 'fa-times-circle text-error'
        }[job.status] || 'fa-question-circle';
        
        jobElement.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="fas ${statusIcon} text-xl"></i>
                <div>
                    <p class="font-medium">${job.symbol_count} symbols - ${job.format.toUpperCase()}</p>
                    <p class="text-sm text-muted">Created ${formatTimeAgo(job.created_at)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${job.status === 'processing' ? `
                    <div class="text-right mr-4">
                        <p class="text-sm font-medium">${job.progress}%</p>
                        <div class="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full transition-all" style="width: ${job.progress}%"></div>
                        </div>
                    </div>
                ` : ''}
                ${job.status === 'completed' ? `
                    <a href="${job.download_url}" class="btn-modern btn-sm btn-primary">
                        <i class="fas fa-download"></i>
                        Download
                    </a>
                ` : ''}
                ${job.status === 'failed' ? `
                    <button onclick="retryExport('${job.id}')" class="btn-modern btn-sm btn-secondary">
                        <i class="fas fa-redo"></i>
                        Retry
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(jobElement);
    });
}

function addToQueue(job) {
    exportQueue.unshift(job);
    displayExportQueue();
}

function refreshQueue() {
    loadExportQueue();
}

async function retryExport(jobId) {
    try {
        const response = await fetch(`/api/export/retry/${jobId}`, { method: 'POST' });
        if (response.ok) {
            showToast('Export restarted', 'success');
            refreshQueue();
        }
    } catch (error) {
        showToast('Failed to retry export', 'error');
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
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

// Auto-refresh queue every 10 seconds
setInterval(() => {
    if (exportQueue.some(job => job.status === 'processing')) {
        refreshQueue();
    }
}, 10000);