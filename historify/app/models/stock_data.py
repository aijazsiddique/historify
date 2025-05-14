"""
Historify - Stock Historical Data Management App
StockData Model
"""
from app.models import db
from datetime import datetime

class StockData(db.Model):
    """Model for storing OHLCV data for all symbols"""
    __tablename__ = 'stock_data'
    
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), nullable=False, index=True)
    exchange = db.Column(db.String(10), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    time = db.Column(db.Time, nullable=False, index=True)
    open = db.Column(db.Float, nullable=False)
    high = db.Column(db.Float, nullable=False)
    low = db.Column(db.Float, nullable=False)
    close = db.Column(db.Float, nullable=False)
    volume = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Create a composite index on symbol, exchange, date, time for efficient querying
    __table_args__ = (
        db.UniqueConstraint('symbol', 'exchange', 'date', 'time', name='uix_symbol_exchange_date_time'),
    )
    
    def __repr__(self):
        return f'<StockData {self.symbol} {self.date} {self.time}>'
    
    def to_dict(self):
        """Convert the model instance to a dictionary"""
        return {
            'id': self.id,
            'symbol': self.symbol,
            'exchange': self.exchange,
            'date': self.date.strftime('%Y-%m-%d'),
            'time': self.time.strftime('%H:%M:%S') if self.time else None,
            'open': self.open,
            'high': self.high,
            'low': self.low,
            'close': self.close,
            'volume': self.volume,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def get_data_by_timeframe(cls, symbol, start_date, end_date, timeframe='1d', exchange=None):
        """Get stock data for the specified symbol and timeframe"""
        query = cls.query.filter(
            cls.symbol == symbol,
            cls.date >= start_date,
            cls.date <= end_date
        )
        
        if exchange: # Optional: filter by exchange if provided
            query = query.filter(cls.exchange == exchange)
            
        query = query.order_by(cls.date, cls.time)
        
        return query.all()
