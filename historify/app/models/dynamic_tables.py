"""
Historify - Stock Historical Data Management App
Dynamic Table Factory for Symbol-Exchange-Interval Combinations
"""
from app.models import db
from datetime import datetime
import re
import logging

# Dictionary to store dynamically created model classes
_table_models = {}

def get_table_name(symbol, exchange, interval):
    """Generate a valid table name for the symbol-exchange-interval combination"""
    # Replace any non-alphanumeric characters with underscore
    symbol_clean = re.sub(r'[^a-zA-Z0-9]', '_', symbol)
    exchange_clean = re.sub(r'[^a-zA-Z0-9]', '_', exchange)
    interval_clean = re.sub(r'[^a-zA-Z0-9]', '_', interval)
    
    # Create table name in format: data_symbol_exchange_interval
    return f"data_{symbol_clean}_{exchange_clean}_{interval_clean}".lower()

def get_table_model(symbol, exchange, interval):
    """
    Get or create a SQLAlchemy model for the specified symbol-exchange-interval
    
    Args:
        symbol: Stock symbol (e.g., 'RELIANCE')
        exchange: Exchange code (e.g., 'NSE')
        interval: Data interval (e.g., '1m', 'D')
        
    Returns:
        SQLAlchemy model class for the specified combination
    """
    table_name = get_table_name(symbol, exchange, interval)
    
    # If model already exists, return it
    if table_name in _table_models:
        return _table_models[table_name]
    
    # Create a new model class dynamically
    class_name = f"Data_{symbol}_{exchange}_{interval}".replace('-', '_')
    
    # Create the model class dynamically
    model = type(class_name, (db.Model,), {
        '__tablename__': table_name,
        'id': db.Column(db.Integer, primary_key=True),
        'date': db.Column(db.Date, nullable=False, index=True),
        'time': db.Column(db.Time, nullable=True, index=True),
        'open': db.Column(db.Float, nullable=False),
        'high': db.Column(db.Float, nullable=False),
        'low': db.Column(db.Float, nullable=False),
        'close': db.Column(db.Float, nullable=False),
        'volume': db.Column(db.Integer, nullable=False),
        'created_at': db.Column(db.DateTime, default=datetime.utcnow),
        '__table_args__': (
            db.UniqueConstraint('date', 'time', name=f'uix_{table_name}_date_time'),
        )
    })
    
    # Add methods to the model
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.strftime('%Y-%m-%d'),
            'time': self.time.strftime('%H:%M:%S') if self.time else None,
            'open': self.open,
            'high': self.high,
            'low': self.low,
            'close': self.close,
            'volume': self.volume,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    model.to_dict = to_dict
    
    # Store the model in our dictionary
    _table_models[table_name] = model
    
    logging.info(f"Created dynamic table model: {class_name} ({table_name})")
    
    return model

def ensure_table_exists(symbol, exchange, interval):
    """
    Ensure the table for the specified combination exists in the database
    
    Args:
        symbol: Stock symbol
        exchange: Exchange code
        interval: Data interval
        
    Returns:
        The model class for the table
    """
    model = get_table_model(symbol, exchange, interval)
    
    # Create the table if it doesn't exist
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    if not inspector.has_table(model.__tablename__):
        model.__table__.create(db.engine)
        logging.info(f"Created table in database: {model.__tablename__}")
    
    return model

def get_data_by_timeframe(symbol, exchange, interval, start_date, end_date):
    """
    Get data for the specified symbol, exchange, interval and date range
    
    Args:
        symbol: Stock symbol
        exchange: Exchange code
        interval: Data interval
        start_date: Start date (datetime.date)
        end_date: End date (datetime.date)
        
    Returns:
        List of data points
    """
    model = ensure_table_exists(symbol, exchange, interval)
    
    query = model.query.filter(
        model.date >= start_date,
        model.date <= end_date
    ).order_by(model.date, model.time)
    
    return query.all()

def get_available_tables():
    """
    Get a list of all available data tables
    
    Returns:
        List of dictionaries with symbol, exchange, interval info
    """
    # Query all tables that start with 'data_'
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    tables = []
    
    for table_name in inspector.get_table_names():
        if table_name.startswith('data_'):
            # Parse table name to extract symbol, exchange, interval
            parts = table_name.split('_')
            if len(parts) >= 4:  # data_symbol_exchange_interval
                tables.append({
                    'table_name': table_name,
                    'symbol': parts[1].upper(),
                    'exchange': parts[2].upper(),
                    'interval': parts[3]
                })
    
    return tables
