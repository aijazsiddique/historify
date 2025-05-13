"""
Historify - Stock Historical Data Management App
Charts Routes Blueprint
"""
from flask import Blueprint, render_template, request, jsonify
from app.models.stock_data import StockData
from app.models.watchlist import WatchlistItem
from datetime import datetime, timedelta

charts_bp = Blueprint('charts', __name__)

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
