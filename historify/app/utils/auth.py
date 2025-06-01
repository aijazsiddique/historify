"""
Historify - Stock Historical Data Management App
Authentication and Configuration Check Utilities
"""
from functools import wraps
from flask import request, redirect, url_for, flash, jsonify
from app.models.settings import AppSettings


def api_configured():
    """Check if OpenAlgo API is properly configured"""
    api_key = AppSettings.get_value('openalgo_api_key')
    api_host = AppSettings.get_value('openalgo_api_host')
    
    return bool(api_key and api_key.strip() and api_host and api_host.strip())


def require_api_config(f):
    """Decorator to require API configuration before accessing routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Allow access to settings page and API endpoints
        exempt_routes = [
            'settings.settings_page',
            'settings.get_settings', 
            'settings.update_settings',
            'settings.test_api_connection',
            'settings.get_database_info',
            'settings.clear_cache',
            'settings.optimize_database',
            'settings.reset_settings'
        ]
        
        # Check if current endpoint is exempt
        if request.endpoint in exempt_routes:
            return f(*args, **kwargs)
        
        # For API routes, return JSON response
        if request.endpoint and request.endpoint.startswith('api'):
            if not api_configured():
                return jsonify({
                    'error': 'API not configured',
                    'message': 'Please configure OpenAlgo API key and host in Settings'
                }), 401
        else:
            # For web routes, redirect to settings
            if not api_configured():
                flash('Please configure your OpenAlgo API key and host URL before using the application.', 'warning')
                return redirect(url_for('settings.settings_page'))
        
        return f(*args, **kwargs)
    
    return decorated_function


def check_api_config_middleware():
    """Middleware to check API configuration on every request"""
    # Skip check for static files and certain routes
    if (request.endpoint and 
        (request.endpoint.startswith('static') or
         request.endpoint in ['settings.settings_page', 'settings.get_settings', 
                            'settings.update_settings', 'settings.test_api_connection',
                            'settings.get_database_info', 'settings.clear_cache',
                            'settings.optimize_database', 'settings.reset_settings'])):
        return
    
    # Check if API is configured
    if not api_configured():
        # For AJAX requests, return JSON
        if request.is_json or request.headers.get('Content-Type') == 'application/json':
            return jsonify({
                'error': 'API not configured',
                'message': 'Please configure OpenAlgo API key and host in Settings',
                'redirect': url_for('settings.settings_page')
            }), 401
        
        # For regular requests, redirect to settings
        flash('Please configure your OpenAlgo API key and host URL before using the application.', 'warning')
        return redirect(url_for('settings.settings_page'))