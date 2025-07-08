import unittest
import pandas as pd
from datetime import datetime, date, time
from unittest.mock import MagicMock, patch
from app import create_app
from app.models import db
from app.utils.data_resampler import DataResampler
from app.models.stock_data import StockData

class TestDataResampler(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config.update({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SCHEDULER_API_ENABLED": False
        })
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        self.resampler = DataResampler()
        self.sample_data = [
            StockData(symbol='TEST', exchange='NSE', date=date(2023, 1, 1), time=time(9, 15), open=100, high=102, low=99, close=101, volume=1000),
            StockData(symbol='TEST', exchange='NSE', date=date(2023, 1, 1), time=time(9, 16), open=101, high=103, low=100, close=102, volume=1200),
            StockData(symbol='TEST', exchange='NSE', date=date(2023, 1, 1), time=time(9, 17), open=102, high=104, low=101, close=103, volume=1100),
            StockData(symbol='TEST', exchange='NSE', date=date(2023, 1, 1), time=time(9, 18), open=103, high=105, low=102, close=104, volume=1300),
            StockData(symbol='TEST', exchange='NSE', date=date(2023, 1, 1), time=time(9, 19), open=104, high=106, low=103, close=105, volume=1400),
        ]

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_timeframe_validation(self):
        self.assertEqual(self.resampler._validate_timeframe('5m'), '5min')
        with self.assertRaises(ValueError):
            self.resampler._validate_timeframe('2m')

    def test_timezone_handling(self):
        df = self.resampler._prepare_dataframe(self.sample_data, 'NSE')
        self.assertEqual(df.index.tz.zone, 'Asia/Kolkata')

    def test_ohlcv_aggregation(self):
        df = self.resampler._prepare_dataframe(self.sample_data, 'NSE')
        resampled_df = self.resampler._aggregate_ohlcv(df, '5min')
        
        self.assertEqual(resampled_df['open'].iloc[0], 100)
        self.assertEqual(resampled_df['high'].iloc[0], 106)
        self.assertEqual(resampled_df['low'].iloc[0], 99)
        self.assertEqual(resampled_df['close'].iloc[0], 105)
        self.assertEqual(resampled_df['volume'].iloc[0], 6000)

    @patch('app.utils.data_resampler.StockData.query')
    def test_resampling_logic(self, mock_query):
        mock_query.filter.return_value.order_by.return_value.count.return_value = len(self.sample_data)
        mock_query.filter.return_value.order_by.return_value.all.return_value = self.sample_data
        
        result = self.resampler.resample_data('TEST', 'NSE', datetime(2023,1,1), datetime(2023,1,1), '1m', '5m')
        
        self.assertTrue(result['success'])
        self.assertEqual(len(result['data']), 1)
        self.assertEqual(result['data'][0]['open'], 100)

    def test_data_integrity_validation(self):
        original_df = self.resampler._prepare_dataframe(self.sample_data, 'NSE')
        resampled_df = self.resampler._aggregate_ohlcv(original_df, '5min')
        
        validation = self.resampler._validate_data_integrity(original_df, resampled_df)
        self.assertTrue(validation['valid'])
        self.assertEqual(validation['stats']['original_volume'], validation['stats']['resampled_volume'])

    @patch('app.utils.data_resampler.StockData.query')
    def test_chunked_processing(self, mock_query):
        # Simulate a large dataset
        large_sample_data = self.sample_data * 2001 # > 10000
        mock_query.filter.return_value.order_by.return_value.count.return_value = len(large_sample_data)
        
        # Mock the chunked query
        def limit_side_effect(limit):
            def offset_side_effect(offset_val):
                return large_sample_data[offset_val:offset_val+limit]
            mock_limit = MagicMock()
            mock_limit.all = MagicMock(side_effect=lambda: offset_side_effect(mock_offset.call_args[0][0]))
            return mock_limit

        mock_query_obj = mock_query.filter.return_value.order_by.return_value
        mock_offset = mock_query_obj.offset
        mock_offset.return_value.limit.side_effect = limit_side_effect
        
        self.resampler.chunk_size = 5000
        result = self.resampler.resample_data('TEST', 'NSE', datetime(2023,1,1), datetime(2023,1,1), '1m', '5m')
        
        self.assertTrue(result['success'])
        self.assertIn('processing_method', result['metadata'])
        self.assertEqual(result['metadata']['processing_method'], 'chunked')

    def test_progress_callback(self):
        progress_callback = MagicMock()
        self.resampler.progress_callback = progress_callback
        
        with patch('app.utils.data_resampler.StockData.query') as mock_query:
            mock_query.filter.return_value.order_by.return_value.count.return_value = len(self.sample_data)
            mock_query.filter.return_value.order_by.return_value.all.return_value = self.sample_data
            self.resampler.resample_data('TEST', 'NSE', datetime(2023,1,1), datetime(2023,1,1), '1m', '5m')
        
        progress_callback.assert_called()
        # Check if the final call was with 100%
        last_call_args = progress_callback.call_args_list[-1][0]
        self.assertEqual(last_call_args[0], 100) # completed
        self.assertEqual(last_call_args[1], 100) # total

if __name__ == '__main__':
    unittest.main()
