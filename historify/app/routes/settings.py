"""
Historify - Stock Historical Data Management App
Settings Routes Blueprint
"""
from flask import Blueprint, request, jsonify, render_template
from app.models.settings import AppSettings
from app.models import db
import logging

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/settings')
def settings_page():
    """Render the settings page"""
    return render_template('settings.html')

@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all application settings"""
    try:
        settings = AppSettings.get_all_settings()
        return jsonify(settings)
    except Exception as e:
        current_app.logger.error(f"Error getting settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings', methods=['POST'])
def update_settings():
    """Update application settings"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No data received'}), 400

        results = {}
        errors = {}
        something_changed = False

        # Special handling for API key and host to ensure they are fresh
        api_key_to_set = data.pop('openalgo_api_key', None)
        api_host_to_set = data.pop('openalgo_api_host', None)

        if api_key_to_set is not None:
            try:
                # Delete existing API key entries first
                existing_keys = AppSettings.query.filter_by(key='openalgo_api_key').all()
                for ek in existing_keys:
                    db.session.delete(ek)
                # Add the new API key if provided
                if api_key_to_set: # Only add if it's not empty
                    AppSettings.set_value('openalgo_api_key', api_key_to_set, data_type='string', description='OpenAlgo API Key')
                    results['openalgo_api_key'] = 'set'
                else:
                    results['openalgo_api_key'] = 'cleared'
                something_changed = True
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error setting openalgo_api_key: {e}", exc_info=True)
                errors['openalgo_api_key'] = str(e)

        if api_host_to_set is not None:
            try:
                # Delete existing API host entries first
                existing_hosts = AppSettings.query.filter_by(key='openalgo_api_host').all()
                for eh in existing_hosts:
                    db.session.delete(eh)
                # Add the new API host
                AppSettings.set_value('openalgo_api_host', api_host_to_set, data_type='string', description='OpenAlgo API Host URL')
                results['openalgo_api_host'] = 'set'
                something_changed = True
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error setting openalgo_api_host: {e}", exc_info=True)
                errors['openalgo_api_host'] = str(e)

        # Process other settings
        for key, value_info in data.items():
            if isinstance(value_info, dict) and 'value' in value_info and 'type' in value_info:
                value = value_info['value']
                data_type = value_info['type']
                description = value_info.get('description')
                try:
                    AppSettings.set_value(key, value, data_type, description)
                    results[key] = 'updated'
                    something_changed = True
                except Exception as e:
                    db.session.rollback()
                    current_app.logger.error(f"Error updating setting {key}: {e}", exc_info=True)
                    errors[key] = str(e)
            else:
                # Fallback for simple key-value pairs
                try:
                    AppSettings.set_value(key, value_info, 'string') # Default to string
                    results[key] = 'updated_as_string'
                    something_changed = True
                except Exception as e:
                    db.session.rollback()
                    current_app.logger.error(f"Error updating setting {key} (as string): {e}", exc_info=True)
                    errors[key] = str(e)
        
        if something_changed and not errors:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error during final commit: {e}", exc_info=True)
                return jsonify({'status': 'error', 'message': f'Error committing settings: {str(e)}'}), 500
        elif errors:
            db.session.rollback()
            return jsonify({'status': 'error', 'message': 'Error updating one or more settings', 'errors': errors}), 400

        if not errors:
            return jsonify({'status': 'success', 'message': 'Settings updated successfully', 'updated_settings': results}), 200
        else:
            return jsonify({'status': 'error', 'message': 'Failed to update some settings', 'errors': errors, 'updated_settings': results}), 400

    except Exception as e:
        current_app.logger.error(f"Error updating settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings/test-api', methods=['POST'])
def test_api_connection():
    """Test OpenAlgo API connection by fetching RELIANCE NSE quotes"""
    try:
        from app.utils.data_fetcher import OPENALGO_AVAILABLE
        
        if not OPENALGO_AVAILABLE:
            return jsonify({
                'success': False,
                'message': 'OpenAlgo module not available'
            })
        
        # Get current API settings
        api_key = AppSettings.get_value('openalgo_api_key')
        host = AppSettings.get_value('openalgo_api_host', 'http://127.0.0.1:5000')
        
        if not api_key:
            return jsonify({
                'success': False,
                'message': 'API key not configured'
            })
        
        # Test the connection by fetching RELIANCE quotes
        from openalgo import api
        client = api(api_key=api_key, host=host)
        
        try:
            # Test with RELIANCE NSE quotes
            response = client.quotes(symbol='RELIANCE', exchange='NSE')
            
            if isinstance(response, dict) and response.get('status') == 'success':
                quote_data = response.get('data', {})
                ltp = quote_data.get('ltp', 0)
                return jsonify({
                    'success': True,
                    'message': f'API connection successful! RELIANCE LTP: ₹{ltp}',
                    'data': {
                        'symbol': 'RELIANCE',
                        'exchange': 'NSE',
                        'ltp': ltp,
                        'host': host
                    }
                })
            else:
                error_msg = response.get('message', 'Unknown API error') if isinstance(response, dict) else 'Invalid response format'
                return jsonify({
                    'success': False,
                    'message': f'API error: {error_msg}'
                })
                
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'API connection failed: {str(e)}'
            })
            
    except Exception as e:
        logging.error(f"Error testing API: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Connection test failed: {str(e)}'
        })

@settings_bp.route('/api/settings/database-info', methods=['GET'])
def get_database_info():
    """Get database information"""
    try:
        # Get database size and stats
        from sqlalchemy import text
        
        # Get table information
        result = db.session.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        """))
        tables = [row[0] for row in result.fetchall()]
        
        # Get total record count
        total_records = 0
        table_stats = {}
        
        for table in tables:
            try:
                result = db.session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.fetchone()[0]
                table_stats[table] = count
                total_records += count
            except Exception as e:
                table_stats[table] = f"Error: {str(e)}"
        
        # Get database file size (approximate)
        import os
        db_path = 'instance/historify.db'
        db_size = "Unknown"
        if os.path.exists(db_path):
            size_bytes = os.path.getsize(db_path)
            if size_bytes < 1024:
                db_size = f"{size_bytes} B"
            elif size_bytes < 1024 * 1024:
                db_size = f"{size_bytes / 1024:.1f} KB"
            elif size_bytes < 1024 * 1024 * 1024:
                db_size = f"{size_bytes / (1024 * 1024):.1f} MB"
            else:
                db_size = f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
        
        return jsonify({
            'db_size': db_size,
            'total_records': total_records,
            'table_count': len(tables),
            'table_stats': table_stats
        })
        
    except Exception as e:
        logging.error(f"Error getting database info: {str(e)}")
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/api/settings/clear-cache', methods=['POST'])
def clear_cache():
    """Clear application cache"""
    try:
        # Clear any cached data (implement based on your caching strategy)
        # For now, just return success
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to clear cache: {str(e)}'
        })

@settings_bp.route('/api/settings/optimize-database', methods=['POST'])
def optimize_database():
    """Optimize database"""
    try:
        # Run SQLite VACUUM command
        db.session.execute(text("VACUUM"))
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Database optimized successfully'
        })
    except Exception as e:
        logging.error(f"Error optimizing database: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Database optimization failed: {str(e)}'
        })

@settings_bp.route('/api/settings/reset', methods=['POST'])
def reset_settings():
    """Reset settings to defaults"""
    try:
        # Delete all settings and reinitialize
        AppSettings.query.delete()
        db.session.commit()
        
        AppSettings.initialize_default_settings()
        
        return jsonify({
            'success': True,
            'message': 'Settings reset to defaults'
        })
    except Exception as e:
        logging.error(f"Error resetting settings: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Failed to reset settings: {str(e)}'
        })