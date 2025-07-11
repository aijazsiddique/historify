## Relevant Files

- `app/utils/data_resampler.py` - Core resampling engine for converting 1-minute OHLCV data to higher timeframes
- `app/utils/cache_manager.py` - In-memory caching system for resampled data with LRU eviction
- `app/routes/charts.py` - Modified to handle resampling requests and integrate with chart data endpoints
- `app/routes/api.py` - New API endpoints for programmatic access to resampled data
- `app/static/js/tradingview-charts.js` - Frontend chart integration with resampling awareness
- `app/static/js/resampling.js` - Frontend resampling state management and UI components
- `app/static/css/resampling.css` - Styling for loading indicators and notifications
- `app/templates/settings.html` - Updated settings page with resampling configuration options
- `app/models/settings.py` - Database model updates for resampling preferences
- `tests/test_data_resampler.py` - Unit tests for core resampling functionality
- `tests/test_resampling_routes.py` - Integration tests for resampling API endpoints
- `tests/test_resampling_frontend.py` - Frontend testing for resampling UI components

### Notes

- The resampling engine will use pandas.resample() for efficient OHLCV aggregation
- Caching will be implemented using Flask-Caching with in-memory backend
- Frontend will use loading states and progress indicators for better UX
- All new functionality will maintain backward compatibility with existing features

## Tasks

- [x] 1.0 Create Core Data Resampling Engine
  - [x] 1.1 Create `app/utils/data_resampler.py` with base DataResampler class
  - [x] 1.2 Implement OHLCV aggregation methods (Open=first, High=max, Low=min, Close=last, Volume=sum)
  - [x] 1.3 Add support for standard timeframes (5m, 15m, 30m, 1h, 1d) from 1-minute data
  - [x] 1.4 Implement timezone handling for proper data aggregation across market hours
  - [x] 1.5 Add data validation methods to verify integrity before and after resampling
  - [x] 1.6 Implement chunked processing for large datasets (>10,000 data points)
  - [x] 1.7 Add progress tracking capability for long-running resampling operations
  - [x] 1.8 Create comprehensive unit tests in `tests/test_data_resampler.py`

- [x] 2.0 Implement Caching Mechanism for Resampled Data
  - [x] 2.1 Create `app/utils/cache_manager.py` with LRU cache implementation
  - [x] 2.2 Configure Flask-Caching with in-memory backend for resampled data storage
  - [x] 2.3 Implement cache key generation based on symbol, timeframe, and date range
  - [x] 2.4 Add cache expiration logic (15 minutes for intraday, 1 hour for daily)
  - [x] 2.5 Implement cache invalidation when new 1-minute data is downloaded
  - [x] 2.6 Add cache size limits and memory management to prevent overflow
  - [x] 2.7 Create cache statistics and monitoring capabilities
  - [x] 2.8 Add unit tests for caching functionality

- [x] 3.0 Integrate Resampling with Chart System
  - [x] 3.1 Modify `app/routes/charts.py` to detect when resampling is needed
  - [x] 3.2 Add fallback logic to attempt resampling when requested timeframe data is missing
  - [x] 3.3 Implement automatic 1-minute data download if no base data exists
  - [x] 3.4 Update chart data response format to include resampling metadata
  - [x] 3.5 Add error handling for resampling failures with graceful degradation
  - [x] 3.6 Integrate technical indicator calculation options (original vs resampled data)
  - [x] 3.7 Update existing chart endpoints to support resampling parameters
  - [x] 3.8 Create integration tests for chart-resampling workflow

- [x] 4.0 Build API Endpoints for Resampled Data Access
  - [x] 4.1 Add new route `GET /api/resample/<symbol>/<exchange>/<from_interval>/<to_interval>` in `app/routes/api.py`
  - [x] 4.2 Create `POST /api/charts/resample` endpoint for bulk resampling requests
  - [x] 4.3 Integrate resampling capability into existing `/api/charts/data` endpoint
  - [x] 4.4 Add resampling support to data export functionality in existing export routes
  - [x] 4.5 Implement API rate limiting for resampling operations to prevent abuse
  - [x] 4.6 Add request validation and error handling for API endpoints
  - [x] 4.7 Update API documentation to include resampling endpoints and parameters
  - [x] 4.8 Create comprehensive API tests in `tests/test_resampling_routes.py`

- [ ] 5.0 Create User Interface and Settings for Resampling Features
- [x] 5.1 Create `app/static/js/resampling.js` for frontend resampling state management
  - [x] 5.2 Update `app/static/js/tradingview-charts.js` to handle resampling requests and responses
  - [x] 5.3 Implement loading indicators and progress bars for resampling operations
  - [x] 5.4 Add toast notifications to inform users when data is being resampled
  - [x] 5.5 Create resampling settings section in `app/templates/settings.html`
  - [x] 5.6 Update `app/models/settings.py` to include resampling preferences (enable/disable, cache timeout, etc.)
  - [x] 5.7 Add user options for technical indicator calculation method preferences
  - [x] 5.8 Create `app/static/css/resampling.css` for styling loading states and notifications
  - [x] 5.9 Implement cancellation capability for long-running resampling processes
  - [x] 5.10 Add frontend validation and error handling for resampling failures
  - [x] 5.11 Create frontend tests in `tests/test_resampling_frontend.py`
