"""
Historify - Stock Historical Data Management App
Scheduler Routes Blueprint
"""
from flask import Blueprint, request, jsonify, render_template
from app.utils.scheduler import scheduler_manager
import logging

scheduler_bp = Blueprint('scheduler', __name__)

@scheduler_bp.route('/scheduler')
def scheduler_page():
    """Scheduler management page"""
    return render_template('scheduler.html')

@scheduler_bp.route('/api/scheduler/jobs', methods=['GET'])
def get_scheduler_jobs():
    """Get all scheduled jobs"""
    try:
        logging.info("Getting scheduler jobs")
        jobs = scheduler_manager.get_jobs()
        logging.info(f"Found {len(jobs)} jobs")
        return jsonify(jobs)
    except Exception as e:
        logging.error(f"Error in get_scheduler_jobs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@scheduler_bp.route('/api/scheduler/jobs', methods=['POST'])
def create_scheduler_job():
    """Create a new scheduled job"""
    try:
        data = request.json
        job_type = data.get('type')
        
        if job_type == 'daily':
            time_str = data.get('time')
            if not time_str:
                return jsonify({'error': 'Time is required for daily jobs'}), 400
            
            job_id = scheduler_manager.add_daily_download_job(
                time_str=time_str,
                symbols=data.get('symbols'),
                exchanges=data.get('exchanges'),
                interval=data.get('interval', 'D'),
                job_id=data.get('job_id')
            )
            
        elif job_type == 'interval':
            minutes = data.get('minutes')
            if not minutes:
                return jsonify({'error': 'Minutes is required for interval jobs'}), 400
            
            job_id = scheduler_manager.add_interval_download_job(
                minutes=int(minutes),
                symbols=data.get('symbols'),
                exchanges=data.get('exchanges'),
                interval=data.get('interval', 'D'),
                job_id=data.get('job_id')
            )
            
        elif job_type == 'market_close':
            job_id = scheduler_manager.add_market_close_job(
                job_id=data.get('job_id')
            )
            
        elif job_type == 'pre_market':
            job_id = scheduler_manager.add_pre_market_job(
                job_id=data.get('job_id')
            )
            
        else:
            return jsonify({'error': 'Invalid job type'}), 400
        
        return jsonify({
            'job_id': job_id,
            'message': 'Job created successfully'
        })
        
    except Exception as e:
        logging.error(f"Error creating scheduler job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@scheduler_bp.route('/api/scheduler/jobs/<job_id>', methods=['DELETE'])
def delete_scheduler_job(job_id):
    """Delete a scheduled job"""
    try:
        success = scheduler_manager.remove_job(job_id)
        if success:
            return jsonify({'message': 'Job deleted successfully'})
        else:
            return jsonify({'error': 'Failed to delete job'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scheduler_bp.route('/api/scheduler/jobs/<job_id>/pause', methods=['POST'])
def pause_scheduler_job(job_id):
    """Pause a scheduled job"""
    try:
        success = scheduler_manager.pause_job(job_id)
        if success:
            return jsonify({'message': 'Job paused successfully'})
        else:
            return jsonify({'error': 'Failed to pause job'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scheduler_bp.route('/api/scheduler/jobs/<job_id>/resume', methods=['POST'])
def resume_scheduler_job(job_id):
    """Resume a paused job"""
    try:
        success = scheduler_manager.resume_job(job_id)
        if success:
            return jsonify({'message': 'Job resumed successfully'})
        else:
            return jsonify({'error': 'Failed to resume job'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@scheduler_bp.route('/api/scheduler/jobs/<job_id>/run', methods=['POST'])
def run_scheduler_job_now(job_id):
    """Run a job immediately"""
    try:
        # Get job info
        jobs = scheduler_manager.get_jobs()
        job_info = next((j for j in jobs if j['id'] == job_id), None)
        
        if not job_info:
            return jsonify({'error': 'Job not found'}), 404
        
        # Execute the download within app context
        from flask import current_app
        with current_app.app_context():
            scheduler_manager._execute_download(
                symbols=job_info.get('symbols'),
                exchanges=job_info.get('exchanges'),
                interval=job_info.get('interval', 'D')
            )
        
        return jsonify({'message': 'Job executed successfully'})
        
    except Exception as e:
        logging.error(f"Error running job {job_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@scheduler_bp.route('/api/scheduler/test', methods=['POST'])
def test_scheduler():
    """Test scheduler with a quick job"""
    try:
        logging.info("Creating test scheduler job")
        
        # Add a simple interval job for testing
        job_id = scheduler_manager.add_interval_download_job(
            minutes=1,  # Run every minute for testing
            symbols=None,  # Use all watchlist symbols
            exchanges=None,
            interval='D',
            job_id='test_job_interval'
        )
        
        return jsonify({
            'message': 'Test job created - runs every minute',
            'job_id': job_id
        })
        
    except Exception as e:
        logging.error(f"Error creating test job: {str(e)}")
        return jsonify({'error': str(e)}), 500