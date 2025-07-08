import pytest
import json
from app import create_app
from app.models import db
from app.models.dynamic_tables import ensure_table_exists
from datetime import datetime, time

@pytest.fixture(scope='module')
def test_client():
    flask_app = create_app('testing')
    testing_client = flask_app.test_client()

    with flask_app.app_context():
        db.create_all()
        # Create a table for 1-minute data for testing
        ensure_table_exists('TEST', 'NSE', '1m')
        # Populate with 1-minute data
        model = ensure_table_exists('TEST', 'NSE', '1m')
        db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 15, 0), open=100, high=101, low=99, close=100, volume=100))
        db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 16, 0), open=100, high=102, low=98, close=101, volume=200))
        db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 17, 0), open=101, high=103, low=100, close=102, volume=300))
        db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 18, 0), open=102, high=104, low=101, close=103, volume=400))
        db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 19, 0), open=103, high=105, low=102, close=104, volume=500))
        db.session.commit()
        yield testing_client
        db.drop_all()

def test_resample_data_api(test_client):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/api/resample/...' endpoint is requested
    THEN check that the response is valid and data is resampled correctly
    """
    response = test_client.get('/api/resample/TEST/NSE/1m/5m?start_date=2025-01-01&end_date=2025-01-01')
    assert response.status_code == 200
    json_data = response.get_json()
    assert len(json_data) == 1
    assert json_data[0]['open'] == 100
    assert json_data[0]['high'] == 105
    assert json_data[0]['low'] == 98
    assert json_data[0]['close'] == 104
    assert json_data[0]['volume'] == 1500

def test_resample_data_api_invalid_interval(test_client):
    """
    GIVEN a Flask application
    WHEN the '/api/resample/...' is requested with an invalid interval
    THEN check for a 400 error
    """
    response = test_client.get('/api/resample/TEST/NSE/1m/invalid?start_date=2025-01-01&end_date=2025-01-01')
    assert response.status_code == 400
    json_data = response.get_json()
    assert 'error' in json_data

def test_bulk_resample_data_api(test_client):
    """
    GIVEN a Flask application
    WHEN the '/api/charts/resample' endpoint is requested with valid data
    THEN check that the response is valid and contains resampled data
    """
    requests = [
        {
            'symbol': 'TEST',
            'exchange': 'NSE',
            'from_interval': '1m',
            'to_interval': '5m',
            'start_date': '2025-01-01',
            'end_date': '2025-01-01'
        }
    ]
    response = test_client.post('/api/charts/resample', json={'requests': requests})
    assert response.status_code == 200
    json_data = response.get_json()
    assert len(json_data['success']) == 1
    assert len(json_data['failed']) == 0
    assert len(json_data['success'][0]['data']) == 1

def test_get_data_with_resampling_param(test_client):
    """
    GIVEN a Flask application
    WHEN the '/api/data' endpoint is requested with the 'resample_to' parameter
    THEN check that the data is resampled correctly
    """
    response = test_client.get('/api/data?symbol=TEST&exchange=NSE&interval=1m&resample_to=5m&start_date=2025-01-01&end_date=2025-01-01')
    assert response.status_code == 200
    json_data = response.get_json()
    assert len(json_data) == 1
    assert json_data[0]['interval'] == '5m'
    assert json_data[0]['open'] == 100

def test_export_data_with_resampling(test_client):
    """
    GIVEN a Flask application
    WHEN an export is requested with resampling
    THEN check that the download contains resampled data
    """
    export_payload = {
        "symbols": [{"symbol": "TEST", "exchange": "NSE"}],
        "start_date": "2025-01-01",
        "end_date": "2025-01-01",
        "interval": "1m",
        "format": "individual",
        "resample_to": "5m"
    }
    response = test_client.post('/api/export', json=export_payload)
    assert response.status_code == 200
    json_data = response.get_json()
    assert 'download_url' in json_data

    download_response = test_client.get(json_data['download_url'])
    assert download_response.status_code == 200
    csv_data = download_response.data.decode('utf-8')
    assert '100.0,105.0,98.0,104.0,1500' in csv_data
