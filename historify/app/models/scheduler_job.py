"""
Historify - Stock Historical Data Management App
Scheduler Job Model
"""
from app.models import db
from datetime import datetime
import json

class SchedulerJob(db.Model):
    """Model for persisting scheduler jobs"""
    __tablename__ = 'scheduler_jobs'
    
    id = db.Column(db.String(100), primary_key=True)
    name = db.Column(db.String(200))
    job_type = db.Column(db.String(50))  # 'daily', 'interval', 'market_close', 'pre_market'
    time = db.Column(db.String(10))  # For daily jobs (HH:MM format)
    minutes = db.Column(db.Integer)  # For interval jobs
    symbols = db.Column(db.Text)  # JSON string of symbols list
    exchanges = db.Column(db.Text)  # JSON string of exchanges list
    interval = db.Column(db.String(10), default='D')  # Data interval (D, W, 1m, 5m, etc.)
    is_paused = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_symbols(self):
        """Get symbols as list"""
        if self.symbols:
            return json.loads(self.symbols)
        return None
    
    def set_symbols(self, symbols_list):
        """Set symbols from list"""
        if symbols_list:
            self.symbols = json.dumps(symbols_list)
        else:
            self.symbols = None
    
    def get_exchanges(self):
        """Get exchanges as list"""
        if self.exchanges:
            return json.loads(self.exchanges)
        return None
    
    def set_exchanges(self, exchanges_list):
        """Set exchanges from list"""
        if exchanges_list:
            self.exchanges = json.dumps(exchanges_list)
        else:
            self.exchanges = None
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'type': self.job_type,
            'time': self.time,
            'minutes': self.minutes,
            'symbols': self.get_symbols(),
            'exchanges': self.get_exchanges(),
            'interval': self.interval,
            'paused': self.is_paused,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }