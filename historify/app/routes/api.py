"""
Historify - Stock Historical Data Management App
API Routes Blueprint
"""
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from app.models import db
from app.models.stock_data import StockData
from app.models.watchlist import WatchlistItem
from app.models.checkpoint import Checkpoint
from app.utils.data_fetcher import fetch_historical_data, fetch_realtime_quotes

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
            # In a production app, this would be a background task
            historical_data = fetch_historical_data(symbol, start_date, end_date)
            
            # Store in database
            for data_point in historical_data:
                # Check if the data point exists
                existing = StockData.query.filter_by(
                    symbol=symbol,
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
                    # Create new data point
                    new_data = StockData(
                        symbol=symbol,
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
    timeframe = request.args.get('timeframe', '1d')
    
    if not symbol:
        return jsonify({'error': 'Symbol is required'}), 400
    
    try:
        # Convert string dates to datetime objects
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Fetch data from database
        data = StockData.get_data_by_timeframe(symbol, start_date_obj, end_date_obj, timeframe)
        
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
                'volume': item.volume
            })
        
        return jsonify(ohlcv_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@api_bp.route('/quotes', methods=['GET'])
def get_quotes():
    """Get real-time quotes for watchlist symbols"""
    symbols_param = request.args.get('symbols')
    
    if symbols_param:
        symbols = symbols_param.split(',')
    else:
        watchlist_items = WatchlistItem.query.all()
        symbols = [item.symbol for item in watchlist_items]
    
    if not symbols:
        return jsonify([])
    
    try:
        quotes = fetch_realtime_quotes(symbols)
        return jsonify(quotes)
    except Exception as e:
        return jsonify({'error': str(e)}), 400
