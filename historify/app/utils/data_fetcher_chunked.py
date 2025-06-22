"""
Example of chunked data fetching to work around API limitations
"""
from datetime import datetime, timedelta
import logging

def fetch_historical_data_chunked(symbol, start_date, end_date, interval='1d', exchange='NSE', chunk_days=30):
    """
    Fetch historical data in chunks to work around API limitations
    
    Args:
        symbol: Stock symbol
        start_date: Start date string (YYYY-MM-DD)
        end_date: End date string (YYYY-MM-DD)
        interval: Data interval
        exchange: Exchange name
        chunk_days: Maximum days per API request
    
    Returns:
        Combined list of all data points
    """
    all_data = []
    
    # Convert dates to datetime objects
    current_start = datetime.strptime(start_date, '%Y-%m-%d')
    final_end = datetime.strptime(end_date, '%Y-%m-%d')
    
    while current_start < final_end:
        # Calculate chunk end date
        chunk_end = min(current_start + timedelta(days=chunk_days - 1), final_end)
        
        logging.info(f"Fetching chunk: {current_start.strftime('%Y-%m-%d')} to {chunk_end.strftime('%Y-%m-%d')}")
        
        try:
            # Fetch data for this chunk
            chunk_data = fetch_historical_data(
                symbol,
                current_start.strftime('%Y-%m-%d'),
                chunk_end.strftime('%Y-%m-%d'),
                interval,
                exchange
            )
            
            if chunk_data:
                all_data.extend(chunk_data)
                logging.info(f"Retrieved {len(chunk_data)} records in this chunk")
            
        except Exception as e:
            logging.error(f"Error fetching chunk: {e}")
            # Continue with next chunk even if one fails
        
        # Move to next chunk
        current_start = chunk_end + timedelta(days=1)
    
    logging.info(f"Total records retrieved: {len(all_data)}")
    return all_data