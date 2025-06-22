"""
Historify - Stock Historical Data Management App
Charts Routes Blueprint
"""
from flask import Blueprint, render_template, request, jsonify, current_app
from app.models.stock_data import StockData
from app.models.watchlist import WatchlistItem
from app.models.dynamic_tables import get_data_by_timeframe, ensure_table_exists, get_available_tables
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import logging
import pytz

charts_bp = Blueprint('charts', __name__)

# Technical indicator calculation functions
def calculate_ema(data, period=20):
    """Calculate Exponential Moving Average"""
    if len(data) < period:
        return [None] * len(data)
    
    df = pd.DataFrame(data)
    df['ema'] = df['close'].ewm(span=period, adjust=False).mean()
    return df['ema'].tolist()

def calculate_sma(data, period=20):
    """Calculate Simple Moving Average"""
    if len(data) < period:
        return [None] * len(data)
    
    df = pd.DataFrame(data)
    df['sma'] = df['close'].rolling(window=period).mean()
    return df['sma'].tolist()

def calculate_rsi(data, period=14):
    """Calculate Relative Strength Index"""
    if len(data) < period + 1:
        return [None] * len(data)
    
    df = pd.DataFrame(data)
    delta = df['close'].diff()
    
    # Make two series: one for gains and one for losses
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    # First value is sum of gains/losses
    avg_gain = gain.rolling(window=period).mean().fillna(0)
    avg_loss = loss.rolling(window=period).mean().fillna(0)
    
    # Calculate RS and RSI
    rs = avg_gain / avg_loss.replace(0, np.finfo(float).eps)
    rsi = 100 - (100 / (1 + rs))
    
    return rsi.tolist()

def calculate_macd(data, fast_period=12, slow_period=26, signal_period=9):
    """Calculate MACD (Moving Average Convergence Divergence)"""
    if len(data) < slow_period + signal_period:
        return {'macd': [None] * len(data), 'signal': [None] * len(data), 'histogram': [None] * len(data)}
    
    df = pd.DataFrame(data)
    
    # Calculate MACD line
    ema_fast = df['close'].ewm(span=fast_period, adjust=False).mean()
    ema_slow = df['close'].ewm(span=slow_period, adjust=False).mean()
    df['macd'] = ema_fast - ema_slow
    
    # Calculate signal line
    df['signal'] = df['macd'].ewm(span=signal_period, adjust=False).mean()
    
    # Calculate histogram
    df['histogram'] = df['macd'] - df['signal']
    
    return {
        'macd': df['macd'].tolist(),
        'signal': df['signal'].tolist(),
        'histogram': df['histogram'].tolist()
    }

@charts_bp.route('/')
def index():
    """Render the charts page"""
    symbol = request.args.get('symbol')
    timeframe = request.args.get('timeframe', '1d')
    
    # Get all watchlist symbols for the dropdown
    watchlist_items = WatchlistItem.query.all()
    
    return render_template(
        'charts.html', 
        title="Historify - Charts", 
        symbol=symbol,
        timeframe=timeframe,
        watchlist_items=watchlist_items
    )

@charts_bp.route('/timeframes')
def get_timeframes():
    """Get available chart timeframes"""
    timeframes = [
        {"value": "1m", "label": "1 Minute"},
        {"value": "5m", "label": "5 Minutes"},
        {"value": "15m", "label": "15 Minutes"},
        {"value": "30m", "label": "30 Minutes"},
        {"value": "1h", "label": "1 Hour"},
        {"value": "1d", "label": "Daily"},
        {"value": "1w", "label": "Weekly"}
    ]
    return jsonify(timeframes)

@charts_bp.route('/debug/tables')
def debug_tables():
    """Debug endpoint to check available tables"""
    try:
        tables = get_available_tables()
        return jsonify({
            'tables': tables,
            'count': len(tables)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@charts_bp.route('/api/chart-data/<symbol>/<exchange>/<interval>/<int:ema_period>/<int:rsi_period>')
def get_chart_data(symbol, exchange, interval, ema_period=20, rsi_period=14):
    """Get chart data with indicators for TradingView chart"""
    try:
        logging.info(f"Fetching chart data for {symbol} ({exchange}) with interval '{interval}', EMA period {ema_period}, RSI period {rsi_period}")
        
        # Debug: Check available tables first
        available_tables = get_available_tables()
        matching_tables = [t for t in available_tables if t['symbol'] == symbol.upper() and t['exchange'] == exchange.upper()]
        logging.info(f"Available tables for {symbol} ({exchange}): {matching_tables}")
        
        # Get start and end dates based on interval - use all available data
        end_date = datetime.now().date()
        
        # Instead of hardcoded limits, get the earliest available data from the table
        from app.models.dynamic_tables import get_earliest_date
        earliest_date = get_earliest_date(symbol, exchange, interval)
        
        if earliest_date:
            start_date = earliest_date
            logging.info(f"Using earliest available date: {start_date}")
        else:
            # Fallback to reasonable defaults only if no data exists
            if interval in ['1m', '5m', '15m', '30m']:
                start_date = end_date - timedelta(days=7)  # 1 week for minute data
            elif interval == '1h':
                start_date = end_date - timedelta(days=30)  # 1 month for hourly data
            elif interval == '1d':
                start_date = end_date - timedelta(days=365*10)  # 10 years for daily data
            elif interval == '1w':
                start_date = end_date - timedelta(days=365*10)  # 10 years for weekly data
            else:
                start_date = end_date - timedelta(days=365)  # Default to 1 year
        
        logging.info(f"Date range: {start_date} to {end_date}")
        
        # Fetch data from dynamic table - try multiple interval formats
        data = get_data_by_timeframe(symbol, exchange, interval, start_date, end_date)
        
        # If no data found and interval is daily, try alternative formats
        if not data and interval in ['1d', 'D']:
            alternative_interval = 'D' if interval == '1d' else '1d'
            logging.info(f"No data found with {interval}, trying {alternative_interval}")
            data = get_data_by_timeframe(symbol, exchange, alternative_interval, start_date, end_date)
            
        # Same for weekly
        if not data and interval in ['1w', 'W']:
            alternative_interval = 'W' if interval == '1w' else '1w'
            logging.info(f"No data found with {interval}, trying {alternative_interval}")
            data = get_data_by_timeframe(symbol, exchange, alternative_interval, start_date, end_date)
        
        if not data:
            logging.warning(f"No data found for {symbol} ({exchange}) with {interval} interval")
            return jsonify({
                'error': f'No data found for {symbol} ({exchange}) with {interval} interval',
                'candlestick': [],
                'ema': [],
                'rsi': [],
                'macd': [],
                'signal': [],
                'histogram': []
            }), 200  # Return empty data with 200 status to avoid errors
        
        # Convert to OHLCV format for TradingView
        ohlcv_data = []
        for item in data:
            try:
                # Create datetime from the database date and time
                # Handle case where time might be None (daily data)
                if item.time is None:
                    # For daily data, use just the date
                    if interval in ['D', '1d', 'W', '1w']:
                        # For daily/weekly data, use the date string in YYYY-MM-DD format
                        time_obj = item.date.strftime('%Y-%m-%d')
                    else:
                        # For intraday data without time, use start of day (00:00:00)
                        db_datetime_naive = datetime.combine(item.date, datetime.min.time())
                        ist_tz = pytz.timezone('Asia/Kolkata')
                        ist_datetime_aware = ist_tz.localize(db_datetime_naive)
                        time_obj = int(ist_datetime_aware.timestamp())  # Get UTC Unix timestamp
                else:
                    # For intraday data with time
                    db_datetime_naive = datetime.combine(item.date, item.time)
                    ist_tz = pytz.timezone('Asia/Kolkata')
                    ist_datetime_aware = ist_tz.localize(db_datetime_naive)
                    time_obj = int(ist_datetime_aware.timestamp())  # Get UTC Unix timestamp
                
                # Log some sample data for debugging
                if len(ohlcv_data) < 3:  # Log first few items
                    logging.info(f"Data point: date={item.date}, time={item.time}, time_obj={time_obj}, interval={interval}")
                
            except Exception as e:
                logging.error(f"Error processing datetime: {e}, date: {item.date}, time: {item.time}")
                # Provide a fallback timestamp (current time)
                time_obj = int(datetime.now().timestamp())
            
            # No need for additional logging here since we already log above
            
            ohlcv_data.append({
                'time': time_obj,
                'open': item.open,
                'high': item.high,
                'low': item.low,
                'close': item.close,
                'volume': item.volume
            })
        
        # Sort by time - now we're using timestamps directly
        # No need for a custom sorting function, just sort by the timestamp
        ohlcv_data = sorted(ohlcv_data, key=lambda x: x['time'])
        
        # Calculate indicators
        ema_data = []
        ema_values = calculate_ema(ohlcv_data, ema_period)
        for i, item in enumerate(ohlcv_data):
            if i < len(ema_values) and ema_values[i] is not None:
                # Use the same time object format for consistency
                ema_data.append({
                    'time': item['time'],  # This is already a time object
                    'value': ema_values[i]
                })
        
        rsi_data = []
        rsi_values = calculate_rsi(ohlcv_data, rsi_period)
        for i, item in enumerate(ohlcv_data):
            if i < len(rsi_values) and rsi_values[i] is not None:
                rsi_data.append({
                    'time': item['time'],  # This is already a time object
                    'value': rsi_values[i]
                })
        
        # No MACD calculation as per user request
        macd_data = []
        signal_data = []
        histogram_data = []
        
        # Log success and return data
        logging.info(f"Successfully processed {len(ohlcv_data)} data points for {symbol} ({exchange})")
        return jsonify({
            'candlestick': ohlcv_data,
            'ema': ema_data,
            'rsi': rsi_data,
            'macd': macd_data,
            'signal': signal_data,
            'histogram': histogram_data
        })
    
    except Exception as e:
        # Log the error with traceback
        logging.error(f"Error processing chart data for {symbol} ({exchange}): {str(e)}", exc_info=True)
        
        # Return a more informative error message with empty data arrays
        return jsonify({
            'error': f"Error processing chart data: {str(e)}",
            'candlestick': [],
            'ema': [],
            'rsi': [],
            'macd': [],
            'signal': [],
            'histogram': []
        }), 200  # Return 200 with empty data to avoid client-side errors
