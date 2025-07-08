"""
Historify - Stock Historical Data Management App
Data Resampler Utility

Core resampling engine for converting 1-minute OHLCV data to higher timeframes.
Uses pandas.resample() for efficient OHLCV aggregation with proper timezone handling.
"""

import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Union
import pytz
from app.models.stock_data import StockData
from sqlalchemy import and_

logger = logging.getLogger(__name__)


class DataResampler:
    """
    Core data resampling engine for converting 1-minute OHLCV data to higher timeframes.
    
    This class provides methods to:
    - Aggregate 1-minute OHLCV data into higher timeframes (5m, 15m, 30m, 1h, 1d)
    - Handle timezone conversions for proper market hour aggregation
    - Validate data integrity before and after resampling
    - Process large datasets in chunks for memory efficiency
    - Track progress for long-running operations
    """
    
    # Standard timeframes for financial data analysis
    STANDARD_TIMEFRAMES = {
        '5m': {
            'pandas_freq': '5T',
            'description': '5 minutes',
            'multiplier': 5,
            'base_unit': 'minute',
            'trading_periods_per_day': 75,  # Assuming 6.25 hour trading day
            'category': 'intraday'
        },
        '15m': {
            'pandas_freq': '15T',
            'description': '15 minutes',
            'multiplier': 15,
            'base_unit': 'minute',
            'trading_periods_per_day': 25,
            'category': 'intraday'
        },
        '30m': {
            'pandas_freq': '30T',
            'description': '30 minutes',
            'multiplier': 30,
            'base_unit': 'minute',
            'trading_periods_per_day': 13,  # Rounded for 6.5 hour day
            'category': 'intraday'
        },
        '1h': {
            'pandas_freq': '1H',
            'description': '1 hour',
            'multiplier': 1,
            'base_unit': 'hour',
            'trading_periods_per_day': 7,   # Rounded for 6.5 hour day
            'category': 'intraday'
        },
        '1d': {
            'pandas_freq': '1D',
            'description': '1 day',
            'multiplier': 1,
            'base_unit': 'day',
            'trading_periods_per_day': 1,
            'category': 'daily'
        }
    }
    
    # Supported timeframe mappings for pandas resample
    SUPPORTED_TIMEFRAMES = {
        '1m': '1min',  # 1 minute
        '5m': '5min',  # 5 minutes
        '15m': '15min',# 15 minutes
        '30m': '30min',# 30 minutes
        '1h': '1H',    # 1 hour
        '1d': '1D',    # 1 day
        '1w': '1W',    # 1 week
        '1M': '1MS'    # 1 month (start)
    }
    
    # Market timezone mappings
    MARKET_TIMEZONES = {
        'NSE': 'Asia/Kolkata',
        'BSE': 'Asia/Kolkata',
        'NYSE': 'America/New_York',
        'NASDAQ': 'America/New_York',
        'LSE': 'Europe/London',
        'TSE': 'Asia/Tokyo'
    }
    
    def __init__(self, chunk_size: int = 10000, progress_callback: Optional[callable] = None):
        """
        Initialize the DataResampler.
        
        Args:
            chunk_size: Maximum number of data points to process in one chunk
            progress_callback: Optional callback function to track progress
        """
        self.chunk_size = chunk_size
        self.progress_callback = progress_callback
        self._current_progress = 0
        self._total_operations = 0
    
    def _update_progress(self, completed: int, total: int, message: str = ""):
        """Update progress tracking."""
        self._current_progress = completed
        self._total_operations = total
        progress_pct = (completed / total * 100) if total > 0 else 0
        
        logger.info(f"Resampling progress: {completed}/{total} ({progress_pct:.1f}%) {message}")
        
        if self.progress_callback:
            self.progress_callback(completed, total, progress_pct, message)
    
    def _get_market_timezone(self, exchange: str) -> pytz.timezone:
        """Get the appropriate timezone for the given exchange."""
        tz_name = self.MARKET_TIMEZONES.get(exchange.upper(), 'UTC')
        return pytz.timezone(tz_name)
    
    def _validate_timeframe(self, timeframe: str) -> str:
        """
        Validate and return the pandas-compatible timeframe string.
        
        Args:
            timeframe: Timeframe string (e.g., '5m', '1h', '1d')
            
        Returns:
            Pandas-compatible timeframe string
            
        Raises:
            ValueError: If timeframe is not supported
        """
        if timeframe not in self.SUPPORTED_TIMEFRAMES:
            supported = ', '.join(self.SUPPORTED_TIMEFRAMES.keys())
            raise ValueError(f"Unsupported timeframe '{timeframe}'. Supported: {supported}")
        
        return self.SUPPORTED_TIMEFRAMES[timeframe]
    
    def _prepare_dataframe(self, data: List[StockData], exchange: str) -> pd.DataFrame:
        """
        Convert StockData objects to a pandas DataFrame with proper datetime index.
        
        Args:
            data: List of StockData objects
            exchange: Exchange name for timezone handling
            
        Returns:
            DataFrame with datetime index and OHLCV columns
        """
        if not data:
            return pd.DataFrame()
        
        # Convert to list of dictionaries
        records = []
        for record in data:
            # Combine date and time into datetime
            dt = datetime.combine(record.date, record.time or datetime.min.time())
            records.append({
                'datetime': dt,
                'open': record.open,
                'high': record.high,
                'low': record.low,
                'close': record.close,
                'volume': record.volume
            })
        
        # Create DataFrame
        df = pd.DataFrame(records)
        
        # Set datetime as index and localize to market timezone
        df.set_index('datetime', inplace=True)
        market_tz = self._get_market_timezone(exchange)
        
        # Localize to market timezone if not already timezone-aware
        if df.index.tz is None:
            df.index = df.index.tz_localize(market_tz)
        else:
            df.index = df.index.tz_convert(market_tz)
        
        # Sort by datetime to ensure proper order
        df.sort_index(inplace=True)
        
        return df
    
    def aggregate_open(self, df: pd.DataFrame, target_timeframe: str) -> pd.Series:
        """
        Aggregate Open prices - takes the first value in each period.
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            
        Returns:
            Series with aggregated Open prices
        """
        if df.empty:
            return pd.Series(dtype=float)
        
        return df['open'].resample(target_timeframe, label='left', closed='left').first()
    
    def aggregate_high(self, df: pd.DataFrame, target_timeframe: str) -> pd.Series:
        """
        Aggregate High prices - takes the maximum value in each period.
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            
        Returns:
            Series with aggregated High prices
        """
        if df.empty:
            return pd.Series(dtype=float)
        
        return df['high'].resample(target_timeframe, label='left', closed='left').max()
    
    def aggregate_low(self, df: pd.DataFrame, target_timeframe: str) -> pd.Series:
        """
        Aggregate Low prices - takes the minimum value in each period.
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            
        Returns:
            Series with aggregated Low prices
        """
        if df.empty:
            return pd.Series(dtype=float)
        
        return df['low'].resample(target_timeframe, label='left', closed='left').min()
    
    def aggregate_close(self, df: pd.DataFrame, target_timeframe: str) -> pd.Series:
        """
        Aggregate Close prices - takes the last value in each period.
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            
        Returns:
            Series with aggregated Close prices
        """
        if df.empty:
            return pd.Series(dtype=float)
        
        return df['close'].resample(target_timeframe, label='left', closed='left').last()
    
    def aggregate_volume(self, df: pd.DataFrame, target_timeframe: str) -> pd.Series:
        """
        Aggregate Volume - sums all volume values in each period.
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            
        Returns:
            Series with aggregated Volume
        """
        if df.empty:
            return pd.Series(dtype=int)
        
        return df['volume'].resample(target_timeframe, label='left', closed='left').sum()
    
    def aggregate_ohlcv_advanced(self, df: pd.DataFrame, target_timeframe: str, 
                                 custom_agg_rules: Optional[Dict[str, str]] = None) -> pd.DataFrame:
        """
        Advanced OHLCV aggregation with custom aggregation rules and additional validation.
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            custom_agg_rules: Optional custom aggregation rules for specific columns
            
        Returns:
            Aggregated DataFrame with enhanced validation
        """
        if df.empty:
            return df
        
        # Default aggregation rules (can be overridden)
        default_agg_rules = {
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        }
        
        # Merge with custom rules if provided
        if custom_agg_rules:
            agg_rules = {**default_agg_rules, **custom_agg_rules}
        else:
            agg_rules = default_agg_rules
        
        # Use individual aggregation methods for better control
        resampled_data = {}
        
        if 'open' in df.columns and 'open' in agg_rules:
            resampled_data['open'] = self.aggregate_open(df, target_timeframe)
        
        if 'high' in df.columns and 'high' in agg_rules:
            resampled_data['high'] = self.aggregate_high(df, target_timeframe)
        
        if 'low' in df.columns and 'low' in agg_rules:
            resampled_data['low'] = self.aggregate_low(df, target_timeframe)
        
        if 'close' in df.columns and 'close' in agg_rules:
            resampled_data['close'] = self.aggregate_close(df, target_timeframe)
        
        if 'volume' in df.columns and 'volume' in agg_rules:
            resampled_data['volume'] = self.aggregate_volume(df, target_timeframe)
        
        # Combine all series into a DataFrame
        resampled = pd.DataFrame(resampled_data)
        
        # Remove rows where all OHLC values are NaN (no data for that period)
        if not resampled.empty:
            ohlc_columns = [col for col in ['open', 'high', 'low', 'close'] if col in resampled.columns]
            if ohlc_columns:
                resampled = resampled.dropna(subset=ohlc_columns, how='all')
        
        # Ensure volume is not NaN (fill with 0 if needed)
        if 'volume' in resampled.columns:
            resampled['volume'] = resampled['volume'].fillna(0)
        
        # Additional validation: ensure high >= low for each period
        if 'high' in resampled.columns and 'low' in resampled.columns:
            invalid_hl = resampled['high'] < resampled['low']
            if invalid_hl.any():
                logger.warning(f"Found {invalid_hl.sum()} periods where High < Low, adjusting...")
                # Fix by setting high = low (conservative approach)
                resampled.loc[invalid_hl, 'high'] = resampled.loc[invalid_hl, 'low']
        
        return resampled

    def _aggregate_ohlcv(self, df: pd.DataFrame, target_timeframe: str) -> pd.DataFrame:
        """
        Aggregate OHLCV data using dedicated aggregation methods.
        
        This method now uses the individual aggregation methods for better control
        and validation:
        - Open: First value in the period (aggregate_open)
        - High: Maximum value in the period (aggregate_high)
        - Low: Minimum value in the period (aggregate_low)
        - Close: Last value in the period (aggregate_close)
        - Volume: Sum of all values in the period (aggregate_volume)
        
        Args:
            df: DataFrame with OHLCV data
            target_timeframe: Target timeframe for aggregation
            
        Returns:
            Aggregated DataFrame with enhanced validation
        """
        # Use the advanced aggregation method for better control
        return self.aggregate_ohlcv_advanced(df, target_timeframe)
    
    def validate_ohlcv_aggregation_rules(self, agg_rules: Dict[str, str]) -> Dict[str, any]:
        """
        Validate custom OHLCV aggregation rules.
        
        Args:
            agg_rules: Dictionary of column names to aggregation methods
            
        Returns:
            Dictionary with validation results
        """
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        # Valid aggregation methods for each OHLCV component
        valid_methods = {
            'open': ['first', 'mean', 'median'],  # First is recommended
            'high': ['max', 'mean', 'median'],    # Max is recommended
            'low': ['min', 'mean', 'median'],     # Min is recommended
            'close': ['last', 'mean', 'median'],  # Last is recommended
            'volume': ['sum', 'mean', 'max']      # Sum is recommended
        }
        
        for column, method in agg_rules.items():
            if column in valid_methods:
                if method not in valid_methods[column]:
                    validation_result['errors'].append(
                        f"Invalid aggregation method '{method}' for {column}. "
                        f"Valid methods: {', '.join(valid_methods[column])}"
                    )
                    validation_result['valid'] = False
                elif method != self._get_recommended_method(column):
                    validation_result['warnings'].append(
                        f"Non-standard aggregation method '{method}' for {column}. "
                        f"Recommended: {self._get_recommended_method(column)}"
                    )
            else:
                validation_result['warnings'].append(
                    f"Unknown OHLCV column '{column}' in aggregation rules"
                )
        
        return validation_result
    
    def _get_recommended_method(self, column: str) -> str:
        """Get the recommended aggregation method for each OHLCV column."""
        recommendations = {
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        }
        return recommendations.get(column, 'first')

    def _validate_data_integrity(self, original_df: pd.DataFrame, resampled_df: pd.DataFrame) -> Dict[str, any]:
        """
        Validate data integrity before and after resampling.
        
        Args:
            original_df: Original DataFrame before resampling
            resampled_df: Resampled DataFrame
            
        Returns:
            Dictionary with validation results
        """
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'stats': {
                'original_records': len(original_df),
                'resampled_records': len(resampled_df),
                'original_volume': original_df['volume'].sum() if not original_df.empty else 0,
                'resampled_volume': resampled_df['volume'].sum() if not resampled_df.empty else 0,
                'date_range_original': None,
                'date_range_resampled': None
            }
        }
        
        if not original_df.empty:
            validation_results['stats']['date_range_original'] = (
                original_df.index.min(), original_df.index.max()
            )
        
        if not resampled_df.empty:
            validation_results['stats']['date_range_resampled'] = (
                resampled_df.index.min(), resampled_df.index.max()
            )
        
        # Check volume conservation
        original_volume = validation_results['stats']['original_volume']
        resampled_volume = validation_results['stats']['resampled_volume']
        
        if abs(original_volume - resampled_volume) > 0.01:  # Allow for small floating point differences
            validation_results['errors'].append(
                f"Volume mismatch: original={original_volume}, resampled={resampled_volume}"
            )
            validation_results['valid'] = False
        
        # Check for invalid OHLC relationships in resampled data
        if not resampled_df.empty:
            invalid_ohlc = resampled_df[
                (resampled_df['high'] < resampled_df['low']) |
                (resampled_df['high'] < resampled_df['open']) |
                (resampled_df['high'] < resampled_df['close']) |
                (resampled_df['low'] > resampled_df['open']) |
                (resampled_df['low'] > resampled_df['close'])
            ]
            
            if not invalid_ohlc.empty:
                validation_results['errors'].append(
                    f"Invalid OHLC relationships found in {len(invalid_ohlc)} records"
                )
                validation_results['valid'] = False
        
        # Check for significant data reduction
        if len(original_df) > 0:
            reduction_ratio = len(resampled_df) / len(original_df)
            if reduction_ratio > 0.9:  # Less than 10% reduction might indicate an issue
                validation_results['warnings'].append(
                    f"Low data reduction ratio: {reduction_ratio:.2f} (expected higher compression)"
                )
        
        return validation_results
    
    def resample(self, df: pd.DataFrame, target_timeframe: str) -> pd.DataFrame:
        """
        Resample a DataFrame to a target timeframe.
        
        Args:
            df: DataFrame with datetime index and OHLCV columns
            target_timeframe: Target timeframe for resampling
            
        Returns:
            Resampled DataFrame
        """
        pandas_target_tf = self._validate_timeframe(target_timeframe)
        return self._aggregate_ohlcv(df, pandas_target_tf)

    def resample_data(
        self,
        symbol: str,
        exchange: str,
        start_date: datetime,
        end_date: datetime,
        source_timeframe: str = '1m',
        target_timeframe: str = '5m'
    ) -> Dict[str, any]:
        """
        Resample OHLCV data from source timeframe to target timeframe.
        
        Args:
            symbol: Stock symbol
            exchange: Exchange name
            start_date: Start date for data
            end_date: End date for data
            source_timeframe: Source data timeframe (currently supports '1m')
            target_timeframe: Target timeframe for resampling
            
        Returns:
            Dictionary containing resampled data and metadata
        """
        logger.info(f"Starting resampling for {symbol} ({exchange}) from {source_timeframe} to {target_timeframe}")
        
        try:
            # Validate timeframes
            pandas_target_tf = self._validate_timeframe(target_timeframe)
            
            if source_timeframe != '1m':
                raise ValueError(f"Currently only '1m' source timeframe is supported, got '{source_timeframe}'")
            
            # Initialize progress tracking
            self._update_progress(0, 100, f"Starting resampling {symbol}")
            
            # Fetch source data from database
            self._update_progress(10, 100, "Fetching source data")
            
            query = StockData.query.filter(
                and_(
                    StockData.symbol == symbol,
                    StockData.exchange == exchange,
                    StockData.date >= start_date.date(),
                    StockData.date <= end_date.date()
                )
            ).order_by(StockData.date, StockData.time)
            
            # Get total count for progress tracking
            total_records = query.count()
            if total_records == 0:
                return {
                    'success': False,
                    'error': f"No data found for {symbol} on {exchange} between {start_date} and {end_date}",
                    'data': [],
                    'metadata': {}
                }
            
            self._update_progress(20, 100, f"Found {total_records} records")
            
            # Process data in chunks if necessary
            if total_records > self.chunk_size:
                return self._resample_large_dataset(
                    query, symbol, exchange, target_timeframe, total_records
                )
            else:
                return self._resample_small_dataset(
                    query.all(), symbol, exchange, target_timeframe
                )
                
        except Exception as e:
            logger.error(f"Error resampling data for {symbol}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'data': [],
                'metadata': {}
            }
    
    def _resample_small_dataset(
        self,
        data: List[StockData],
        symbol: str,
        exchange: str,
        target_timeframe: str
    ) -> Dict[str, any]:
        """Resample a small dataset that fits in memory."""
        
        self._update_progress(30, 100, "Preparing data")
        
        # Convert to DataFrame
        df = self._prepare_dataframe(data, exchange)
        
        self._update_progress(50, 100, "Resampling data")
        
        # Perform resampling
        pandas_target_tf = self._validate_timeframe(target_timeframe)
        resampled_df = self._aggregate_ohlcv(df, pandas_target_tf)
        
        self._update_progress(80, 100, "Validating results")
        
        # Validate results
        validation = self._validate_data_integrity(df, resampled_df)
        
        # Convert back to list of dictionaries
        result_data = []
        for timestamp, row in resampled_df.iterrows():
            result_data.append({
                'datetime': timestamp.isoformat(),
                'date': timestamp.date().isoformat(),
                'time': timestamp.time().isoformat(),
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': int(row['volume'])
            })
        
        self._update_progress(100, 100, "Completed")
        
        return {
            'success': validation['valid'],
            'data': result_data,
            'metadata': {
                'symbol': symbol,
                'exchange': exchange,
                'target_timeframe': target_timeframe,
                'total_records': len(result_data),
                'validation': validation,
                'processing_time': None  # Could add timing if needed
            },
            'warnings': validation.get('warnings', []),
            'errors': validation.get('errors', []) if not validation['valid'] else []
        }
    
    def _resample_large_dataset(
        self,
        query,
        symbol: str,
        exchange: str,
        target_timeframe: str,
        total_records: int
    ) -> Dict[str, any]:
        """Resample a large dataset using chunked processing."""
        
        logger.info(f"Processing large dataset with {total_records} records in chunks of {self.chunk_size}")
        
        all_resampled_data = []
        processed_records = 0
        pandas_target_tf = self._validate_timeframe(target_timeframe)
        
        # Process in chunks
        offset = 0
        while offset < total_records:
            chunk_data = query.offset(offset).limit(self.chunk_size).all()
            
            if not chunk_data:
                break
            
            # Process this chunk
            chunk_df = self._prepare_dataframe(chunk_data, exchange)
            chunk_resampled = self._aggregate_ohlcv(chunk_df, pandas_target_tf)
            
            # Convert chunk to list format
            for timestamp, row in chunk_resampled.iterrows():
                all_resampled_data.append({
                    'datetime': timestamp.isoformat(),
                    'date': timestamp.date().isoformat(),
                    'time': timestamp.time().isoformat(),
                    'open': float(row['open']),
                    'high': float(row['high']),
                    'low': float(row['low']),
                    'close': float(row['close']),
                    'volume': int(row['volume'])
                })
            
            processed_records += len(chunk_data)
            progress = int((processed_records / total_records) * 80) + 20  # 20-100%
            self._update_progress(progress, 100, f"Processed {processed_records}/{total_records} records")
            
            offset += self.chunk_size
        
        # Sort final results by datetime
        all_resampled_data.sort(key=lambda x: x['datetime'])
        
        self._update_progress(100, 100, "Completed chunked processing")
        
        return {
            'success': True,
            'data': all_resampled_data,
            'metadata': {
                'symbol': symbol,
                'exchange': exchange,
                'target_timeframe': target_timeframe,
                'total_records': len(all_resampled_data),
                'source_records': total_records,
                'chunks_processed': (total_records + self.chunk_size - 1) // self.chunk_size,
                'processing_method': 'chunked'
            },
            'warnings': [],
            'errors': []
        }
    
    @classmethod
    def get_standard_timeframes(cls) -> List[str]:
        """
        Get list of supported standard timeframes.
        
        Returns:
            List of standard timeframe strings
        """
        return list(cls.STANDARD_TIMEFRAMES.keys())
    
    @classmethod
    def is_standard_timeframe(cls, timeframe: str) -> bool:
        """
        Check if a timeframe is a standard supported timeframe.
        
        Args:
            timeframe: Timeframe string to check
            
        Returns:
            True if timeframe is standard, False otherwise
        """
        return timeframe in cls.STANDARD_TIMEFRAMES
    
    @classmethod
    def get_timeframe_info(cls, timeframe: str) -> Dict[str, any]:
        """
        Get detailed information about a timeframe.
        
        Args:
            timeframe: Timeframe string
            
        Returns:
            Dictionary with timeframe information
        """
        if timeframe in cls.STANDARD_TIMEFRAMES:
            return cls.STANDARD_TIMEFRAMES[timeframe].copy()
        elif timeframe in cls.SUPPORTED_TIMEFRAMES:
            return {
                'pandas_freq': cls.SUPPORTED_TIMEFRAMES[timeframe],
                'description': timeframe,
                'category': 'other'
            }
        else:
            return {}
    
    @classmethod
    def validate_timeframe_conversion(cls, source_tf: str, target_tf: str) -> Dict[str, any]:
        """
        Validate that a timeframe conversion is valid and efficient.
        
        Args:
            source_tf: Source timeframe
            target_tf: Target timeframe
            
        Returns:
            Dictionary with validation results
        """
        validation_result = {
            'valid': True,
            'warnings': [],
            'errors': [],
            'conversion_factor': None,
            'efficiency': 'optimal'
        }
        
        # Currently we only support conversion from 1m
        if source_tf != '1m':
            validation_result['errors'].append(
                f"Currently only '1m' source timeframe is supported, got '{source_tf}'"
            )
            validation_result['valid'] = False
            return validation_result
        
        # Check if target timeframe is supported
        if not cls.is_standard_timeframe(target_tf):
            if target_tf in cls.SUPPORTED_TIMEFRAMES:
                validation_result['warnings'].append(
                    f"Timeframe '{target_tf}' is supported but not in standard set"
                )
            else:
                validation_result['errors'].append(
                    f"Unsupported target timeframe '{target_tf}'"
                )
                validation_result['valid'] = False
                return validation_result
        
        # Calculate conversion factor for standard timeframes
        if target_tf in cls.STANDARD_TIMEFRAMES:
            target_info = cls.STANDARD_TIMEFRAMES[target_tf]
            if target_info['base_unit'] == 'minute':
                validation_result['conversion_factor'] = target_info['multiplier']
            elif target_info['base_unit'] == 'hour':
                validation_result['conversion_factor'] = target_info['multiplier'] * 60
            elif target_info['base_unit'] == 'day':
                validation_result['conversion_factor'] = target_info['multiplier'] * 1440  # 24 * 60
        
        # Assess efficiency
        if target_tf in ['5m', '15m', '30m']:
            validation_result['efficiency'] = 'optimal'
        elif target_tf in ['1h']:
            validation_result['efficiency'] = 'good'
        elif target_tf in ['1d']:
            validation_result['efficiency'] = 'moderate'
        else:
            validation_result['efficiency'] = 'unknown'
        
        return validation_result
    
    def resample_to_standard_timeframes(
        self,
        symbol: str,
        exchange: str,
        start_date: datetime,
        end_date: datetime,
        target_timeframes: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, any]]:
        """
        Resample 1-minute data to multiple standard timeframes in one operation.
        
        Args:
            symbol: Stock symbol
            exchange: Exchange name
            start_date: Start date for data
            end_date: End date for data
            target_timeframes: List of target timeframes, defaults to all standard ones
            
        Returns:
            Dictionary with results for each timeframe
        """
        if target_timeframes is None:
            target_timeframes = self.get_standard_timeframes()
        
        results = {}
        
        # Validate all timeframes first
        for tf in target_timeframes:
            validation = self.validate_timeframe_conversion('1m', tf)
            if not validation['valid']:
                results[tf] = {
                    'success': False,
                    'error': f"Invalid timeframe conversion: {', '.join(validation['errors'])}",
                    'data': [],
                    'metadata': {'validation': validation}
                }
                continue
        
        # Get source data once for all conversions
        logger.info(f"Fetching 1m data for {symbol} to resample to: {', '.join(target_timeframes)}")
        
        try:
            query = StockData.query.filter(
                and_(
                    StockData.symbol == symbol,
                    StockData.exchange == exchange,
                    StockData.date >= start_date.date(),
                    StockData.date <= end_date.date()
                )
            ).order_by(StockData.date, StockData.time)
            
            source_data = query.all()
            if not source_data:
                error_msg = f"No 1m data found for {symbol} on {exchange}"
                for tf in target_timeframes:
                    results[tf] = {
                        'success': False,
                        'error': error_msg,
                        'data': [],
                        'metadata': {}
                    }
                return results
            
            # Prepare source DataFrame once
            source_df = self._prepare_dataframe(source_data, exchange)
            
            # Resample to each target timeframe
            for tf in target_timeframes:
                if tf in results:  # Skip if already failed validation
                    continue
                
                try:
                    logger.info(f"Resampling {symbol} from 1m to {tf}")
                    
                    # Use the existing aggregation method
                    resampled_df = self.aggregate_ohlcv_advanced(source_df, self.SUPPORTED_TIMEFRAMES[tf])
                    
                    # Validate results
                    validation = self._validate_data_integrity(source_df, resampled_df)
                    
                    # Convert to output format
                    result_data = []
                    for timestamp, row in resampled_df.iterrows():
                        result_data.append({
                            'datetime': timestamp.isoformat(),
                            'date': timestamp.date().isoformat(),
                            'time': timestamp.time().isoformat(),
                            'open': float(row['open']),
                            'high': float(row['high']),
                            'low': float(row['low']),
                            'close': float(row['close']),
                            'volume': int(row['volume'])
                        })
                    
                    results[tf] = {
                        'success': validation['valid'],
                        'data': result_data,
                        'metadata': {
                            'symbol': symbol,
                            'exchange': exchange,
                            'source_timeframe': '1m',
                            'target_timeframe': tf,
                            'total_records': len(result_data),
                            'source_records': len(source_data),
                            'timeframe_info': self.get_timeframe_info(tf),
                            'validation': validation
                        },
                        'warnings': validation.get('warnings', []),
                        'errors': validation.get('errors', []) if not validation['valid'] else []
                    }
                    
                except Exception as e:
                    logger.error(f"Error resampling {symbol} to {tf}: {str(e)}")
                    results[tf] = {
                        'success': False,
                        'error': str(e),
                        'data': [],
                        'metadata': {
                            'symbol': symbol,
                            'exchange': exchange,
                            'target_timeframe': tf
                        }
                    }
            
            return results
            
        except Exception as e:
            logger.error(f"Error in multi-timeframe resampling for {symbol}: {str(e)}")
            # Return error for all timeframes
            error_result = {
                'success': False,
                'error': str(e),
                'data': [],
                'metadata': {}
            }
            return {tf: error_result for tf in target_timeframes}
    
    @classmethod
    def recommend_timeframes_for_range(cls, start_date: datetime, end_date: datetime) -> List[str]:
        """
        Recommend appropriate timeframes based on the date range.
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            List of recommended timeframes
        """
        date_range = (end_date - start_date).days
        
        recommendations = []
        
        if date_range <= 1:  # Intraday
            recommendations = ['5m', '15m', '30m', '1h']
        elif date_range <= 7:  # Week
            recommendations = ['15m', '30m', '1h', '1d']
        elif date_range <= 30:  # Month
            recommendations = ['1h', '1d']
        elif date_range <= 365:  # Year
            recommendations = ['1d']
        else:  # Long term
            recommendations = ['1d']
        
        return recommendations
    
    def get_optimal_chunk_size_for_timeframe(self, timeframe: str, total_records: int) -> int:
        """
        Calculate optimal chunk size based on target timeframe and total records.
        
        Args:
            timeframe: Target timeframe
            total_records: Total number of source records
            
        Returns:
            Optimal chunk size
        """
        if timeframe not in self.STANDARD_TIMEFRAMES:
            return self.chunk_size
        
        tf_info = self.STANDARD_TIMEFRAMES[timeframe]
        
        # Calculate compression ratio
        if tf_info['base_unit'] == 'minute':
            compression_ratio = tf_info['multiplier']
        elif tf_info['base_unit'] == 'hour':
            compression_ratio = tf_info['multiplier'] * 60
        elif tf_info['base_unit'] == 'day':
            compression_ratio = tf_info['multiplier'] * 1440
        else:
            compression_ratio = 1
        
        # Adjust chunk size based on compression
        # Higher compression = can handle larger chunks
        adjusted_chunk_size = min(
            self.chunk_size * max(1, compression_ratio // 5),
            50000  # Maximum chunk size
        )
        
        return int(adjusted_chunk_size)
