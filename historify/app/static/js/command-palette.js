/**
 * Command Palette functionality
 */

const commandPalette = {
    modal: null,
    searchInput: null,
    resultsContainer: null,
    
    init() {
        this.modal = document.getElementById('command-palette');
        this.searchInput = document.getElementById('command-search');
        this.resultsContainer = document.getElementById('command-results');
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + K to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
            
            // Escape to close
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });
        
        // Click trigger
        const trigger = document.getElementById('command-palette-trigger');
        if (trigger) {
            trigger.addEventListener('click', () => this.open());
        }
        
        // Search input handler
        this.searchInput.addEventListener('input', (e) => {
            this.search(e.target.value);
        });
        
        // Handle result clicks
        this.resultsContainer.addEventListener('click', (e) => {
            const resultItem = e.target.closest('.command-result');
            if (resultItem) {
                this.executeCommand(resultItem.dataset.action, resultItem.dataset.value);
            }
        });
    },
    
    open() {
        this.modal.classList.remove('hidden');
        this.searchInput.value = '';
        this.searchInput.focus();
        this.showDefaultResults();
        
        // Add show animation
        setTimeout(() => {
            this.modal.querySelector('.modal-backdrop').classList.add('show');
            this.modal.querySelector('.modal-content').classList.add('show');
        }, 10);
    },
    
    close() {
        this.modal.querySelector('.modal-backdrop').classList.remove('show');
        this.modal.querySelector('.modal-content').classList.remove('show');
        
        setTimeout(() => {
            this.modal.classList.add('hidden');
        }, 300);
    },
    
    showDefaultResults() {
        const defaultCommands = [
            { icon: 'fa-download', label: 'Download Data', description: 'Bulk download historical data', action: 'navigate', value: '/download' },
            { icon: 'fa-file-import', label: 'Import Symbols', description: 'Import symbols from CSV/Excel', action: 'navigate', value: '/import' },
            { icon: 'fa-file-export', label: 'Export Data', description: 'Export data to various formats', action: 'navigate', value: '/export' },
            { icon: 'fa-chart-line', label: 'View Charts', description: 'Open interactive charts', action: 'navigate', value: '/charts' },
            { icon: 'fa-eye', label: 'Watchlist', description: 'Manage your watchlist', action: 'navigate', value: '/watchlist' },
            { icon: 'fa-cog', label: 'Settings', description: 'Configure application settings', action: 'navigate', value: '/settings' },
        ];
        
        this.renderResults(defaultCommands);
    },
    
    search(query) {
        if (!query) {
            this.showDefaultResults();
            return;
        }
        
        // Simulated search - in production, this would query the backend
        const allCommands = [
            { icon: 'fa-download', label: 'Download Data', description: 'Bulk download historical data', action: 'navigate', value: '/download' },
            { icon: 'fa-file-import', label: 'Import Symbols', description: 'Import symbols from CSV/Excel', action: 'navigate', value: '/import' },
            { icon: 'fa-file-export', label: 'Export Data', description: 'Export data to various formats', action: 'navigate', value: '/export' },
            { icon: 'fa-chart-line', label: 'View Charts', description: 'Open interactive charts', action: 'navigate', value: '/charts' },
            { icon: 'fa-eye', label: 'Watchlist', description: 'Manage your watchlist', action: 'navigate', value: '/watchlist' },
            { icon: 'fa-plus', label: 'Add Symbol to Watchlist', description: 'Add a new symbol', action: 'modal', value: 'add-symbol' },
            { icon: 'fa-sync', label: 'Refresh Data', description: 'Refresh all data', action: 'function', value: 'refreshData' },
            { icon: 'fa-moon', label: 'Toggle Dark Mode', description: 'Switch theme', action: 'function', value: 'toggleTheme' },
            { icon: 'fa-cog', label: 'Settings', description: 'Configure application settings', action: 'navigate', value: '/settings' },
        ];
        
        const filtered = allCommands.filter(cmd => 
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description.toLowerCase().includes(query.toLowerCase())
        );
        
        this.renderResults(filtered);
    },
    
    renderResults(results) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-search text-3xl mb-2"></i>
                    <p>No results found</p>
                </div>
            `;
            return;
        }
        
        const html = results.map((result, index) => `
            <div class="command-result p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors ${index === 0 ? 'bg-gray-100 dark:bg-gray-800' : ''}"
                 data-action="${result.action}" data-value="${result.value}">
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <i class="fas ${result.icon} text-primary"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-white">${result.label}</div>
                        <div class="text-sm text-gray-500">${result.description}</div>
                    </div>
                    <div class="flex-shrink-0">
                        <kbd class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">↵</kbd>
                    </div>
                </div>
            </div>
        `).join('');
        
        this.resultsContainer.innerHTML = html;
    },
    
    executeCommand(action, value) {
        switch (action) {
            case 'navigate':
                window.location.href = value;
                break;
            case 'modal':
                this.close();
                // Handle modal opening based on value
                if (value === 'add-symbol' && window.watchlistManager) {
                    window.watchlistManager.showAddModal();
                }
                break;
            case 'function':
                this.close();
                // Execute function based on value
                if (value === 'toggleTheme' && window.themeToggle) {
                    window.themeToggle.click();
                }
                if (value === 'refreshData') {
                    window.location.reload();
                }
                break;
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    commandPalette.init();
});

// Make close function available globally
window.closeCommandPalette = () => commandPalette.close();