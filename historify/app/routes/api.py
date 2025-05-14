"""
Historify - Stock Historical Data Management App
API Routes Blueprint
"""
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
import logging
from app.models import db
from app.models.stock_data import StockData
from app.models.watchlist import WatchlistItem
from app.models.checkpoint import Checkpoint
from app.models.dynamic_tables import ensure_table_exists, get_data_by_timeframe
from app.utils.data_fetcher import fetch_historical_data, fetch_realtime_quotes, OPENALGO_AVAILABLE

api_bp = Blueprint('api', __name__)

@api_bp.route('/symbols', methods=['GET'])
def get_symbols():
    """Get all available symbols"""
    # In a real app, this would fetch from a symbols database or API
    # For now we just return the watchlist items
    watchlist_items = WatchlistItem.query.all()
    symbols_data = [item.to_dict() for item in watchlist_items]
    return jsonify(symbols_data)

@api_bp.route('/download', methods=['POST'])
def download_data():
    """Download historical stock data"""
    data = request.json
    
    if not data or 'symbols' not in data:
        return jsonify({'error': 'Symbols list is required'}), 400
    
    symbols = data.get('symbols', [])
    start_date = data.get('start_date', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
    end_date = data.get('end_date', datetime.now().strftime('%Y-%m-%d'))
    mode = data.get('mode', 'fresh')  # 'fresh' or 'continue'
    interval = data.get('interval', 'D')  # Default to daily if not provided
    
    # Get exchanges from request or default to NSE
    exchanges = data.get('exchanges', [])
    
    # If exchanges list is shorter than symbols list, extend it with default values
    if len(exchanges) < len(symbols):
        exchanges.extend(['NSE'] * (len(symbols) - len(exchanges)))
    # If exchanges list is longer, truncate it
    elif len(exchanges) > len(symbols):
        exchanges = exchanges[:len(symbols)]
    
    # Initialize results dictionary
    results = {
        'success': [],
        'failed': [],
        'status': 'success',
        'message': 'Download initiated'
    }
    
    # Process each symbol
    for symbol in symbols:
        try:
            # If mode is 'continue', check the checkpoint for the last downloaded date
            if mode == 'continue':
                checkpoint = Checkpoint.query.filter_by(symbol=symbol).first()
                if checkpoint and checkpoint.last_downloaded_date:
                    start_date = (checkpoint.last_downloaded_date + timedelta(days=1)).strftime('%Y-%m-%d')
            
            # Fetch historical data
            try:
                # Use the corresponding exchange for this symbol
                exchange = exchanges[symbols.index(symbol)] if symbol in symbols and symbols.index(symbol) < len(exchanges) else 'NSE'
                historical_data = fetch_historical_data(symbol, start_date, end_date, interval=interval, exchange=exchange)
            except ValueError as e:
                results['failed'].append({
                    'symbol': symbol,
                    'error': str(e)
                })
                continue
            
            # Get the dynamic table model for this symbol-exchange-interval combination
            table_model = ensure_table_exists(symbol, exchange, interval)
            
            # Store in database using the dynamic table
            for data_point in historical_data:
                # Check if the data point exists in the dynamic table
                existing = table_model.query.filter_by(
                    date=data_point['date'],
                    time=data_point['time']
                ).first()
                
                if existing:
                    # Update existing data
                    existing.open = data_point['open']
                    existing.high = data_point['high']
                    existing.low = data_point['low']
                    existing.close = data_point['close']
                    existing.volume = data_point['volume']
                else:
                    # Create new data point in the dynamic table
                    new_data = table_model(
                        date=data_point['date'],
                        time=data_point['time'],
                        open=data_point['open'],
                        high=data_point['high'],
                        low=data_point['low'],
                        close=data_point['close'],
                        volume=data_point['volume']
                    )
                    db.session.add(new_data)
            
            # Update checkpoint
            checkpoint = Checkpoint.query.filter_by(symbol=symbol).first()
            if not checkpoint:
                checkpoint = Checkpoint(symbol=symbol)
                db.session.add(checkpoint)
            
            checkpoint.last_downloaded_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            checkpoint.last_downloaded_time = datetime.now().time()
            
            db.session.commit()
            results['success'].append(symbol)
            
        except Exception as e:
            results['failed'].append({
                'symbol': symbol,
                'error': str(e)
            })
    
    if len(results['failed']) > 0:
        results['status'] = 'partial'
        results['message'] = f"Downloaded {len(results['success'])} symbols, {len(results['failed'])} failed"
    
    return jsonify(results)

@api_bp.route('/data', methods=['GET'])
def get_data():
    """Get OHLCV data for a specific symbol"""
    symbol = request.args.get('symbol')
    start_date = request.args.get('start_date', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
    end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
    interval = request.args.get('interval', 'D')  # Changed from timeframe to interval for consistency
    exchange = request.args.get('exchange', 'NSE')  # Default to NSE if not provided
    
    if not symbol:
        return jsonify({'error': 'Symbol is required'}), 400
    
    try:
        # Convert string dates to datetime objects
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Fetch data from the dynamic table for this symbol-exchange-interval
        data = get_data_by_timeframe(symbol, exchange, interval, start_date_obj, end_date_obj)
        
        # Format data for TradingView charts
        ohlcv_data = []
        for item in data:
            timestamp = int(datetime.combine(item.date, item.time).timestamp()) if item.time else int(datetime.combine(item.date, datetime.min.time()).timestamp())
            ohlcv_data.append({
                'time': timestamp,
                'open': item.open,
                'high': item.high,
                'low': item.low,
                'close': item.close,
                'volume': item.volume,
                'symbol': symbol,
                'exchange': exchange,
                'interval': interval
            })
        
        return jsonify(ohlcv_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@api_bp.route('/quotes', methods=['GET'])
def get_quotes():
    """Get real-time quotes for watchlist symbols"""
    symbols_param = request.args.get('symbols')
    exchanges_param = request.args.get('exchanges') or request.args.get('exchange')
    
    # Initialize the results list
    results = []
    
    if symbols_param:
        symbols = symbols_param.split(',')
        
        # If exchanges are provided, process them
        if exchanges_param:
            exchanges = exchanges_param.split(',')
            # Ensure we have an exchange for each symbol
            if len(exchanges) < len(symbols):
                exchanges.extend(['NSE'] * (len(symbols) - len(exchanges)))
        else:
            # If no exchanges provided, try to guess based on symbol format
            # But still default to NSE for safety
            exchanges = []
            for symbol in symbols:
                if 'FUT' in symbol or any(month in symbol for month in ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']):
                    exchanges.append('NFO')  # Futures and options
                elif symbol.startswith(('GOLD', 'SILVER', 'CRUDE')):
                    exchanges.append('MCX')  # Commodities
                elif symbol.endswith(('USD', 'EUR', 'JPY', 'GBP')):
                    exchanges.append('CDS')  # Currency derivatives
                else:
                    exchanges.append('NSE')  # Default to NSE for stocks
    else:
        # Get symbols and exchanges from watchlist
        watchlist_items = WatchlistItem.query.all()
        symbols = [item.symbol for item in watchlist_items]
        exchanges = [item.exchange for item in watchlist_items]
    
    if not symbols:
        return jsonify([])
    
    # Process symbols individually to handle errors more gracefully
    for i, (symbol, exchange) in enumerate(zip(symbols, exchanges)):
        try:
            if not OPENALGO_AVAILABLE:
                return jsonify({'error': 'OpenAlgo API is not available. Please check installation.'}), 503
            
            # Get single quote
            logging.info(f"Fetching quote for {symbol} from exchange {exchange}")
            quote = fetch_realtime_quotes([symbol], [exchange])[0]
            results.append(quote)
            
        except ValueError as e:
            # Log the error but continue with other symbols
            logging.warning(f"Error fetching {symbol} from {exchange}: {str(e)}")
            # Add error information to the results
            results.append({
                'symbol': symbol,
                'exchange': exchange,
                'error': str(e),
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
        except Exception as e:
            logging.warning(f"Unexpected error for {symbol}: {str(e)}")
            results.append({
                'symbol': symbol,
                'exchange': exchange,
                'error': f"Unexpected error: {str(e)}",
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
    
    return jsonify(results)
