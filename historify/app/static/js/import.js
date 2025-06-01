/**
 * Bulk Symbol Import functionality
 */

let importData = {
    files: [],
    symbols: [],
    validSymbols: [],
    invalidSymbols: [],
    duplicateSymbols: [],
    manualSymbols: []
};

// Initialize drag and drop
document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('border-primary', 'bg-primary/5');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('border-primary', 'bg-primary/5');
        }, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
    
    // Handle file selection
    fileInput.addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function selectImportMethod(method) {
    // Hide all sections
    document.getElementById('file-import-section').classList.add('hidden');
    document.getElementById('paste-import-section').classList.add('hidden');
    document.getElementById('manual-import-section').classList.add('hidden');
    
    // Show selected section
    document.getElementById(`${method}-import-section`).classList.remove('hidden');
    
    // Scroll to section
    document.getElementById(`${method}-import-section`).scrollIntoView({ behavior: 'smooth' });
}

function handleFiles(files) {
    importData.files = Array.from(files);
    displayFileList();
    
    // Process first file for preview
    if (importData.files.length > 0) {
        processFile(importData.files[0]);
    }
}

function displayFileList() {
    const fileList = document.getElementById('file-list');
    const fileItems = document.getElementById('file-items');
    
    fileList.classList.remove('hidden');
    fileItems.innerHTML = '';
    
    importData.files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg';
        fileItem.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-file-${file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'excel' : 'csv'} text-2xl text-gray-400"></i>
                <div>
                    <p class="font-medium">${file.name}</p>
                    <p class="text-sm text-muted">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button onclick="removeFile(${index})" class="btn-modern btn-ghost btn-sm">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileItems.appendChild(fileItem);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(index) {
    importData.files.splice(index, 1);
    if (importData.files.length === 0) {
        document.getElementById('file-list').classList.add('hidden');
        document.getElementById('preview-section').classList.add('hidden');
        document.getElementById('validation-results').classList.add('hidden');
        document.getElementById('import-actions').classList.add('hidden');
    } else {
        displayFileList();
    }
}

async function processFile(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        let data;
        
        if (file.name.endsWith('.csv')) {
            data = parseCSV(e.target.result);
        } else {
            // For Excel files, we'll need to use a library or backend processing
            data = await parseExcel(file);
        }
        
        if (data && data.length > 0) {
            displayPreview(data);
            setupColumnMapping(data[0]);
        }
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        // For Excel, we'll process differently
        parseExcel(file);
    }
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const data = [];
    
    for (let i = 0; i < lines.length; i++) {
        const values = lines[i].split(',').map(val => val.trim());
        data.push(values);
    }
    
    return data;
}

async function parseExcel(file) {
    // In a real implementation, we'd use a library like SheetJS
    // For now, we'll send to backend for processing
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/parse-excel', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            displayPreview(data.rows);
            setupColumnMapping(data.rows[0]);
            return data.rows;
        }
    } catch (error) {
        console.error('Error parsing Excel:', error);
        showToast('Error parsing Excel file', 'error');
    }
}

function displayPreview(data) {
    const previewSection = document.getElementById('preview-section');
    const previewHeaders = document.getElementById('preview-headers');
    const previewBody = document.getElementById('preview-body');
    
    previewSection.classList.remove('hidden');
    previewHeaders.innerHTML = '';
    previewBody.innerHTML = '';
    
    // Display headers
    if (data.length > 0) {
        data[0].forEach((header, index) => {
            const th = document.createElement('th');
            th.textContent = header || `Column ${index + 1}`;
            previewHeaders.appendChild(th);
        });
    }
    
    // Display first 10 rows
    const previewRows = Math.min(10, data.length - 1);
    for (let i = 1; i <= previewRows; i++) {
        const tr = document.createElement('tr');
        data[i].forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        previewBody.appendChild(tr);
    }
    
    if (data.length > 11) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${data[0].length}" class="text-center text-muted">... and ${data.length - 11} more rows</td>`;
        previewBody.appendChild(tr);
    }
}

function setupColumnMapping(headers) {
    const symbolSelect = document.getElementById('symbol-column');
    const exchangeSelect = document.getElementById('exchange-column');
    
    // Clear existing options
    symbolSelect.innerHTML = '';
    exchangeSelect.innerHTML = '<option value="">Auto-detect</option>';
    
    headers.forEach((header, index) => {
        const option1 = document.createElement('option');
        option1.value = index;
        option1.textContent = header || `Column ${index + 1}`;
        
        const option2 = option1.cloneNode(true);
        
        // Auto-select likely columns
        const headerLower = header.toLowerCase();
        if (headerLower.includes('symbol') || headerLower.includes('ticker')) {
            option1.selected = true;
        }
        if (headerLower.includes('exchange') || headerLower.includes('market')) {
            option2.selected = true;
        }
        
        symbolSelect.appendChild(option1);
        exchangeSelect.appendChild(option2);
    });
    
    // Validate data after column selection
    setTimeout(validateImportData, 100);
}

async function validateImportData() {
    const symbolCol = parseInt(document.getElementById('symbol-column').value);
    const exchangeCol = document.getElementById('exchange-column').value;
    const defaultExchange = document.getElementById('default-exchange').value;
    
    importData.symbols = [];
    importData.validSymbols = [];
    importData.invalidSymbols = [];
    importData.duplicateSymbols = [];
    
    // Process all files
    for (const file of importData.files) {
        let data;
        if (file.name.endsWith('.csv')) {
            const text = await readFileAsText(file);
            data = parseCSV(text);
        } else {
            data = await parseExcel(file);
        }
        
        // Skip header row
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const symbol = row[symbolCol]?.trim().toUpperCase();
            const exchange = exchangeCol ? row[exchangeCol]?.trim().toUpperCase() : defaultExchange;
            
            if (symbol) {
                const symbolData = { symbol, exchange, row: i, file: file.name };
                
                // Check for duplicates
                const isDuplicate = importData.symbols.some(s => s.symbol === symbol && s.exchange === exchange);
                
                if (isDuplicate) {
                    importData.duplicateSymbols.push(symbolData);
                } else if (validateSymbol(symbol)) {
                    importData.validSymbols.push(symbolData);
                    importData.symbols.push(symbolData);
                } else {
                    importData.invalidSymbols.push(symbolData);
                }
            }
        }
    }
    
    displayValidationResults();
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function validateSymbol(symbol) {
    // Basic validation - alphanumeric, 1-20 characters
    return /^[A-Z0-9\-_]{1,20}$/.test(symbol);
}

function displayValidationResults() {
    const validationResults = document.getElementById('validation-results');
    const validationDetails = document.getElementById('validation-details');
    const importActions = document.getElementById('import-actions');
    
    validationResults.classList.remove('hidden');
    importActions.classList.remove('hidden');
    
    // Update counts
    document.getElementById('valid-count').textContent = importData.validSymbols.length;
    document.getElementById('duplicate-count').textContent = importData.duplicateSymbols.length;
    document.getElementById('invalid-count').textContent = importData.invalidSymbols.length;
    
    // Show details
    validationDetails.innerHTML = '';
    
    // Show invalid symbols
    if (importData.invalidSymbols.length > 0) {
        const section = document.createElement('div');
        section.className = 'mb-4';
        section.innerHTML = '<h4 class="font-medium mb-2 text-error">Invalid Symbols:</h4>';
        
        importData.invalidSymbols.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 text-sm p-2 bg-error/10 rounded mb-1';
            div.innerHTML = `
                <i class="fas fa-times-circle text-error"></i>
                <span>${item.symbol} (${item.file}, row ${item.row})</span>
            `;
            section.appendChild(div);
        });
        
        validationDetails.appendChild(section);
    }
    
    // Show duplicates
    if (importData.duplicateSymbols.length > 0) {
        const section = document.createElement('div');
        section.className = 'mb-4';
        section.innerHTML = '<h4 class="font-medium mb-2 text-warning">Duplicate Symbols:</h4>';
        
        importData.duplicateSymbols.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 text-sm p-2 bg-warning/10 rounded mb-1';
            div.innerHTML = `
                <i class="fas fa-exclamation-triangle text-warning"></i>
                <span>${item.symbol} - ${item.exchange} (${item.file}, row ${item.row})</span>
            `;
            section.appendChild(div);
        });
        
        validationDetails.appendChild(section);
    }
    
    // Enable/disable import button
    const importBtn = document.getElementById('import-btn');
    importBtn.disabled = importData.validSymbols.length === 0;
}

async function processImport() {
    if (importData.validSymbols.length === 0) {
        showToast('No valid symbols to import', 'warning');
        return;
    }
    
    // Show progress modal
    const progressModal = document.getElementById('import-progress-modal');
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    const importLog = document.getElementById('import-log');
    
    progressModal.classList.remove('hidden');
    importLog.innerHTML = '';
    
    // Process symbols in batches
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < importData.validSymbols.length; i += batchSize) {
        batches.push(importData.validSymbols.slice(i, i + batchSize));
    }
    
    let processed = 0;
    
    for (const batch of batches) {
        try {
            const response = await fetch('/api/import-symbols', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: batch })
            });
            
            if (response.ok) {
                const result = await response.json();
                processed += batch.length;
                
                const progress = Math.round((processed / importData.validSymbols.length) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${progress}%`;
                
                // Log success
                const logEntry = document.createElement('div');
                logEntry.className = 'text-success';
                logEntry.textContent = `✓ Imported ${batch.length} symbols`;
                importLog.appendChild(logEntry);
                importLog.scrollTop = importLog.scrollHeight;
            }
        } catch (error) {
            console.error('Import error:', error);
            const logEntry = document.createElement('div');
            logEntry.className = 'text-error';
            logEntry.textContent = `✗ Error importing batch: ${error.message}`;
            importLog.appendChild(logEntry);
        }
    }
    
    // Complete
    setTimeout(() => {
        progressModal.classList.add('hidden');
        showToast(`Successfully imported ${processed} symbols`, 'success');
        resetImport();
        
        // Redirect to watchlist
        setTimeout(() => {
            window.location.href = '/watchlist';
        }, 2000);
    }, 1500);
}

// Paste Import Functions
function validatePastedData() {
    const pasteInput = document.getElementById('paste-input').value.trim();
    const format = document.getElementById('paste-format').value;
    const defaultExchange = document.getElementById('paste-default-exchange').value;
    
    if (!pasteInput) {
        showToast('Please paste some data', 'warning');
        return;
    }
    
    importData.symbols = [];
    importData.validSymbols = [];
    importData.invalidSymbols = [];
    
    // Parse pasted data
    const lines = pasteInput.split('\n').map(line => line.trim()).filter(line => line);
    
    lines.forEach((line, index) => {
        let symbol, exchange;
        
        if (format === 'symbol-exchange' || (format === 'auto' && line.includes(','))) {
            const parts = line.split(',').map(p => p.trim());
            symbol = parts[0]?.toUpperCase();
            exchange = parts[1]?.toUpperCase() || defaultExchange;
        } else {
            symbol = line.toUpperCase();
            exchange = defaultExchange;
        }
        
        if (symbol) {
            const symbolData = { symbol, exchange, row: index + 1 };
            
            if (validateSymbol(symbol)) {
                importData.validSymbols.push(symbolData);
            } else {
                importData.invalidSymbols.push(symbolData);
            }
        }
    });
    
    if (importData.validSymbols.length > 0) {
        processImport();
    } else {
        showToast('No valid symbols found', 'error');
    }
}

// Manual Entry Functions
let manualSymbolsList = [];

function addManualSymbol() {
    const symbolInput = document.getElementById('manual-symbol');
    const exchangeSelect = document.getElementById('manual-exchange');
    
    const symbol = symbolInput.value.trim().toUpperCase();
    const exchange = exchangeSelect.value;
    
    if (!symbol) {
        showToast('Please enter a symbol', 'warning');
        return;
    }
    
    if (!validateSymbol(symbol)) {
        showToast('Invalid symbol format', 'error');
        return;
    }
    
    // Check for duplicates
    if (manualSymbolsList.some(s => s.symbol === symbol && s.exchange === exchange)) {
        showToast('Symbol already added', 'warning');
        return;
    }
    
    manualSymbolsList.push({ symbol, exchange });
    symbolInput.value = '';
    
    displayManualSymbols();
    showToast('Symbol added', 'success');
}

function displayManualSymbols() {
    const listSection = document.getElementById('manual-symbols-list');
    const itemsContainer = document.getElementById('manual-symbols-items');
    
    if (manualSymbolsList.length > 0) {
        listSection.classList.remove('hidden');
        itemsContainer.innerHTML = '';
        
        manualSymbolsList.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg';
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <i class="fas fa-chart-line text-gray-400"></i>
                    <span class="font-medium">${item.symbol}</span>
                    <span class="badge badge-info">${item.exchange}</span>
                </div>
                <button onclick="removeManualSymbol(${index})" class="btn-modern btn-ghost btn-sm">
                    <i class="fas fa-times"></i>
                </button>
            `;
            itemsContainer.appendChild(div);
        });
    } else {
        listSection.classList.add('hidden');
    }
}

function removeManualSymbol(index) {
    manualSymbolsList.splice(index, 1);
    displayManualSymbols();
}

function importManualSymbols() {
    if (manualSymbolsList.length === 0) {
        showToast('No symbols to import', 'warning');
        return;
    }
    
    importData.validSymbols = manualSymbolsList;
    processImport();
}

// Reset function
function resetImport() {
    importData = {
        files: [],
        symbols: [],
        validSymbols: [],
        invalidSymbols: [],
        duplicateSymbols: [],
        manualSymbols: []
    };
    
    manualSymbolsList = [];
    
    // Reset file input
    document.getElementById('file-input').value = '';
    
    // Hide all sections
    document.getElementById('file-import-section').classList.add('hidden');
    document.getElementById('paste-import-section').classList.add('hidden');
    document.getElementById('manual-import-section').classList.add('hidden');
    
    // Clear paste input
    document.getElementById('paste-input').value = '';
    
    // Clear manual input
    document.getElementById('manual-symbol').value = '';
}

// Utility function to show toast notifications
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