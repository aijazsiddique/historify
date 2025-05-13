<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

## Product Requirements Document (PRD) for Historical Stock Market Data Management Tool

*(Designed for LLM Model Consumption)*

---

### 1. **Product Overview**

Build a web-based application to download, store, and visualize historical and real-time stock market data with the following key features:

- Download historical and incremental stock data via OpenAlgo API (Python library).
- Store all data directly in a SQLite database (no intermediate CSV files).
- Provide a dynamic watchlist with real-time quotes and persistent storage.
- Visualize data using TradingView lightweight charts with multiple timeframes and auto-update.
- Responsive user interface built with Python Flask backend, Tailwind CSS, and DaisyUI frontend.

Supported Exchanges


NSE: NSE Equity

NFO: NSE Futures & Options

CDS: NSE Currency

BSE: BSE Equity

BFO: BSE Futures & Options

BCD: BSE Currency

MCX: MCX Commodity

Supported Intervals

intervals() function in openalgo python library returns the following intervals

{'data': {'days': ['D'],
  'hours': ['1h'],
  'minutes': ['10m', '15m', '1m', '30m', '3m', '5m'],
  'months': [],
  'seconds': [],
  'weeks': []},
 'status': 'success'}

---

### 2. **Core Functionalities**

#### 2.1 Data Download and Management

- **Data Source:** Use OpenAlgo Python API client to fetch historical stock data.
- **Download Modes:**
    - Fresh download: Download full historical data for selected symbols and date ranges.
    - Incremental update: Continue downloading new data from last checkpoint to keep database current.
- **Date Ranges:** Support predefined ranges (today, last 5 days, 30 days, 90 days, 1 year, 2 years, 5 years, 10 years).
- **Batch Processing:** Process symbols in configurable batches with retry and error logging.
- **Checkpointing:** Track last successfully downloaded symbol and timestamp for resuming interrupted downloads.
- **Data Storage:**
    - Store all OHLCV data directly into SQLite tables.
    - Use a unified table schema for all symbols with columns: SYMBOL, DATE, TIME, OPEN, HIGH, LOW, CLOSE, VOLUME.
    - Implement upsert logic to avoid duplicate records during incremental updates.
    - No CSV files are saved or used as intermediate storage.


#### 2.2 Watchlist Management

- Allow users to create and manage a dynamic watchlist of stock symbols.
- Persist watchlist data in SQLite to maintain state across sessions.
- Support adding/removing symbols with immediate UI updates and smooth animations.
- Display real-time quotes for all watchlist symbols, updating automatically.


#### 2.3 Data Visualization

- Integrate TradingView Lightweight Charts for interactive data visualization.
- Support multiple timeframes: 1 minute, 5 minutes, 15 minutes, hourly, daily, weekly, monthly.
- Enable auto-update of charts for real-time data monitoring.
- Provide chart features such as zoom, pan, tooltips, and markers.
- Allow users to select symbols and timeframes for visualization from the watchlist.
- Use Python libraries (e.g., lightweight-charts-python) for seamless integration with Flask backend and frontend.

---

### 3. **User Interface Requirements**

- Responsive web UI built with Tailwind CSS and DaisyUI components.
- Clean and intuitive layout with:
    - Symbol selection and watchlist management panel.
    - Date range and timeframe selectors for data download and charting.
    - Download progress and status indicators.
    - Interactive chart display area with TradingView charts.
- Real-time feedback on data download status and errors.
- Smooth animations for watchlist updates.

---

### 4. **Data Model**

**SQLite Database Schema:**


| Table Name | Columns | Description |
| :-- | :-- | :-- |
| stock_data | id (PK), symbol (TEXT), date (DATE), time (TIME), open (REAL), high (REAL), low (REAL), close (REAL), volume (INTEGER) | Stores OHLCV data for all symbols |
| watchlist | id (PK), symbol (TEXT UNIQUE), added_on (DATETIME) | Stores user’s watchlist symbols |
| checkpoints | id (PK), symbol (TEXT), last_downloaded_date (DATE), last_downloaded_time (TIME) | Tracks last downloaded data points |

- Indexes on (symbol, date, time) for efficient querying.

---

### 5. **API Endpoints**

| Endpoint | Method | Parameters | Description |
| :-- | :-- | :-- | :-- |
| `/api/symbols` | GET | None | Returns list of available symbols |
| `/api/download` | POST | symbols[], start_date, end_date, mode (fresh/continue) | Triggers data download and storage |
| `/api/watchlist` | GET/POST/DELETE | symbol (for POST/DELETE) | Manage watchlist symbols |
| `/api/data` | GET | symbol, start_date, end_date, timeframe | Fetch OHLCV data for chart visualization |
| `/api/quotes` | GET | symbols[] | Fetch real-time quotes for watchlist symbols |


---

### 6. **TradingView Chart Integration Features**

- **Data Input:** Feed OHLCV data from SQLite via backend API to TradingView charts.
- **Timeframes Supported:** 1m, 5m, 15m, 1h, 1d, 1w, 1mo.
- **Real-Time Updates:** Auto-refresh chart data at user-configurable intervals.
- **Watchlist Sync:** Selecting a symbol from the watchlist updates the chart instantly.
- **Chart Features:** Zoom, pan, tooltips, markers, multi-pane support.
- **Technology:** Use `lightweight-charts-python` or equivalent Python wrapper for TradingView charts embedded in Flask frontend.
- **Smooth UI:** Ensure animations and transitions for chart updates and watchlist changes.

---

### 7. **Non-Functional Requirements**

- **Performance:** Efficient batch downloads and database writes; responsive UI updates.
- **Reliability:** Robust error handling, retries, and checkpointing for uninterrupted data downloads.
- **Security:** Secure API keys, sanitize inputs, and protect database access.
- **Maintainability:** Modular codebase with clear separation of backend, frontend, and data layers.
- **Scalability:** Design database and API to handle growing data volumes and user watchlists.

---

### 8. **Development and Deployment Notes**

- Use Python Flask for backend REST API and business logic.
- Tailwind CSS and DaisyUI for frontend styling and UI components.
- SQLite as lightweight embedded database, suitable for local or small-scale deployments.
- Use OpenAlgo Python client for data fetching; no CSV intermediate files.
- Integrate TradingView lightweight charts via Python wrappers for seamless embedding.
- Provide clear and user-friendly UI feedback during operations.

---

### 9. **Summary**

This PRD defines a fully integrated stock market data management tool that:

- Downloads and updates historical stock data directly into SQLite without CSV files.
- Maintains a dynamic, persistent watchlist with real-time quotes.
- Provides rich, interactive TradingView-style charts supporting multiple timeframes and real-time updates.
- Offers a clean, responsive UI with Tailwind and DaisyUI.
- Is designed for extensibility, reliability, and ease of use.

---

*This document is structured to guide LLM-based code generation and system design, emphasizing direct database storage, rich visualization, and user-centric features.*

