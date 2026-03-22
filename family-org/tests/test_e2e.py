import os
import requests
import unittest


class TestFamilyOrgEndToEnd(unittest.TestCase):
    BACKEND_URL = os.environ.get("TEST_BACKEND_URL", "http://localhost:8090")
    FRONTEND_URL = os.environ.get("TEST_FRONTEND_URL", "http://localhost:5180")

    def test_backend_health(self):
        response = requests.get(f"{self.BACKEND_URL}/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_league_table(self):
        """Test that the league table endpoint responds."""
        response = requests.get(f"{self.BACKEND_URL}/dashboard/league-table")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_kiosk_dashboard_returns_html(self):
        response = requests.get(f"{self.BACKEND_URL}/dashboard/kiosk")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers["content-type"])
        self.assertIn("The Scanlon Plan", response.text)
        self.assertIn('<meta http-equiv="refresh" content="60">', response.text)

    def test_kiosk_dashboard_has_frequency_tabs_css(self):
        """Check that frequency tab CSS classes are defined (rendered elements depend on data)."""
        response = requests.get(f"{self.BACKEND_URL}/dashboard/kiosk")
        self.assertEqual(response.status_code, 200)
        self.assertIn(".freq-tab-bar", response.text)
        self.assertIn(".freq-panel", response.text)

    def test_kiosk_dashboard_has_ticker_css(self):
        response = requests.get(f"{self.BACKEND_URL}/dashboard/kiosk")
        self.assertEqual(response.status_code, 200)
        self.assertIn("ticker-scroll", response.text)
        self.assertIn("ticker-wrap", response.text)


if __name__ == "__main__":
    unittest.main()
