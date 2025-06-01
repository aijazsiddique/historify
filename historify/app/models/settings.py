"""
Historify - Stock Historical Data Management App
Settings Model for Database Configuration Storage
"""
from app.models import db
from datetime import datetime
from sqlalchemy import text
import json
import logging

class AppSettings(db.Model):
    """Model for storing application settings in database"""
    __tablename__ = 'app_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(255), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, nullable=True)
    data_type = db.Column(db.String(50), default='string')  # string, json, boolean, integer, float
    description = db.Column(db.Text, nullable=True)
    is_encrypted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<AppSettings {self.key}={self.value}>'
    
    @classmethod
    def get_value(cls, key, default=None):
        """Get a setting value by key"""
        try:
            setting = cls.query.filter_by(key=key).first()
            if not setting:
                return default
            
            # Convert based on data type
            if setting.data_type == 'json':
                return json.loads(setting.value) if setting.value else default
            elif setting.data_type == 'boolean':
                return setting.value.lower() in ('true', '1', 'yes') if setting.value else default
            elif setting.data_type == 'integer':
                return int(setting.value) if setting.value else default
            elif setting.data_type == 'float':
                return float(setting.value) if setting.value else default
            else:
                return setting.value if setting.value is not None else default
                
        except Exception as e:
            logging.error(f"Error getting setting {key}: {str(e)}")
            return default
    
    @classmethod
    def set_value(cls, key, value, data_type='string', description=None):
        try:
            if data_type == 'json':
                str_value = json.dumps(value)
            elif data_type == 'boolean':
                str_value = str(bool(value)).lower()
            else:
                str_value = str(value) if value is not None else None

            setting = cls.query.filter_by(key=key).first()

            if setting:
                # Update existing setting
                setting.value = str_value
                setting.data_type = data_type
                if description is not None:
                    setting.description = description
                setting.updated_at = datetime.utcnow()
            else:
                # Create new setting
                new_setting = cls(key=key, value=str_value, data_type=data_type, description=description)
                db.session.add(new_setting)
            
            # The caller (e.g., route handler) is responsible for db.session.commit()
            return True
                
        except Exception as e:
            # The caller (route handler) should manage transactions (commit/rollback).
            current_app.logger.error(f"[AppSettings.set_value] Error for key '{key}': {e}", exc_info=True)
            return False
    
    @classmethod
    def get_all_settings(cls):
        """Get all settings as a dictionary"""
        try:
            settings = {}
            for setting in cls.query.all():
                if setting.data_type == 'json':
                    settings[setting.key] = json.loads(setting.value) if setting.value else None
                elif setting.data_type == 'boolean':
                    settings[setting.key] = setting.value.lower() in ('true', '1', 'yes') if setting.value else False
                elif setting.data_type == 'integer':
                    settings[setting.key] = int(setting.value) if setting.value else 0
                elif setting.data_type == 'float':
                    settings[setting.key] = float(setting.value) if setting.value else 0.0
                else:
                    settings[setting.key] = setting.value
            return settings
        except Exception as e:
            logging.error(f"Error getting all settings: {str(e)}")
            return {}
    
    @classmethod
    def initialize_default_settings(cls):
        """Initialize default settings"""
        defaults = [
            ('openalgo_api_key', '', 'string', 'OpenAlgo API Key for market data'),
            ('openalgo_api_host', 'http://127.0.0.1:5000', 'string', 'OpenAlgo API Host URL'),
            ('batch_size', '10', 'integer', 'Number of symbols to process per batch'),
            ('rate_limit_delay', '100', 'integer', 'Delay between API requests in milliseconds'),
            ('default_date_range', '30', 'integer', 'Default date range in days'),
            ('theme', 'system', 'string', 'Application theme (light, dark, system)'),
            ('auto_refresh', 'true', 'boolean', 'Enable auto-refresh for real-time quotes'),
            ('show_tooltips', 'true', 'boolean', 'Show tooltips throughout the application'),
            ('chart_height', '400', 'integer', 'Default chart height in pixels'),
        ]
        
        for key, value, data_type, description in defaults:
            if not cls.query.filter_by(key=key).first():
                cls.set_value(key, value, data_type, description)
        
        logging.info("Default settings initialized")

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'data_type': self.data_type,
            'description': self.description,
            'is_encrypted': self.is_encrypted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }