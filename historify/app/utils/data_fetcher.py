"""
Historify - Stock Historical Data Management App
Data Fetcher Utility
"""
import os
import json
from datetime import datetime, timedelta
import requests
from flask import current_app

# Import OpenAlgo API client
import logging
import random  # Import random unconditionally for fallback
import sys

# Log Python path for debugging
logging.info(f"Python path: {sys.path}")

try:
    # Import OpenAlgo directly as specified by the user
    from openalgo import api
    OPENALGO_AVAILABLE = True
    logging.info('OpenAlgo API successfully imported')
except ImportError as e:
    OPENALGO_AVAILABLE = False
    logging.error(f'OpenAlgo API import error: {str(e)}')
    logging.warning('OpenAlgo API not available. Using mock data for demonstration.')
except Exception as e:
    OPENALGO_AVAILABLE = False
    logging.error(f'Unexpected error during OpenAlgo import: {str(e)}')
    logging.warning('OpenAlgo API not available due to unexpected error. Using mock data for demonstration.')

# Placeholder for OpenAlgo API integration
# In a real app, we would use the actual OpenAlgo Python client
# For now, we'll simulate data fetching

def fetch_historical_data(symbol, start_date, end_date, interval='1d', exchange='NSE'):
    """
    Fetch historical stock data from OpenAlgo API
    
    Uses the OpenAlgo API client to fetch real historical data.
    No longer falls back to generated mock data if API is unavailable.
    
    Args:
        symbol: Stock symbol to fetch
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        interval: Data interval (1m, 5m, 15m, 1h, 1d, etc.)
        exchange: Exchange to fetch data from (default: NSE)
        
    Returns:
        List of OHLCV data points
        
    Raises:
        ValueError: If API is not available or returns an error
    """
    api_key = os.getenv('OPENALGO_API_KEY')
    host = os.getenv('OPENALGO_API_HOST', 'http://127.0.0.1:5000')
    
    if not OPENALGO_AVAILABLE:
        logging.error(f"Cannot fetch data for {symbol}: OpenAlgo API module is not available")
        raise ValueError(f"OpenAlgo API is not available. Please check your installation.")
        
    if not api_key:
        logging.error(f"Cannot fetch data for {symbol}: API key is missing")
        raise ValueError(f"OpenAlgo API key is missing. Please check your .env file.")
    
    try:
        # Initialize OpenAlgo client with host parameter
        logging.info(f"Initializing OpenAlgo client with host: {host}")
        client = api(api_key=api_key, host=host)
        
        # Convert interval format if needed
        openalgo_interval = convert_interval_format(interval)
        
        # Fetch historical data from OpenAlgo API
        logging.info(f"Fetching historical data for {symbol} from exchange {exchange}, period {start_date} to {end_date}")
        response = client.history(
            symbol=symbol,
            exchange=exchange,
            interval=openalgo_interval,
            start_date=start_date,
            end_date=end_date
        )
        
        # Check if response is a pandas DataFrame (as seen in the sample response)
        import pandas as pd
        
        if isinstance(response, pd.DataFrame):
            logging.info(f"Received pandas DataFrame with {len(response)} rows for {symbol}")
            
            if response.empty:
                logging.warning(f"Empty DataFrame received for {symbol}")
                return []
            
            # Process the DataFrame data
            data = []
            
            # Convert DataFrame to our internal format
            for idx, row in response.iterrows():
                # Extract date and time from the index (timestamp)
                timestamp = idx
                if isinstance(timestamp, str):
                    # Parse the timestamp string if needed
                    try:
                        timestamp = pd.to_datetime(timestamp)
                    except Exception as e:
                        logging.error(f"Error parsing timestamp {timestamp}: {e}")
                        continue
                
                date_obj = timestamp.date()
                time_obj = timestamp.time()
                
                data.append({
                    'date': date_obj,
                    'time': time_obj,
                    'open': float(row.get('open', 0)),
                    'high': float(row.get('high', 0)),
                    'low': float(row.get('low', 0)),
                    'close': float(row.get('close', 0)),
                    'volume': int(row.get('volume', 0)),
                    'exchange': exchange
                })
            
            return data
            
        # Handle traditional JSON response format (keeping as fallback)
        elif isinstance(response, dict) and response.get('status') == 'success' and 'data' in response:
            # Process and format the JSON response data
            data = []
            for item in response['data']:
                # Format may vary based on actual API response structure
                date_obj = datetime.strptime(item.get('time').split('T')[0], '%Y-%m-%d').date()
                time_obj = None
                if 'T' in item.get('time'):
                    time_str = item.get('time').split('T')[1].split('+')[0]
                    time_obj = datetime.strptime(time_str, '%H:%M:%S').time()
                
                data.append({
                    'date': date_obj,
                    'time': time_obj,
                    'open': float(item.get('open', 0)),
                    'high': float(item.get('high', 0)),
                    'low': float(item.get('low', 0)),
                    'close': float(item.get('close', 0)),
                    'volume': int(item.get('volume', 0)),
                    'exchange': exchange
                })
            
            return data
        else:
            # If it's neither a DataFrame nor a valid JSON response
            if isinstance(response, dict) and 'message' in response:
                error_msg = response.get('message', 'Unknown API error')
            else:
                error_msg = 'Unknown API error or unsupported response format'
            
            logging.error(f"API error for {symbol}: {error_msg}")
            raise ValueError(f"API error: {error_msg}")
            
    except Exception as e:
        logging.error(f"Error fetching historical data from OpenAlgo: {str(e)}")
        raise ValueError(f"Failed to fetch data for {symbol} from OpenAlgo API: {str(e)}")

def generate_mock_data(symbol, start_date, end_date, interval='1d'):
    """Generate mock OHLCV data for testing purposes"""
    logging.warning(f"Generating mock data for {symbol} from {start_date} to {end_date}")
    
    try:
        # Convert string dates to datetime objects
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
        
        # Validate dates
        if start_date_obj > end_date_obj:
            raise ValueError("Start date cannot be after end date")
        
        # Generate mock data
        data = []
        current_date = start_date_obj
        base_price = random.uniform(100, 500)
        
        while current_date <= end_date_obj:
            # Skip weekends
            if current_date.weekday() < 5:  # Monday to Friday
                # Generate data points based on interval
                if interval in ['1m', '5m', '15m', '30m']:
                    # For minute data, generate multiple points per day
                    market_open = datetime.combine(current_date.date(), datetime.strptime('09:15', '%H:%M').time())
                    market_close = datetime.combine(current_date.date(), datetime.strptime('15:30', '%H:%M').time())
                    
                    # Determine minutes to increment based on interval
                    if interval == '1m':
                        minute_increment = 1
                    elif interval == '5m':
                        minute_increment = 5
                    elif interval == '15m':
                        minute_increment = 15
                    else:  # 30m
                        minute_increment = 30
                    
                    current_time = market_open
                    while current_time <= market_close:
                        # Simulate price movement
                        price_change = random.uniform(-2, 2)
                        current_price = base_price + price_change
                        
                        # Generate OHLCV data
                        open_price = current_price
                        high_price = current_price * random.uniform(1, 1.01)
                        low_price = current_price * random.uniform(0.99, 1)
                        close_price = current_price * random.uniform(0.995, 1.005)
                        volume = int(random.uniform(1000, 10000))
                        
                        data.append({
                            'date': current_date.date(),
                            'time': current_time.time(),
                            'open': round(open_price, 2),
                            'high': round(high_price, 2),
                            'low': round(low_price, 2),
                            'close': round(close_price, 2),
                            'volume': volume
                        })
                        
                        # Update base price
                        base_price = close_price
                        
                        # Increment time
                        current_time += timedelta(minutes=minute_increment)
                
                elif interval in ['1h']:
                    # For hourly data, generate points for each hour of the trading day
                    for hour in range(9, 16):
                        # Simulate price movement
                        price_change = random.uniform(-5, 5)
                        current_price = base_price + price_change
                        
                        # Generate OHLCV data
                        open_price = current_price
                        high_price = current_price * random.uniform(1, 1.02)
                        low_price = current_price * random.uniform(0.98, 1)
                        close_price = current_price * random.uniform(0.99, 1.01)
                        volume = int(random.uniform(10000, 100000))
                        
                        data.append({
                            'date': current_date.date(),
                            'time': datetime.strptime(f'{hour}:00', '%H:%M').time(),
                            'open': round(open_price, 2),
                            'high': round(high_price, 2),
                            'low': round(low_price, 2),
                            'close': round(close_price, 2),
                            'volume': volume
                        })
                        
                        # Update base price
                        base_price = close_price
                
                else:  # Daily data
                    # Simulate price movement
                    price_change = random.uniform(-10, 10)
                    current_price = base_price + price_change
                    
                    # Generate OHLCV data
                    open_price = current_price
                    high_price = current_price * random.uniform(1, 1.03)
                    low_price = current_price * random.uniform(0.97, 1)
                    close_price = current_price * random.uniform(0.98, 1.02)
                    volume = int(random.uniform(100000, 1000000))
                    
                    data.append({
                        'date': current_date.date(),
                        'time': None,  # No specific time for daily data
                        'open': round(open_price, 2),
                        'high': round(high_price, 2),
                        'low': round(low_price, 2),
                        'close': round(close_price, 2),
                        'volume': volume
                    })
                    
                    # Update base price
                    base_price = close_price
            
            # Move to the next day
            current_date += timedelta(days=1)
        
        return data
    
    except Exception as e:
        try:
            from flask import has_app_context, current_app
            if has_app_context():
                current_app.logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
            else:
                import logging
                logging.error(f"Error fetching historical data for {symbol}: {str(e)}")
        except Exception:
            import logging
            logging.error(f"Error fetching historical data for {symbol}: {str(e)}")
        raise

def fetch_realtime_quotes(symbols, exchanges=None):
    """
    Fetch real-time quotes for a list of symbols from OpenAlgo API
    
    Args:
        symbols: List of stock symbols to fetch quotes for
        exchanges: List of exchanges corresponding to each symbol. If not provided,
                 defaults to 'NSE' for all symbols
        
    Returns:
        List of quote data for each symbol
    """
    quotes = []
    api_key = os.getenv('OPENALGO_API_KEY')
    host = os.getenv('OPENALGO_API_HOST', 'http://127.0.0.1:5000')
    
    # Default to NSE if exchanges is not provided
    if exchanges is None:
        exchanges = ['NSE'] * len(symbols)
    
    if not OPENALGO_AVAILABLE:
        logging.error("Cannot fetch quotes: OpenAlgo API module is not available")
        raise ValueError("OpenAlgo API is not available. Please check your installation.")
        
    if not api_key:
        logging.error("Cannot fetch quotes: API key is missing")
        raise ValueError("OpenAlgo API key is missing. Please check your .env file.")
    
    # Initialize OpenAlgo client with api_key and host
    logging.info(f"Initializing OpenAlgo client with host: {host}")
    client = api(api_key=api_key, host=host)
    
    for i, symbol in enumerate(symbols):
        try:
            # Use the corresponding exchange for this symbol
            exchange = exchanges[i] if i < len(exchanges) else 'NSE'
            logging.info(f"Fetching quote for {symbol} from exchange {exchange}")
            response = client.quotes(symbol=symbol, exchange=exchange)
            
            if response.get('status') == 'success' and 'data' in response:
                quote_data = response['data']
                
                # Calculate change percentage
                prev_close = quote_data.get('prev_close', 0)
                ltp = quote_data.get('ltp', 0)
                
                if prev_close > 0:
                    change_percent = ((ltp - prev_close) / prev_close) * 100
                else:
                    change_percent = 0
                
                quotes.append({
                    'symbol': symbol,
                    'exchange': exchange,
                    'price': quote_data.get('ltp', 0),
                    'change': round(change_percent, 2),
                    'open': quote_data.get('open', 0),
                    'high': quote_data.get('high', 0),
                    'low': quote_data.get('low', 0),
                    'volume': quote_data.get('volume', 0),
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
            else:
                # If API returns error, log it but don't fail the entire request
                error_msg = response.get('message', 'Unknown API error')
                logging.error(f"API error for {symbol} from {exchange}: {error_msg}")
                quotes.append({
                    'symbol': symbol,
                    'exchange': exchange,
                    'error': f"API error: {error_msg}",
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
        except Exception as e:
            logging.error(f"Error fetching quote for {symbol} from {exchange}: {str(e)}")
            quotes.append({
                'symbol': symbol,
                'exchange': exchange, 
                'error': f"Error: {str(e)}",
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
    
    return quotes

def get_fallback_quote(symbol):
    """Generate fallback quote data when API is not available"""
    # Generate random price and change for demonstration
    base_price = random.uniform(100, 500)
    change_percent = random.uniform(-3, 3)
    
    return {
        'symbol': symbol,
        'price': round(base_price, 2),
        'change': round(change_percent, 2),
        'open': round(base_price * 0.99, 2),
        'high': round(base_price * 1.02, 2),
        'low': round(base_price * 0.98, 2),
        'volume': int(random.uniform(10000, 1000000)),
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def get_supported_exchanges():
    """Get list of supported exchanges"""
    exchanges = [
        {"code": "NSE", "name": "NSE Equity"},
        {"code": "NFO", "name": "NSE Futures & Options"},
        {"code": "CDS", "name": "NSE Currency"},
        {"code": "BSE", "name": "BSE Equity"},
        {"code": "BFO", "name": "BSE Futures & Options"},
        {"code": "BCD", "name": "BSE Currency"},
        {"code": "MCX", "name": "MCX Commodity"}
    ]
    return exchanges

def convert_interval_format(interval):
    """Convert internal interval format to OpenAlgo format"""
    # Map of internal interval format to OpenAlgo format based on API error message
    # Supported timeframes are: 1m, 3m, 5m, 10m, 15m, 30m, 1h, D
    interval_map = {
        '1m': '1m',
        '3m': '3m',
        '5m': '5m',
        '10m': '10m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '1d': 'D',  # Daily timeframe uses 'D' instead of '1day'
        'D': 'D',   # Alternative format
        '1w': 'W'    # Weekly - this might not be supported, will use default if not
    }
    return interval_map.get(interval, 'D')  # Default to D (daily) if not found

def get_supported_intervals():
    """Get list of supported intervals"""
    if OPENALGO_AVAILABLE:
        try:
            # Initialize OpenAlgo client
            api_key = os.getenv('OPENALGO_API_KEY')
            host = os.getenv('OPENALGO_API_HOST', 'http://127.0.0.1:5000')
            client = api(api_key=api_key, host=host)
            
            # Fetch supported intervals from the API
            response = client.intervals()
            if response['status'] == 'success':
                return response['data']
        except Exception:
            pass
    
    # Fallback to hardcoded intervals
    intervals = {
        'days': ['D'],
        'hours': ['1h'],
        'minutes': ['1m', '3m', '5m', '10m', '15m', '30m'],
        'weeks': []
    }
    return intervals
