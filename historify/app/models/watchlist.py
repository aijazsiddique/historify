"""
Historify - Stock Historical Data Management App
Watchlist Model
"""
from app.models import db
from datetime import datetime

class WatchlistItem(db.Model):
    """Model for storing user's watchlist symbols"""
    __tablename__ = 'watchlist'
    
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100))
    exchange = db.Column(db.String(10), default="NSE")
    added_on = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<WatchlistItem {self.symbol}>'
    
    def to_dict(self):
        """Convert the model instance to a dictionary"""
        return {
            'id': self.id,
            'symbol': self.symbol,
            'name': self.name,
            'exchange': self.exchange,
            'added_on': self.added_on.isoformat() if self.added_on else None
        }
