/**
 * Watchlist functionality for Historify app
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const watchlistTable = document.getElementById('watchlist-table');
  const addSymbolForm = document.getElementById('add-symbol-form');
  const symbolInput = document.getElementById('symbol-input');
  const nameInput = document.getElementById('name-input');
  const exchangeInput = document.getElementById('exchange-input');
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const deleteSymbolName = document.getElementById('delete-symbol-name');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  
  // Current item being deleted
  let currentDeleteItem = null;
  
  // Load watchlist data
  loadWatchlistData();
  
  // Event listeners
  addSymbolForm.addEventListener('submit', handleAddSymbol);
  confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);
  
  /**
   * Load watchlist data from the server
   */
  function loadWatchlistData() {
    // Show loading state
    watchlistTable.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-2">Loading watchlist...</span>
        </td>
      </tr>
    `;
    
    // Fetch watchlist items from the server
    fetch('/watchlist/items')
      .then(response => response.json())
      .then(data => {
        if (data.length === 0) {
          watchlistTable.innerHTML = `
            <tr>
              <td colspan="6" class="text-center">
                <div class="py-4">
                  <p class="mb-3">Your watchlist is empty</p>
                  <label for="add-symbol-modal" class="btn btn-primary btn-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    Add Symbol
                  </label>
                </div>
              </td>
            </tr>
          `;
          return;
        }
        
        // Build URL with symbols and exchanges
        const apiUrl = `/api/quotes?symbols=${encodeURIComponent(data.map(item => item.symbol).join(','))}&exchanges=${encodeURIComponent(data.map(item => item.exchange).join(','))}`;
        
        // Get real-time quotes for watchlist items
        fetch(apiUrl)
          .then(response => response.json())
          .then(quotes => {
            // Create a map of symbol -> quote data for easy lookup
            const quotesMap = {};
            
            console.log('API Response:', quotes); // Debug log
            
            // From the screenshot, we can see the API returns an array of objects
            // Each object has properties like bid, ask, change, change_percent, etc.
            if (Array.isArray(quotes)) {
              quotes.forEach(quote => {
                if (quote && quote.symbol) {
                  // Extract the symbol from the quotes data
                  const symbol = quote.symbol;
                  
                  // Create a quote object with the necessary properties
                  // Looking at the screenshot, we need to use different field names
                  quotesMap[symbol] = {
                    symbol: symbol,
                    // The API response shows 'ltp' field for NIFTY, but we should also check for 'bid'
                    price: quote.ltp !== undefined ? parseFloat(quote.ltp) : 
                           quote.bid !== undefined ? parseFloat(quote.bid) : 0,
                    // The API shows 'change_percent' field
                    change: quote.change_percent !== undefined ? parseFloat(quote.change_percent) : 0,
                    volume: quote.volume !== undefined ? parseInt(quote.volume) : 0,
                    exchange: quote.exchange || ''
                  };
                  
                  console.log(`Processed ${symbol}: price=${quotesMap[symbol].price}, change=${quotesMap[symbol].change}`);
                }
              });
            }
            
            // Create table rows
            let tableHtml = '';
            data.forEach(item => {
              // Make sure quote has default values for price and change
              const quote = quotesMap[item.symbol] || { price: 0, change: 0 };
              
              // Ensure price and change are numbers with fallbacks
              const price = typeof quote.price === 'number' ? quote.price : 0;
              const change = typeof quote.change === 'number' ? quote.change : 0;
              
              // Check if quote has an error
              if (quote.error) {
                tableHtml += `
                  <tr>
                    <td>${item.symbol}</td>
                    <td>${item.name || item.symbol}</td>
                    <td>${item.exchange}</td>
                    <td colspan="2" class="text-error">
                      <div class="tooltip" data-tip="${quote.error}">
                        Error fetching data
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <a href="/charts?symbol=${encodeURIComponent(item.symbol)}&exchange=${encodeURIComponent(item.exchange)}" class="btn btn-sm btn-outline btn-primary">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                          </svg>
                        </a>
                        <button class="btn btn-sm btn-outline btn-error delete-btn" data-id="${item.id}" data-symbol="${item.symbol}" data-name="${item.name || item.symbol}">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
                return;
              }
              
              // Safe calculation of change class and icon
              const changeClass = change >= 0 ? 'text-success' : 'text-error';
              const changeIcon = change >= 0 ? '↑' : '↓';
              
              tableHtml += `
                <tr>
                  <td>${item.symbol}</td>
                  <td>${item.name || item.symbol}</td>
                  <td>${item.exchange}</td>
                  <td>${price.toFixed(2)}</td>
                  <td class="${changeClass}">
                    ${changeIcon} ${Math.abs(change).toFixed(2)}%
                  </td>
                  <td>
                    <div class="flex gap-2">
                      <a href="/charts?symbol=${item.symbol}" class="btn btn-sm btn-outline btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                      </a>
                      <button class="btn btn-sm btn-outline btn-error delete-btn" data-id="${item.id}" data-symbol="${item.symbol}" data-name="${item.name || item.symbol}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            });
            
            watchlistTable.innerHTML = tableHtml;
            
            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
              btn.addEventListener('click', handleDeleteClick);
            });
          })
          .catch(error => {
            console.error('Error fetching quotes:', error);
            renderWatchlistWithoutQuotes(data);
          });
      })
      .catch(error => {
        console.error('Error fetching watchlist:', error);
        watchlistTable.innerHTML = `
          <tr>
            <td colspan="6" class="text-center">
              <div class="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Error loading watchlist. Please try refreshing the page.</span>
              </div>
            </td>
          </tr>
        `;
      });
  }
  
  /**
   * Render watchlist without quotes (fallback)
   */
  function renderWatchlistWithoutQuotes(data) {
    let tableHtml = '';
    data.forEach(item => {
      tableHtml += `
        <tr>
          <td>${item.symbol}</td>
          <td>${item.name || item.symbol}</td>
          <td>${item.exchange}</td>
          <td>--</td>
          <td>--</td>
          <td>
            <div class="flex gap-2">
              <a href="/charts?symbol=${item.symbol}" class="btn btn-sm btn-outline btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </a>
              <button class="btn btn-sm btn-outline btn-error delete-btn" data-id="${item.id}" data-symbol="${item.symbol}" data-name="${item.name || item.symbol}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    watchlistTable.innerHTML = tableHtml;
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDeleteClick);
    });
  }
  
  /**
   * Handle adding a new symbol to the watchlist
   */
  function handleAddSymbol(event) {
    event.preventDefault();
    
    const symbol = symbolInput.value.trim();
    const name = nameInput.value.trim() || symbol;
    const exchange = exchangeInput.value;
    
    if (!symbol) {
      showToast('error', 'Symbol is required');
      return;
    }
    
    // Show loading state
    const submitBtn = addSymbolForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Adding...';
    
    // Send request to add symbol
    fetch('/watchlist/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        name,
        exchange
      })
    })
      .then(response => response.json())
      .then(data => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        
        if (data.error) {
          showToast('error', data.error);
          return;
        }
        
        // Reset form and close modal
        symbolInput.value = '';
        nameInput.value = '';
        exchangeInput.value = 'NSE';
        document.getElementById('add-symbol-modal').checked = false;
        
        showToast('success', 'Symbol added to watchlist');
        
        // Reload watchlist data
        loadWatchlistData();
      })
      .catch(error => {
        console.error('Error adding symbol:', error);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        showToast('error', 'Failed to add symbol. Please try again.');
      });
  }
  
  /**
   * Handle delete button click
   */
  function handleDeleteClick(event) {
    const button = event.currentTarget;
    const id = button.dataset.id;
    const symbol = button.dataset.symbol;
    const name = button.dataset.name;
    
    // Store delete item info
    currentDeleteItem = { id, symbol, name };
    
    // Show confirmation modal
    deleteSymbolName.textContent = symbol;
    deleteConfirmModal.checked = true;
  }
  
  /**
   * Handle delete confirmation
   */
  function handleDeleteConfirm() {
    if (!currentDeleteItem) return;
    
    // Show loading state
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Deleting...';
    
    // Send request to delete symbol
    fetch(`/watchlist/items/${currentDeleteItem.id}`, {
      method: 'DELETE'
    })
      .then(response => {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = 'Delete';
        deleteConfirmModal.checked = false;
        
        if (!response.ok) {
          throw new Error('Failed to delete symbol');
        }
        
        showToast('success', `Removed ${currentDeleteItem.symbol} from watchlist`);
        
        // Reload watchlist data
        loadWatchlistData();
      })
      .catch(error => {
        console.error('Error deleting symbol:', error);
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = 'Delete';
        deleteConfirmModal.checked = false;
        showToast('error', 'Failed to delete symbol. Please try again.');
      });
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
  
  // Start auto-refresh for quotes (every 30 seconds)
  setInterval(() => {
    loadWatchlistData();
  }, 30000);
});
