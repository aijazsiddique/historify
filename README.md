# Historify - Modern Stock Data Management Dashboard

Historify is a professional-grade web application for downloading, managing, and visualizing historical stock market data. Built with a modern, intuitive admin dashboard interface, it provides comprehensive tools for bulk data operations, real-time monitoring, and advanced charting capabilities.

![Historify Architecture](historify/app/static/image/historify.png)

## 🚀 Key Features

### Modern Dashboard Interface
- **Professional Design System**: Clean, modern UI inspired by Stripe, Vercel, and Supabase dashboards
- **Dark/Light Mode**: Seamless theme switching with persistent preferences
- **Responsive Layout**: Fully responsive design that works on desktop and mobile devices
- **Command Palette**: Quick access to all features with keyboard shortcuts (Cmd/Ctrl + K)

### Data Management
- **Bulk Symbol Import**: 
  - CSV and Excel file support with drag-and-drop interface
  - Paste data directly from clipboard
  - Manual entry with auto-complete
  - Real-time validation and duplicate detection
  - Exchange auto-detection with manual override

- **Bulk Data Export**:
  - Multiple export formats (Individual CSV, Combined CSV, ZIP archives)
  - Custom date range selection with presets
  - Configurable intervals (1m, 5m, 15m, 30m, 1h, daily)
  - Background processing for large exports
  - Export queue management with progress tracking

- **Bulk Download**:
  - One-click download for entire watchlist
  - Smart scheduling with API rate limit respect
  - Resume capability for interrupted downloads
  - Parallel processing with thread pool management
  - Real-time progress tracking with ETA

### Advanced Features
- **Multiple Exchange Support**: NSE, BSE, NFO, MCX, CDS and more
- **Dynamic Watchlist**: Real-time quotes with auto-refresh
- **TradingView Charts**: Professional-grade charting with technical indicators
- **Technical Indicators**: EMA, RSI with customizable parameters
- **Incremental Updates**: Checkpoint system for efficient data updates
- **Data Quality Monitoring**: Track data completeness and quality metrics

### Scheduler Manager
- **Automated Data Downloads**: Schedule downloads at specific times in IST
- **Flexible Scheduling Options**:
  - Daily schedules at specific times
  - Interval-based schedules (every N minutes)
  - Pre-configured market close (3:35 PM IST) and pre-market (8:30 AM IST) schedules
- **Job Management**: Pause, resume, delete, or run jobs immediately
- **Background Processing**: Non-blocking scheduled downloads
- **Watchlist Integration**: Automatically download all watchlist symbols
- **Custom Symbol Selection**: Schedule downloads for specific symbols

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/marketcalls/historify.git
   cd historify/historify
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   
   **Note**: The scheduler feature requires APScheduler which is included in requirements.txt

4. **Configure environment**:
   ```bash
   cp .env.sample .env
   # Edit .env with your API keys and settings
   ```

5. **Run the application**:
   ```bash
   python run.py
   ```

6. **Access the dashboard**:
   Open `http://localhost:5001` in your browser

## 🏗️ Project Structure

```
historify/
├── app/
│   ├── models/          # Database models
│   ├── routes/          # API and page routes
│   ├── static/
│   │   ├── css/         # Stylesheets and design system
│   │   ├── js/          # JavaScript modules
│   │   └── image/       # Static images
│   ├── templates/       # Jinja2 templates
│   └── utils/           # Utility functions
├── instance/            # Instance-specific data
├── requirements.txt     # Python dependencies
└── run.py              # Application entry point
```

## 🎨 Design System

The application features a comprehensive design system with:

- **Color Palette**: Semantic colors for success, warning, error, and info states
- **Typography**: Inter font family with clear hierarchy
- **Components**: Reusable buttons, cards, tables, modals, and form elements
- **Animations**: Smooth transitions and loading states
- **Icons**: FontAwesome integration for consistent iconography

## 🔌 API Endpoints

### Data Management
- `POST /api/download` - Download historical data
- `POST /api/import-symbols` - Import symbols to watchlist
- `POST /api/export` - Export data in various formats
- `GET /api/export/queue` - Check export queue status
- `GET /api/export/download/<export_id>` - Download exported CSV file

### Watchlist
- `GET /api/symbols` - Get available symbols
- `GET /api/quotes` - Fetch real-time quotes
- `GET /watchlist/items` - Manage watchlist

### Charts
- `GET /charts/api/chart-data/<symbol>/<exchange>/<interval>/<ema>/<rsi>` - Chart data with indicators

### Scheduler
- `GET /api/scheduler/jobs` - Get all scheduled jobs
- `POST /api/scheduler/jobs` - Create a new scheduled job
- `DELETE /api/scheduler/jobs/<job_id>` - Delete a scheduled job
- `POST /api/scheduler/jobs/<job_id>/pause` - Pause a scheduled job
- `POST /api/scheduler/jobs/<job_id>/resume` - Resume a paused job
- `POST /api/scheduler/jobs/<job_id>/run` - Run a job immediately
- `POST /api/scheduler/test` - Create a test job

## 💻 Technology Stack

- **Backend**: Flask, SQLAlchemy, SQLite, APScheduler
- **Frontend**: 
  - Tailwind CSS + DaisyUI for styling
  - TradingView Lightweight Charts 5.0.0
  - Vanilla JavaScript with modern ES6+
- **Data Processing**: Pandas, NumPy for technical analysis
- **API Integration**: OpenAlgo API for market data
- **Task Scheduling**: APScheduler with IST timezone support

## 🔧 Configuration

### Environment Variables (.env)
```env
# API Configuration
OPENALGO_API_KEY=your_api_key_here
OPENALGO_API_URL=http://127.0.0.1:5000

# Database
DATABASE_URI=sqlite:///historify.db

# App Settings
SECRET_KEY=your_secret_key_here
DEBUG=False
```

### OpenAlgo Integration
Add to your OpenAlgo `.env`:
```env
CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5000,http://127.0.0.1:5001'
```

## 📊 Usage Guide

### Importing Symbols
1. Navigate to Import page from sidebar
2. Choose import method:
   - **File Upload**: Drag & drop CSV/Excel files
   - **Paste Data**: Copy/paste from spreadsheets
   - **Manual Entry**: Type symbols with auto-complete
3. Map columns and validate data
4. Review validation results
5. Import valid symbols

### Exporting Data
1. Go to Export page
2. Select symbols (use search/filters)
3. Choose date range and interval
4. Select export format
5. Configure options (headers, metadata)
6. Start export (background processing for large datasets)

### Bulk Download
1. Access Download page
2. Select symbols or use watchlist
3. Configure intervals and date ranges
4. Choose download mode (fresh/continue)
5. Monitor real-time progress
6. Handle failures with automatic retry

### Scheduler Configuration
1. Navigate to Scheduler page from sidebar
2. Quick setup options:
   - **Market Close Download**: Automatically download at 3:35 PM IST
   - **Pre-Market Download**: Download before market opens at 8:30 AM IST
   - **Test Scheduler**: Run a test job in 10 seconds
3. Custom schedules:
   - **Daily Schedule**: Set specific time in IST
   - **Interval Schedule**: Run every N minutes
   - Configure data interval (1m, 5m, 15m, daily, etc.)
   - Select all watchlist symbols or specific symbols
4. Manage jobs:
   - View next run time and status
   - Pause/resume jobs as needed
   - Run jobs immediately
   - Delete unwanted schedules

## 🚦 Performance Optimizations

- **Batch Processing**: Symbols processed in configurable batches
- **Rate Limiting**: Respects API rate limits (10 symbols/second)
- **Database Optimization**: Dynamic table creation per symbol-interval
- **Lazy Loading**: Virtual scrolling for large datasets
- **Background Jobs**: Queue system for long-running operations
- **Efficient Export**: Streams CSV data directly without loading entire dataset in memory
- **Scheduled Downloads**: Non-blocking background processing for automated downloads

## 🛡️ Security Features

- **Input Validation**: Comprehensive validation for all user inputs
- **Session Management**: Secure session handling for export operations
- **Environment Variables**: Sensitive data in .env files
- **SQL Injection Prevention**: SQLAlchemy ORM queries
- **XSS Protection**: Template auto-escaping
- **Safe Dynamic Table Creation**: Sanitized table names for symbol-interval combinations

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 🐛 Known Issues & Fixes

### Data Export
- **Fixed**: Export was returning only 1 record with incorrect dates
- **Solution**: Implemented proper database querying and CSV generation from dynamic tables

### Recent Updates
- **v1.2.0**: Added Scheduler Manager for automated downloads
- **v1.1.5**: Fixed data export functionality with proper date handling
- **v1.1.0**: Upgraded to TradingView Charts 5.0.0

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- TradingView for the excellent charting library
- OpenAlgo for market data API
- APScheduler for robust task scheduling
- The Flask and SQLAlchemy communities

## 📞 Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/marketcalls/historify/issues).