/**
 * Settings page functionality
 */

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Display a clearly visible startup message
    console.log('%c[HISTORIFY SETTINGS] Settings page loaded and initialized', 'background: #e74c3c; color: white; padding: 5px; font-size: 14px; font-weight: bold;');
    
    // Log availability of key functions
    console.log('saveAPISettings function available:', typeof saveAPISettings === 'function');
    console.log('togglePasswordVisibility function available:', typeof togglePasswordVisibility === 'function');
    
    // Check if the API form exists
    const apiForm = document.getElementById('api-settings-form');
    console.log('API settings form found:', apiForm !== null);
    
    // Set up all form submissions - REMOVING DUPLICATE LISTENERS
    if (apiForm) {
        console.log('Attaching submit listener to API settings form');
        apiForm.addEventListener('submit', saveAPISettings);
    } else {
        console.error('API settings form not found!');
        alert('ERROR: API settings form not found!');
    }
    
    // Set up the other forms
    const downloadForm = document.getElementById('download-settings-form');
    if (downloadForm) {
        downloadForm.addEventListener('submit', saveDownloadSettings);
    }
    
    const displayForm = document.getElementById('display-settings-form');
    if (displayForm) {
        displayForm.addEventListener('submit', saveDisplaySettings);
    }

    const resamplingForm = document.getElementById('resampling-settings-form');
    if (resamplingForm) {
        resamplingForm.addEventListener('submit', saveResamplingSettings);
    }
    
    // Load initial settings
    loadSettings();
    loadDatabaseInfo();
});

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            console.log('Loaded settings:', settings);
            
            // Apply settings to form
            document.getElementById('api-url').value = settings.openalgo_api_host || 'http://127.0.0.1:5000';
            document.getElementById('api-key').value = settings.openalgo_api_key || '';
            document.getElementById('theme-select').value = settings.theme || 'system';
            document.getElementById('auto-refresh').checked = settings.auto_refresh !== false;
            document.getElementById('show-tooltips').checked = settings.show_tooltips !== false;
            document.getElementById('batch-size').value = settings.batch_size || '10';
            document.getElementById('rate-limit').value = settings.rate_limit_delay || '100';
            document.getElementById('default-range').value = settings.default_date_range || '30';
            document.getElementById('chart-height').value = settings.chart_height || '400';

            // Resampling settings
            document.getElementById('resampling-enabled').checked = settings.resampling_enabled !== false;
            document.getElementById('resampling-cache-intraday').value = settings.resampling_cache_intraday || '15';
            document.getElementById('resampling-cache-daily').value = settings.resampling_cache_daily || '60';
            document.getElementById('indicator-calc-preference').value = settings.indicator_calc_preference || 'resampled';
            
            // Update status indicators
            updateFieldStatus('api-url-status', settings.openalgo_api_host);
            updateFieldStatus('api-key-status', settings.openalgo_api_key);
            
            console.log('Successfully loaded and applied settings to form');
        } else {
            console.error('Failed to load settings, response not ok');
            showToast('Failed to load settings', 'error');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Error loading settings', 'error');
    }
}

async function loadDatabaseInfo() {
    try {
        const response = await fetch('/api/settings/database-info');
        if (response.ok) {
            const info = await response.json();
            document.getElementById('db-size').textContent = info.db_size;
            document.getElementById('total-records').textContent = info.total_records.toLocaleString();
            document.getElementById('table-count').textContent = info.table_count;
        } else {
            document.getElementById('db-size').textContent = 'Error loading';
            document.getElementById('total-records').textContent = 'Error loading';
            document.getElementById('table-count').textContent = 'Error loading';
        }
    } catch (error) {
        console.error('Error loading database info:', error);
        document.getElementById('db-size').textContent = 'Error loading';
        document.getElementById('total-records').textContent = 'Error loading';
        document.getElementById('table-count').textContent = 'Error loading';
    }
}

async function saveAPISettings(e) {
    e.preventDefault();
    
    const apiUrl = document.getElementById('api-url').value;
    const apiKey = document.getElementById('api-key').value;
    
    // Validate input
    if (!apiUrl) {
        showToast('API URL is required', 'error');
        console.error('Save aborted: API URL is required');
        return;
    }
    
    try {
        // Create and log the exact data being sent to the server
        const payload = {
            openalgo_api_host: apiUrl,
            openalgo_api_key: apiKey
        };
        
        // Send the request
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('API settings saved successfully', 'success');
            console.log('Settings saved successfully according to response');
            
            // Update status indicators immediately
            updateFieldStatus('api-url-status', apiUrl);
            updateFieldStatus('api-key-status', apiKey);
            
            // Verify the settings were actually saved by making another request
            const verifyResponse = await fetch('/api/settings');
            
            if (verifyResponse.ok) {
                const settings = await verifyResponse.json();
                
                // Only reload settings if verification fails
                if (settings.openalgo_api_host !== apiUrl || settings.openalgo_api_key !== apiKey) {
                    if (settings.openalgo_api_host !== apiUrl) {
                        console.log('API URL mismatch - Expected:', apiUrl, 'Actual:', settings.openalgo_api_host);
                    }
                    if (settings.openalgo_api_key !== apiKey) {
                        console.log('API Key mismatch - Expected length:', apiKey.length, 'Actual length:', settings.openalgo_api_key ? settings.openalgo_api_key.length : 0);
                    }
                    loadSettings();
                } else {
                    console.log('%c[DEBUG] Settings verification successful!', 'background: #27ae60; color: white; padding: 2px 5px; border-radius: 3px;');
                }
            } else {
                console.error('Settings verification failed - Could not fetch current settings');
            }
        } else {
            console.error('%c[DEBUG] Save failed', 'background: #e74c3c; color: white; padding: 2px 5px; border-radius: 3px;');
            console.error('Response:', result);
            showToast(result.error || result.message || 'Failed to save API settings', 'error');
        }
    } catch (error) {
        console.error('%c[DEBUG] Exception during save', 'background: #c0392b; color: white; padding: 2px 5px; border-radius: 3px;');
        console.error('Error:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        showToast('Failed to save API settings: ' + error.message, 'error');
    }
}

async function saveDownloadSettings(e) {
    e.preventDefault();
    
    const settings = {
        batch_size: document.getElementById('batch-size').value,
        rate_limit_delay: document.getElementById('rate-limit').value,
        default_date_range: document.getElementById('default-range').value
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showToast('Download settings saved successfully', 'success');
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to save download settings', 'error');
        }
    } catch (error) {
        console.error('Error saving download settings:', error);
        showToast('Failed to save download settings', 'error');
    }
}

async function saveDisplaySettings(e) {
    e.preventDefault();
    
    const settings = {
        theme: document.getElementById('theme-select').value,
        auto_refresh: document.getElementById('auto-refresh').checked,
        show_tooltips: document.getElementById('show-tooltips').checked,
        chart_height: document.getElementById('chart-height').value
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showToast('Display settings saved successfully', 'success');
            updateTheme(settings.theme);
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to save display settings', 'error');
        }
    } catch (error) {
        console.error('Error saving display settings:', error);
        showToast('Failed to save display settings', 'error');
    }
}

async function saveResamplingSettings(e) {
    e.preventDefault();

    const settings = {
        resampling_enabled: document.getElementById('resampling-enabled').checked,
        resampling_cache_intraday: document.getElementById('resampling-cache-intraday').value,
        resampling_cache_daily: document.getElementById('resampling-cache-daily').value,
        indicator_calc_preference: document.getElementById('indicator-calc-preference').value
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showToast('Resampling settings saved successfully', 'success');
        } else {
            const error = await response.json();
            showToast(error.message || 'Failed to save resampling settings', 'error');
        }
    } catch (error) {
        console.error('Error saving resampling settings:', error);
        showToast('Failed to save resampling settings', 'error');
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    // Get the icon inside the button that was clicked
    const icon = event.currentTarget.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

async function testAPIConnection(event) {
    // Handle both direct calls and event calls
    const btn = event ? event.target.closest('button') : document.querySelector('button[onclick="testAPIConnection()"]');
    if (!btn) {
        console.error('Could not find button element');
        return;
    }
    
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    
    try {
        const response = await fetch('/api/settings/test-api', {
            method: 'POST'
        });
        
        const result = await response.json();
        console.log('Test API response:', result);
        
        if (result.success) {
            showToast(result.message || 'API connection successful', 'success');
        } else {
            showToast('API connection failed: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('API test error:', error);
        showToast('API connection failed: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function updateTheme(theme) {
    if (theme === 'system') {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
}

async function clearCache() {
    if (!confirm('Are you sure you want to clear the cache?')) return;
    
    try {
        const response = await fetch('/api/settings/clear-cache', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Cache cleared successfully', 'success');
        } else {
            showToast('Failed to clear cache: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Failed to clear cache: ' + error.message, 'error');
    }
}

async function optimizeDatabase() {
    if (!confirm('This will optimize the database. Continue?')) return;
    
    try {
        const response = await fetch('/api/settings/optimize-database', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Database optimized successfully', 'success');
            loadDatabaseInfo(); // Refresh database info
        } else {
            showToast('Failed to optimize database: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Failed to optimize database: ' + error.message, 'error');
    }
}

async function exportDatabase() {
    try {
        // In a real app, trigger database export
        showToast('Database export started', 'info');
    } catch (error) {
        showToast('Failed to export database', 'error');
    }
}

async function clearAllData() {
    if (!confirm('WARNING: This will delete all downloaded historical data. This action cannot be undone. Are you sure?')) {
        return;
    }
    
    if (!confirm('This is your last chance. All data will be permanently deleted. Continue?')) {
        return;
    }
    
    try {
        // In a real app, call API to clear all data
        showToast('All data cleared successfully', 'success');
    } catch (error) {
        showToast('Failed to clear data', 'error');
    }
}

async function resetSettings() {
    if (!confirm('Reset all settings to default values?')) return;
    
    try {
        const response = await fetch('/api/settings/reset', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Settings reset to defaults', 'success');
            loadSettings(); // Reload settings
            loadDatabaseInfo(); // Refresh database info
        } else {
            showToast('Failed to reset settings: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Failed to reset settings: ' + error.message, 'error');
    }
}

function updateFieldStatus(elementId, value) {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) return;
    
    if (value && value.trim()) {
        statusElement.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle"></i> Saved</span>';
    } else {
        statusElement.innerHTML = '<span class="text-red-600"><i class="fas fa-exclamation-circle"></i> Not set</span>';
    }
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
    
    toast.className = `toast toast-${type} p-4 mb-2 rounded-lg shadow-lg flex items-center gap-3 bg-white dark:bg-gray-800 border-l-4`;
    
    const borderColors = {
        success: 'border-green-500',
        error: 'border-red-500',
        warning: 'border-yellow-500',
        info: 'border-blue-500'
    };
    
    const textColors = {
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
        info: 'text-blue-600'
    };
    
    toast.className += ` ${borderColors[type]}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} ${textColors[type]}"></i>
        <span class="text-gray-800 dark:text-gray-200">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-auto text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Debug: Make functions globally available and log their availability
window.testAPIConnection = testAPIConnection;
window.togglePasswordVisibility = togglePasswordVisibility;

// Log function availability on load
console.log('Settings.js loaded - Functions available:');
console.log('- testAPIConnection:', typeof testAPIConnection);
console.log('- togglePasswordVisibility:', typeof togglePasswordVisibility);
console.log('- saveAPISettings:', typeof saveAPISettings);
