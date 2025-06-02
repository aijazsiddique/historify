"""
Historify - Stock Historical Data Management App
Database Models Package
"""
from flask_sqlalchemy import SQLAlchemy

# Initialize SQLAlchemy
db = SQLAlchemy()

# Import models to make them available when this package is imported
from app.models.stock_data import StockData
from app.models.watchlist import WatchlistItem
from app.models.checkpoint import Checkpoint
from app.models.settings import AppSettings
from app.models.scheduler_job import SchedulerJob
