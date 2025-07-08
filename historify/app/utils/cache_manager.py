"""
Cache Manager
This module initializes and configures the caching system for the application.
"""
from flask_caching import Cache

# Initialize Cache instance
# Configuration will be applied in the app factory
cache = Cache()

def generate_cache_key(symbol, timeframe, start_date, end_date):
    """
    Generates a unique cache key for resampled data.
    
    Args:
        symbol (str): The stock symbol.
        timeframe (str): The target timeframe (e.g., '5m', '1h').
        start_date (datetime.date): The start date of the data range.
        end_date (datetime.date): The end date of the data range.
        
    Returns:
        str: A unique string to be used as a cache key.
    """
    return f"resampled_{symbol}_{timeframe}_{start_date.isoformat()}_{end_date.isoformat()}"

def get_cache_timeout(timeframe):
    """
    Determines the cache timeout based on the timeframe.
    
    Args:
        timeframe (str): The timeframe string (e.g., '5m', '1h', '1d').
        
    Returns:
        int: The cache timeout in seconds.
    """
    if 'm' in timeframe or 'h' in timeframe:
        return 15 * 60  # 15 minutes for intraday
    else:
        return 60 * 60  # 1 hour for daily
