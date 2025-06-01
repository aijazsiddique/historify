"""
Historify - Stock Historical Data Management App
Application Factory
"""
import os
from flask import Flask
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def create_app(config_class=None):
    """Create and configure the Flask application"""
    app = Flask(__name__, instance_relative_config=True)
    
    # Configure the app from environment variables
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key_change_this')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///historify.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass
    
    # Initialize extensions
    from app.models import db
    db.init_app(app)
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    from app.routes.watchlist import watchlist_bp
    from app.routes.charts import charts_bp
    from app.routes.scheduler import scheduler_bp
    from app.routes.settings import settings_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(watchlist_bp, url_prefix='/watchlist')
    app.register_blueprint(charts_bp, url_prefix='/charts')
    app.register_blueprint(scheduler_bp)
    app.register_blueprint(settings_bp)
    
    # Initialize scheduler
    from app.utils.scheduler import scheduler_manager
    import logging
    logging.basicConfig(level=logging.INFO)
    logging.info("Initializing scheduler manager")
    scheduler_manager.init_app(app)
    
    # Add API configuration check middleware
    from app.utils.auth import check_api_config_middleware
    app.before_request(check_api_config_middleware)
    
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
        
        # Initialize default settings
        from app.models.settings import AppSettings
        AppSettings.initialize_default_settings()
    
    return app
