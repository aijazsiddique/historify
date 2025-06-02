"""
Historify - Stock Historical Data Management App
Scheduler Module for Automated Data Downloads
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
import pytz
import logging
import json
from app.models import db
from app.models.watchlist import WatchlistItem
from app.models.checkpoint import Checkpoint
from app.models.scheduler_job import SchedulerJob
from app.utils.data_fetcher import fetch_historical_data

# Global scheduler instance
scheduler = None
IST = pytz.timezone('Asia/Kolkata')

class SchedulerManager:
    def __init__(self, app=None):
        self.app = app
        self.scheduler = BackgroundScheduler(timezone=IST)
        self.jobs = {}
        
    def init_app(self, app):
        """Initialize scheduler with Flask app"""
        self.app = app
        try:
            if not self.scheduler.running:
                self.scheduler.start()
                logging.info("Scheduler started with IST timezone")
            else:
                logging.info("Scheduler already running")
            
            # Load persisted jobs from database
            with app.app_context():
                self._load_persisted_jobs()
                
        except Exception as e:
            logging.error(f"Failed to start scheduler: {str(e)}")
        
    def add_daily_download_job(self, time_str, symbols=None, exchanges=None, interval='D', job_id=None, persist=True):
        """
        Add a daily download job at specified IST time
        
        Args:
            time_str: Time in HH:MM format (24-hour)
            symbols: List of symbols to download (None for all watchlist)
            exchanges: List of exchanges corresponding to symbols
            interval: Data interval (default 'D' for daily)
            job_id: Unique job identifier
        """
        try:
            hour, minute = map(int, time_str.split(':'))
            
            if job_id is None:
                job_id = f"daily_download_{time_str.replace(':', '')}"
            
            # Create job function
            def download_job():
                with self.app.app_context():
                    self._execute_download(symbols, exchanges, interval)
            
            # Add job with cron trigger
            job = self.scheduler.add_job(
                func=download_job,
                trigger=CronTrigger(hour=hour, minute=minute, timezone=IST),
                id=job_id,
                replace_existing=True,
                name=f"Daily Download at {time_str} IST"
            )
            
            self.jobs[job_id] = {
                'type': 'daily',
                'time': time_str,
                'symbols': symbols,
                'exchanges': exchanges,
                'interval': interval,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None
            }
            
            logging.info(f"Added daily download job at {time_str} IST")
            
            # Save job to database if persist is True
            if persist:
                scheduler_job = SchedulerJob.query.get(job_id)
                if not scheduler_job:
                    scheduler_job = SchedulerJob(id=job_id)
                
                scheduler_job.name = f"Daily Download at {time_str} IST"
                scheduler_job.job_type = 'daily'
                scheduler_job.time = time_str
                scheduler_job.set_symbols(symbols)
                scheduler_job.set_exchanges(exchanges)
                scheduler_job.interval = interval
                scheduler_job.is_paused = False
                
                db.session.add(scheduler_job)
                db.session.commit()
            
            return job_id
            
        except Exception as e:
            logging.error(f"Error adding daily download job: {str(e)}")
            raise
    
    def add_interval_download_job(self, minutes, symbols=None, exchanges=None, interval='D', job_id=None, persist=True):
        """
        Add a recurring download job that runs every N minutes
        
        Args:
            minutes: Interval in minutes
            symbols: List of symbols to download (None for all watchlist)
            exchanges: List of exchanges corresponding to symbols
            interval: Data interval (default 'D' for daily)
            job_id: Unique job identifier
        """
        try:
            if job_id is None:
                job_id = f"interval_download_{minutes}min"
            
            # Create job function
            def download_job():
                with self.app.app_context():
                    self._execute_download(symbols, exchanges, interval)
            
            # Add job with interval trigger
            job = self.scheduler.add_job(
                func=download_job,
                trigger=IntervalTrigger(minutes=minutes),
                id=job_id,
                replace_existing=True,
                name=f"Download every {minutes} minutes"
            )
            
            self.jobs[job_id] = {
                'type': 'interval',
                'minutes': minutes,
                'symbols': symbols,
                'exchanges': exchanges,
                'interval': interval,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None
            }
            
            logging.info(f"Added interval download job every {minutes} minutes")
            
            # Save job to database if persist is True
            if persist:
                scheduler_job = SchedulerJob.query.get(job_id)
                if not scheduler_job:
                    scheduler_job = SchedulerJob(id=job_id)
                
                scheduler_job.name = f"Download every {minutes} minutes"
                scheduler_job.job_type = 'interval'
                scheduler_job.minutes = minutes
                scheduler_job.set_symbols(symbols)
                scheduler_job.set_exchanges(exchanges)
                scheduler_job.interval = interval
                scheduler_job.is_paused = False
                
                db.session.add(scheduler_job)
                db.session.commit()
            
            return job_id
            
        except Exception as e:
            logging.error(f"Error adding interval download job: {str(e)}")
            raise
    
    def add_market_close_job(self, job_id=None):
        """
        Add a job that runs after market close (3:35 PM IST for NSE)
        """
        job_id = job_id or "market_close_download"
        result = self.add_daily_download_job("15:35", job_id=job_id, persist=False)
        
        # Save to database with proper job_type
        scheduler_job = SchedulerJob.query.get(job_id)
        if not scheduler_job:
            scheduler_job = SchedulerJob(id=job_id)
        
        scheduler_job.name = "Market Close Download"
        scheduler_job.job_type = 'market_close'
        scheduler_job.time = "15:35"
        scheduler_job.interval = 'D'
        scheduler_job.is_paused = False
        
        db.session.add(scheduler_job)
        db.session.commit()
        
        return result
    
    def add_pre_market_job(self, job_id=None):
        """
        Add a job that runs before market open (8:30 AM IST)
        """
        job_id = job_id or "pre_market_download"
        result = self.add_daily_download_job("08:30", job_id=job_id, persist=False)
        
        # Save to database with proper job_type
        scheduler_job = SchedulerJob.query.get(job_id)
        if not scheduler_job:
            scheduler_job = SchedulerJob(id=job_id)
        
        scheduler_job.name = "Pre-Market Download"
        scheduler_job.job_type = 'pre_market'
        scheduler_job.time = "08:30"
        scheduler_job.interval = 'D'
        scheduler_job.is_paused = False
        
        db.session.add(scheduler_job)
        db.session.commit()
        
        return result
    
    def _execute_download(self, symbols=None, exchanges=None, interval='D'):
        """Execute the actual download process"""
        try:
            logging.info(f"Starting scheduled download at {datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S IST')}")
            
            # If no symbols specified, get from watchlist
            if symbols is None:
                watchlist_items = WatchlistItem.query.all()
                symbols = [item.symbol for item in watchlist_items]
                exchanges = [item.exchange for item in watchlist_items]
            
            if not symbols:
                logging.warning("No symbols to download")
                return
            
            # Download data for each symbol
            success_count = 0
            failed_count = 0
            
            for symbol, exchange in zip(symbols, exchanges):
                try:
                    # Get last checkpoint
                    checkpoint = Checkpoint.query.filter_by(symbol=symbol).first()
                    
                    # Determine date range based on interval
                    end_date = datetime.now().strftime('%Y-%m-%d')
                    
                    # Intraday intervals need smaller date ranges
                    is_intraday = interval in ['1m', '3m', '5m', '10m', '15m', '30m', '1h']
                    
                    if checkpoint and checkpoint.last_downloaded_date:
                        if is_intraday:
                            # For intraday data, we want to look at a smaller window
                            # For very small intervals like 1m, even getting just the last few trading days might be enough
                            days_to_lookback = 3 if interval == '1m' else 7
                            # Calculate how many days have passed since last download
                            days_since_checkpoint = (datetime.now().date() - checkpoint.last_downloaded_date).days
                            # Use the smaller of the two values
                            lookback_days = min(days_since_checkpoint, days_to_lookback)
                            start_date = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
                            logging.info(f"Using intraday lookback period of {lookback_days} days for {interval} data")
                        else:
                            # For daily data, start from the day after the last download
                            start_date = (checkpoint.last_downloaded_date + timedelta(days=1)).strftime('%Y-%m-%d')
                    else:
                        # Default lookback period if no checkpoint
                        if is_intraday:
                            # For 1m data, only look back a few days to avoid API limitations
                            if interval == '1m':
                                lookback_days = 3
                            else:
                                lookback_days = 7
                            start_date = (datetime.now() - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
                            logging.info(f"Using default intraday lookback of {lookback_days} days for {interval} data")
                        else:
                            # Default to last 30 days for daily data
                            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                    
                    # Fetch data
                    historical_data = fetch_historical_data(symbol, start_date, end_date, interval=interval, exchange=exchange)
                    
                    if historical_data:
                        # Import the necessary models
                        from app.models.dynamic_tables import ensure_table_exists
                        
                        # Get the dynamic table model
                        table_model = ensure_table_exists(symbol, exchange, interval)
                        
                        # Store data
                        for data_point in historical_data:
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
                                # Create new data point
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
                        if not checkpoint:
                            checkpoint = Checkpoint(symbol=symbol)
                            db.session.add(checkpoint)
                        
                        checkpoint.last_downloaded_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                        checkpoint.last_downloaded_time = datetime.now().time()
                        
                        db.session.commit()
                        success_count += 1
                        logging.info(f"Successfully downloaded data for {symbol}")
                    
                except Exception as e:
                    failed_count += 1
                    logging.error(f"Failed to download data for {symbol}: {str(e)}")
                    db.session.rollback()
            
            logging.info(f"Scheduled download completed: {success_count} success, {failed_count} failed")
            
        except Exception as e:
            logging.error(f"Error in scheduled download: {str(e)}")
    
    def remove_job(self, job_id):
        """Remove a scheduled job"""
        try:
            self.scheduler.remove_job(job_id)
            if job_id in self.jobs:
                del self.jobs[job_id]
            
            # Remove from database
            scheduler_job = SchedulerJob.query.get(job_id)
            if scheduler_job:
                db.session.delete(scheduler_job)
                db.session.commit()
            
            logging.info(f"Removed job: {job_id}")
            return True
        except Exception as e:
            logging.error(f"Error removing job {job_id}: {str(e)}")
            return False
    
    def pause_job(self, job_id):
        """Pause a scheduled job"""
        try:
            self.scheduler.pause_job(job_id)
            if job_id in self.jobs:
                self.jobs[job_id]['paused'] = True
            
            # Update in database
            scheduler_job = SchedulerJob.query.get(job_id)
            if scheduler_job:
                scheduler_job.is_paused = True
                db.session.commit()
            
            logging.info(f"Paused job: {job_id}")
            return True
        except Exception as e:
            logging.error(f"Error pausing job {job_id}: {str(e)}")
            return False
    
    def resume_job(self, job_id):
        """Resume a paused job"""
        try:
            self.scheduler.resume_job(job_id)
            if job_id in self.jobs:
                self.jobs[job_id]['paused'] = False
            
            # Update in database
            scheduler_job = SchedulerJob.query.get(job_id)
            if scheduler_job:
                scheduler_job.is_paused = False
                db.session.commit()
            
            logging.info(f"Resumed job: {job_id}")
            return True
        except Exception as e:
            logging.error(f"Error resuming job {job_id}: {str(e)}")
            return False
    
    def get_jobs(self):
        """Get all scheduled jobs"""
        jobs_list = []
        try:
            if self.scheduler and self.scheduler.running:
                for job in self.scheduler.get_jobs():
                    job_info = {
                        'id': job.id,
                        'name': job.name,
                        'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                        'paused': job.next_run_time is None
                    }
                    
                    # Add additional info from our jobs dict
                    if job.id in self.jobs:
                        job_info.update(self.jobs[job.id])
                    
                    jobs_list.append(job_info)
            else:
                logging.warning("Scheduler is not running")
        except Exception as e:
            logging.error(f"Error getting jobs: {str(e)}")
        
        return jobs_list
    
    def get_job_history(self, job_id, limit=10):
        """Get execution history for a job (would need to implement logging)"""
        # In a production system, this would query a job history table
        # For now, return empty list
        return []
    
    def shutdown(self):
        """Shutdown the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logging.info("Scheduler shut down")

    def _load_persisted_jobs(self):
        """Load persisted jobs from database on startup"""
        try:
            logging.info("Loading persisted scheduler jobs from database")
            jobs = SchedulerJob.query.all()
            
            for job in jobs:
                try:
                    if job.job_type == 'daily':
                        self.add_daily_download_job(
                            time_str=job.time,
                            symbols=job.get_symbols(),
                            exchanges=job.get_exchanges(),
                            interval=job.interval,
                            job_id=job.id,
                            persist=False  # Don't re-save to database
                        )
                    elif job.job_type == 'interval':
                        self.add_interval_download_job(
                            minutes=job.minutes,
                            symbols=job.get_symbols(),
                            exchanges=job.get_exchanges(),
                            interval=job.interval,
                            job_id=job.id,
                            persist=False  # Don't re-save to database
                        )
                    elif job.job_type == 'market_close':
                        self.add_market_close_job(job_id=job.id)
                    elif job.job_type == 'pre_market':
                        self.add_pre_market_job(job_id=job.id)
                    
                    # If job was paused, pause it again
                    if job.is_paused:
                        self.pause_job(job.id)
                    
                    logging.info(f"Loaded persisted job: {job.id}")
                    
                except Exception as e:
                    logging.error(f"Error loading persisted job {job.id}: {str(e)}")
                    
            logging.info(f"Loaded {len(jobs)} persisted jobs")
            
        except Exception as e:
            logging.error(f"Error loading persisted jobs: {str(e)}")

# Create global scheduler instance
scheduler_manager = SchedulerManager()