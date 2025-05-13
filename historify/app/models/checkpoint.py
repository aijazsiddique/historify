"""
Historify - Stock Historical Data Management App
Checkpoint Model
"""
from app.models import db
from datetime import datetime

class Checkpoint(db.Model):
    """Model for tracking last downloaded data points for incremental updates"""
    __tablename__ = 'checkpoints'
    
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), unique=True, nullable=False)
    last_downloaded_date = db.Column(db.Date, nullable=True)
    last_downloaded_time = db.Column(db.Time, nullable=True)
    last_update = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Checkpoint {self.symbol} {self.last_downloaded_date}>'
    
    def to_dict(self):
        """Convert the model instance to a dictionary"""
        return {
            'id': self.id,
            'symbol': self.symbol,
            'last_downloaded_date': self.last_downloaded_date.strftime('%Y-%m-%d') if self.last_downloaded_date else None,
            'last_downloaded_time': self.last_downloaded_time.strftime('%H:%M:%S') if self.last_downloaded_time else None,
            'last_update': self.last_update.isoformat() if self.last_update else None
        }
