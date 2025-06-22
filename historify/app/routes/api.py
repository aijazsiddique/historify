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
    
    # Process symbols in batches to respect rate limits
    BATCH_SIZE = 10  # Process 10 symbols per batch
    
    for i in range(0, len(symbols), BATCH_SIZE):
        batch_symbols = symbols[i:i+BATCH_SIZE]
        batch_exchanges = exchanges[i:i+BATCH_SIZE]
        
        logging.info(f"Processing batch {i//BATCH_SIZE + 1} of {(len(symbols) + BATCH_SIZE - 1)//BATCH_SIZE} ({len(batch_symbols)} symbols)")
        
        # Process each symbol in the batch
        for j, symbol in enumerate(batch_symbols):
            try:
                # If mode is 'continue', check the checkpoint for the last downloaded date
                if mode == 'continue':
                    checkpoint = Checkpoint.query.filter_by(symbol=symbol).first()
                    if checkpoint and checkpoint.last_downloaded_date:
                        symbol_start_date = (checkpoint.last_downloaded_date + timedelta(days=1)).strftime('%Y-%m-%d')
                    else:
                        symbol_start_date = start_date
                else:
                    symbol_start_date = start_date
                
                # Fetch historical data
                try:
                    # Use the corresponding exchange for this symbol
                    exchange = batch_exchanges[j]
                    historical_data = fetch_historical_data(symbol, symbol_start_date, end_date, interval=interval, exchange=exchange)
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
                
                # Commit the transaction for this symbol
                db.session.commit()
                
                # Add to success list (only add once)
                results['success'].append(symbol)
                
            except Exception as e:
                # Handle any other exceptions
                results['failed'].append({
                    'symbol': symbol,
                    'error': str(e)
                })
                logging.error(f"Error processing {symbol}: {str(e)}")
                continue
    
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
        # URL decode the symbols parameter first, then split
        from urllib.parse import unquote
        decoded_symbols = unquote(symbols_param)
        symbols = decoded_symbols.split(',')
        
        # If exchanges are provided, process them
        if exchanges_param:
            decoded_exchanges = unquote(exchanges_param)
            exchanges = decoded_exchanges.split(',')
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

@api_bp.route('/parse-excel', methods=['POST'])
def parse_excel():
    """Parse Excel file and return data as JSON"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # For now, return a mock response
        # In production, use pandas or openpyxl to parse Excel
        return jsonify({
            'rows': [
                ['Symbol', 'Exchange'],
                ['RELIANCE', 'NSE'],
                ['INFY', 'NSE'],
                ['TCS', 'NSE']
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/import-symbols', methods=['POST'])
def import_symbols():
    """Import symbols to watchlist"""
    try:
        data = request.json
        symbols = data.get('symbols', [])
        
        if not symbols:
            return jsonify({'error': 'No symbols provided'}), 400
        
        imported = 0
        errors = []
        
        for symbol_data in symbols:
            try:
                # Check if symbol already exists
                existing = WatchlistItem.query.filter_by(
                    symbol=symbol_data['symbol'],
                    exchange=symbol_data['exchange']
                ).first()
                
                if not existing:
                    watchlist_item = WatchlistItem(
                        symbol=symbol_data['symbol'],
                        exchange=symbol_data['exchange']
                    )
                    db.session.add(watchlist_item)
                    imported += 1
            except Exception as e:
                errors.append({
                    'symbol': symbol_data['symbol'],
                    'error': str(e)
                })
        
        db.session.commit()
        
        return jsonify({
            'imported': imported,
            'errors': errors,
            'message': f'Successfully imported {imported} symbols'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/export', methods=['POST'])
def export_data():
    """Export data in various formats"""
    try:
        data = request.json
        symbols = data.get('symbols', [])
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        interval = data.get('interval', 'D')
        format_type = data.get('format', 'individual')
        
        if not symbols:
            return jsonify({'error': 'No symbols selected'}), 400
        
        # Convert date strings to date objects
        if start_date:
            start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
        else:
            start_date_obj = None
            
        if end_date:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
        else:
            end_date_obj = datetime.now().date()
        
        # Generate export ID for all formats
        export_id = str(datetime.now().timestamp())
        
        # Store export metadata in session for retrieval during download
        from flask import session
        session[f'export_{export_id}'] = {
            'symbols': symbols,
            'start_date': start_date,
            'end_date': end_date,
            'interval': interval,
            'format': format_type
        }
        
        download_url = f'/api/export/download/{export_id}'
        
        return jsonify({
            'download_url': download_url,
            'symbols': len(symbols),
            'format': format_type
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/export/queue', methods=['GET'])
def get_export_queue():
    """Get export queue status"""
    # Return empty queue by default - would be populated from database/cache in production
    # When real exports are created, they would be stored and retrieved here
    queue = []
    
    return jsonify(queue)

@api_bp.route('/export/download/<export_id>', methods=['GET'])
def download_export(export_id):
    """Download exported file"""
    from flask import Response, session
    import csv
    from io import StringIO
    
    # Get export metadata from session
    export_metadata = session.get(f'export_{export_id}')
    if not export_metadata:
        return jsonify({'error': 'Export not found or expired'}), 404
    
    symbols = export_metadata['symbols']
    start_date = export_metadata['start_date']
    end_date = export_metadata['end_date']
    interval = export_metadata['interval']
    format_type = export_metadata['format']
    
    # Convert date strings to date objects
    if start_date:
        start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
    else:
        # Default to 1 year ago if no start date
        start_date_obj = (datetime.now() - timedelta(days=365)).date()
        
    if end_date:
        end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
    else:
        end_date_obj = datetime.now().date()
    
    # Handle different export formats
    if format_type == 'zip':
        # Create ZIP file with individual CSV files for each symbol
        import io
        import zipfile
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for symbol_data in symbols:
                symbol = symbol_data['symbol']
                exchange = symbol_data['exchange']
                
                # Create CSV for this symbol
                csv_output = StringIO()
                writer = csv.writer(csv_output)
                writer.writerow(['Date', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume'])
                
                try:
                    data = get_data_by_timeframe(symbol, exchange, interval, start_date_obj, end_date_obj)
                    
                    for item in data:
                        writer.writerow([
                            item.date.strftime('%Y-%m-%d'),
                            item.time.strftime('%H:%M:%S') if item.time else '',
                            item.open,
                            item.high,
                            item.low,
                            item.close,
                            item.volume
                        ])
                    
                    # Add CSV to ZIP
                    csv_filename = f"{symbol}_{exchange}_{interval}.csv"
                    zip_file.writestr(csv_filename, csv_output.getvalue())
                    
                except Exception as e:
                    logging.error(f"Error exporting data for {symbol}: {str(e)}")
                    continue
        
        # Clear the export from session
        session.pop(f'export_{export_id}', None)
        
        # Return ZIP file
        zip_buffer.seek(0)
        filename = f'historify_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
        
        return Response(
            zip_buffer.getvalue(),
            mimetype='application/zip',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    
    # Create CSV data for combined and individual formats
    output = StringIO()
    
    if format_type == 'combined':
        # Combined format: all symbols in one file
        writer = csv.writer(output)
        writer.writerow(['Symbol', 'Exchange', 'Date', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume'])
        
        for symbol_data in symbols:
            symbol = symbol_data['symbol']
            exchange = symbol_data['exchange']
            
            # Fetch data from the dynamic table
            try:
                data = get_data_by_timeframe(symbol, exchange, interval, start_date_obj, end_date_obj)
                
                for item in data:
                    writer.writerow([
                        symbol,
                        exchange,
                        item.date.strftime('%Y-%m-%d'),
                        item.time.strftime('%H:%M:%S') if item.time else '',
                        item.open,
                        item.high,
                        item.low,
                        item.close,
                        item.volume
                    ])
            except Exception as e:
                logging.error(f"Error exporting data for {symbol}: {str(e)}")
                continue
                
    else:
        # Individual format: data for first symbol only
        writer = csv.writer(output)
        writer.writerow(['Date', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume'])
        
        if symbols:
            symbol_data = symbols[0]
            symbol = symbol_data['symbol']
            exchange = symbol_data['exchange']
            
            try:
                data = get_data_by_timeframe(symbol, exchange, interval, start_date_obj, end_date_obj)
                
                for item in data:
                    writer.writerow([
                        item.date.strftime('%Y-%m-%d'),
                        item.time.strftime('%H:%M:%S') if item.time else '',
                        item.open,
                        item.high,
                        item.low,
                        item.close,
                        item.volume
                    ])
            except Exception as e:
                logging.error(f"Error exporting data for {symbol}: {str(e)}")
    
    # Clear the export from session
    session.pop(f'export_{export_id}', None)
    
    # Get CSV content
    csv_content = output.getvalue()
    output.close()
    
    # Generate filename
    if format_type == 'combined':
        filename = f'historify_export_combined_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    else:
        symbol = symbols[0]['symbol'] if symbols else 'export'
        filename = f'historify_{symbol}_{interval}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    return Response(
        csv_content,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )
