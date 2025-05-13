"""
Historify - Stock Historical Data Management App
Watchlist Routes Blueprint
"""
from flask import Blueprint, request, jsonify, render_template
from app.models import db
from app.models.watchlist import WatchlistItem

watchlist_bp = Blueprint('watchlist', __name__)

@watchlist_bp.route('/')
def index():
    """Render the watchlist page"""
    return render_template('watchlist.html', title="Historify - Watchlist")

@watchlist_bp.route('/items', methods=['GET'])
def get_items():
    """Get all watchlist items"""
    items = WatchlistItem.query.all()
    return jsonify([item.to_dict() for item in items])

@watchlist_bp.route('/items', methods=['POST'])
def add_item():
    """Add a new symbol to the watchlist"""
    data = request.json
    if not data or 'symbol' not in data:
        return jsonify({'error': 'Symbol is required'}), 400
    
    symbol = data['symbol'].strip().upper()
    if not symbol:
        return jsonify({'error': 'Symbol cannot be empty'}), 400
    
    # Check if symbol already exists
    existing = WatchlistItem.query.filter_by(symbol=symbol).first()
    if existing:
        return jsonify({'error': 'Symbol already exists', 'item': existing.to_dict()}), 409
    
    # Create new watchlist item
    name = data.get('name', symbol)
    exchange = data.get('exchange', 'NSE')
    
    try:
        new_item = WatchlistItem(symbol=symbol, name=name, exchange=exchange)
        db.session.add(new_item)
        db.session.commit()
        return jsonify({'message': 'Symbol added successfully', 'item': new_item.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error adding symbol: {str(e)}'}), 400

@watchlist_bp.route('/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    """Remove a symbol from the watchlist"""
    item = WatchlistItem.query.get_or_404(item_id)
    
    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Symbol removed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error removing symbol: {str(e)}'}), 400
