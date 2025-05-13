# Historify - Stock Historical Data Management App

Historify is a comprehensive web-based application designed to download, store, and visualize historical and real-time stock market data. The application provides an intuitive interface for managing stock data with features like dynamic watchlists, interactive charts, and incremental data updates.

## Features

- **Data Management**: Download historical stock data directly into SQLite database without intermediate CSV files
- **Multiple Exchanges**: Support for various exchanges including NSE, BSE, NFO, MCX and more
- **Dynamic Watchlist**: Create and manage watchlists with real-time quotes
- **Interactive Charts**: Visualize stock data using TradingView lightweight charts
- **Multiple Timeframes**: Support for various timeframes (1m, 5m, 15m, 30m, 1h, 1d, 1w)
- **Technical Indicators**: Add popular indicators like EMA, SMA, RSI, and MACD to charts
- **Batch Processing**: Process symbols in configurable batches with checkpointing
- **Modern UI**: Clean and responsive interface built with Tailwind CSS and DaisyUI
- **Light/Dark Mode**: Toggle between light and dark themes

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/marketcalls/historify.git
   cd historify
   ```

2. Create a virtual environment and activate it:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file based on `.env.sample` and customize your settings:
   ```
   cp .env.sample .env
   # Edit .env file with your preferred settings
   ```

5. Run the application:
   ```
   python run.py
   ```

6. Access the application at `http://localhost:5001`

## Project Structure

```
historify/
├── app/
│   ├── models/          # Database models
│   ├── routes/          # Route blueprints
│   ├── static/          # Static assets (JS, CSS)
│   ├── templates/       # Jinja2 templates
│   ├── utils/           # Utility functions
│   └── __init__.py      # App initialization
├── instance/            # Instance-specific data (DB file)
├── .env                 # Environment variables
├── .gitignore           # Git ignore file
├── LICENSE              # MIT license
├── README.md            # This file
├── requirements.txt     # Dependencies
└── run.py               # Application entry point
```

## API Endpoints

- **`/api/symbols`**: Get list of available symbols
- **`/api/download`**: Trigger data download and storage
- **`/api/watchlist`**: Manage watchlist symbols
- **`/api/data`**: Fetch OHLCV data for chart visualization
- **`/api/quotes`**: Fetch real-time quotes for watchlist symbols

## Technology Stack

- **Backend**: Flask, SQLAlchemy, SQLite
- **Frontend**: Tailwind CSS, DaisyUI, TradingView Lightweight Charts
- **Data Handling**: Python data processing utilities

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributions

Contributions are welcome! Please feel free to submit a Pull Request.
