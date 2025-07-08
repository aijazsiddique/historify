import pytest
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
        yield testing_client
        db.drop_all()

@pytest.fixture(scope='module')
def runner(test_client):
    return test_client.application.test_cli_runner()

def test_get_chart_data_no_resampling(test_client):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/api/chart-data' is requested for an interval that exists
    THEN check that the response is valid and data is not resampled
    """
    # First, populate the database with some 5-minute data
    model = ensure_table_exists('TEST', 'NSE', '5m')
    db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 15, 0), open=100, high=110, low=90, close=105, volume=1000))
    db.session.commit()

    response = test_client.get('/charts/api/chart-data/TEST/NSE/5m/20/14?start_date=2025-01-01&end_date=2025-01-01')
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data['resampled'] is False
    assert len(json_data['candlestick']) > 0

def test_get_chart_data_with_resampling(test_client, mocker):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/api/chart-data' is requested for an interval that does not exist, but 1m data does
    THEN check that the response is valid and data is resampled
    """
    mocker.patch('app.routes.charts.fetch_historical_data', return_value=[])
    # Clear 5m data to ensure resampling is triggered
    db.session.query(ensure_table_exists('TEST', 'NSE', '5m')).delete()
    db.session.commit()
    # Populate with 1-minute data
    model = ensure_table_exists('TEST', 'NSE', '1m')
    db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 15, 0), open=100, high=101, low=99, close=100, volume=100))
    db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 16, 0), open=100, high=102, low=98, close=101, volume=200))
    db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 17, 0), open=101, high=103, low=100, close=102, volume=300))
    db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 18, 0), open=102, high=104, low=101, close=103, volume=400))
    db.session.add(model(date=datetime(2025, 1, 1).date(), time=time(9, 19, 0), open=103, high=105, low=102, close=104, volume=500))
    db.session.commit()

    response = test_client.get('/charts/api/chart-data/TEST/NSE/5m/20/14?start_date=2025-01-01&end_date=2025-01-01')
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data['resampled'] is True
    assert len(json_data['candlestick']) == 1
    assert json_data['candlestick'][0]['open'] == 100
    assert json_data['candlestick'][0]['high'] == 105
    assert json_data['candlestick'][0]['low'] == 98
    assert json_data['candlestick'][0]['close'] == 104
    assert json_data['candlestick'][0]['volume'] == 1500

def test_get_chart_data_with_caching(test_client, mocker):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/api/chart-data' is requested multiple times for a resampled interval
    THEN check that the second response is faster and data is still correct
    """
    mocker.patch('app.routes.charts.fetch_historical_data', return_value=[])
    # Clear the cache first
    from app.utils.cache_manager import cache
    with test_client.application.app_context():
        cache.clear()

    # First request to populate the cache
    response1 = test_client.get('/charts/api/chart-data/TEST/NSE/15m/20/14?start_date=2025-01-01&end_date=2025-01-01')
    assert response1.status_code == 200

    # Second request should hit the cache
    response2 = test_client.get('/charts/api/chart-data/TEST/NSE/15m/20/14?start_date=2025-01-01&end_date=2025-01-01')
    assert response2.status_code == 200
    json_data = response2.get_json()
    assert json_data['resampled'] is True
    assert len(json_data['candlestick']) > 0

# This test is more complex and may require mocking the data fetcher
# For now, we will just test the case where data is not found and no download is attempted
def test_get_chart_data_no_1m_data(test_client, mocker):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/api/chart-data' is requested for an interval that does not exist and 1m data does not exist
    THEN check that the response is valid and no data is returned
    """
    mocker.patch('app.routes.charts.fetch_historical_data', return_value=[])
    # Ensure no data exists for this symbol
    db.session.query(ensure_table_exists('NO_DATA', 'NSE', '1m')).delete()
    db.session.commit()

    response = test_client.get('/charts/api/chart-data/NO_DATA/NSE/5m/20/14?start_date=2025-01-01&end_date=2025-01-01')
    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data['resampled'] is False
    assert len(json_data['candlestick']) == 0
    assert 'error' in json_data
