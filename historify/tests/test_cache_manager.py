"""
Unit tests for the Cache Manager utility.
"""
import unittest
from datetime import date
from app import create_app
from app.utils.cache_manager import generate_cache_key, get_cache_timeout, cache

class TestCacheManager(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app_context = self.app.app_context()
        self.app_context.push()
        cache.clear()

    def tearDown(self):
        self.app_context.pop()

    def test_generate_cache_key(self):
        """Test cache key generation."""
        key = generate_cache_key('RELIANCE', '5m', date(2025, 1, 1), date(2025, 1, 2))
        self.assertEqual(key, 'resampled_RELIANCE_5m_2025-01-01_2025-01-02')

    def test_get_cache_timeout(self):
        """Test cache timeout logic."""
        self.assertEqual(get_cache_timeout('5m'), 15 * 60)
        self.assertEqual(get_cache_timeout('1h'), 15 * 60)
        self.assertEqual(get_cache_timeout('1d'), 60 * 60)
        self.assertEqual(get_cache_timeout('W'), 60 * 60)

    def test_cache_set_and_get(self):
        """Test setting and getting from cache."""
        cache.set('test_key', 'test_value', timeout=10)
        self.assertEqual(cache.get('test_key'), 'test_value')

    def test_cache_clear(self):
        """Test clearing the cache."""
        cache.set('test_key', 'test_value')
        cache.clear()
        self.assertIsNone(cache.get('test_key'))

if __name__ == '__main__':
    unittest.main()
