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
        except Exception as e:
            logging.error(f"Failed to start scheduler: {str(e)}")
        
    def add_daily_download_job(self, time_str, symbols=None, exchanges=None, interval='D', job_id=None):
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
                'next_run': job.next_run_time.strftime('%Y-%m-%d %H:%M:%S %Z') if job.next_run_time else None
            }
            
            logging.info(f"Added daily download job at {time_str} IST")
            return job_id
            
        except Exception as e:
            logging.error(f"Error adding daily download job: {str(e)}")
            raise
    
    def add_interval_download_job(self, minutes, symbols=None, exchanges=None, interval='D', job_id=None):
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
                'next_run': job.next_run_time.strftime('%Y-%m-%d %H:%M:%S %Z') if job.next_run_time else None
            }
            
            logging.info(f"Added interval download job every {minutes} minutes")
            return job_id
            
        except Exception as e:
            logging.error(f"Error adding interval download job: {str(e)}")
            raise
    
    def add_market_close_job(self, job_id=None):
        """
        Add a job that runs after market close (3:35 PM IST for NSE)
        """
        return self.add_daily_download_job("15:35", job_id=job_id or "market_close_download")
    
    def add_pre_market_job(self, job_id=None):
        """
        Add a job that runs before market open (8:30 AM IST)
        """
        return self.add_daily_download_job("08:30", job_id=job_id or "pre_market_download")
    
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
                    
                    # Determine start date
                    if checkpoint and checkpoint.last_downloaded_date:
                        start_date = (checkpoint.last_downloaded_date + timedelta(days=1)).strftime('%Y-%m-%d')
                    else:
                        # Default to last 30 days if no checkpoint
                        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                    
                    end_date = datetime.now().strftime('%Y-%m-%d')
                    
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
                        'next_run': job.next_run_time.strftime('%Y-%m-%d %H:%M:%S %Z') if job.next_run_time else None,
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

# Create global scheduler instance
scheduler_manager = SchedulerManager()