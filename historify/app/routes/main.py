"""
Historify - Stock Historical Data Management App
Main Routes Blueprint
"""
from flask import Blueprint, render_template, current_app
from app.models import db

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Render the home page"""
    return render_template('index.html', title="Historify - Stock Data Manager")

@main_bp.route('/watchlist/')
def watchlist_page():
    return render_template('watchlist.html')

@main_bp.route('/dashboard/')
def dashboard_page():
    return render_template('dashboard.html')

@main_bp.route('/profile/')
def profile_page():
    # existing code for profile page
    pass

@main_bp.route('/import')
def import_symbols():
    """Render the import symbols page"""
    return render_template('import.html')

@main_bp.route('/export')
def export_data():
    """Render the export data page"""
    return render_template('export.html')

@main_bp.route('/download')
def bulk_download():
    """Render the bulk download page"""
    return render_template('download.html')

