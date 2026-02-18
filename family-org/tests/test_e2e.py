import requests
import time
import unittest

class TestFamilyOrgEndToEnd(unittest.TestCase):
    BACKEND_URL = "http://localhost:8090"
    FRONTEND_URL = "http://localhost:5180"

    def test_01_backend_health(self):
        response = requests.get(f"{self.BACKEND_URL}/health")
        self.assertEqual(response.status_code, 200)

    def test_02_full_flow(self):
        # 1. Create a test user
        user = requests.post(f"{self.BACKEND_URL}/auth/test-user", json={
            "email": "test@example.com", "name": "Test User"
        }).json()
        user_id = user["id"]

        # 2. Add standard chore
        res = requests.post(f"{self.BACKEND_URL}/chores/", json={
            "title": "Clean Room", "is_bonus": False, "frequency": "daily"
        })
        std_id = res.json()["id"]

        # 3. Add bonus chore
        res = requests.post(f"{self.BACKEND_URL}/chores/", json={
            "title": "Wash Car", "is_bonus": True, "reward_money": 5.00
        })
        bonus_id = res.json()["id"]

        # 4. Try to complete bonus - should fail (400) because standard is NOT YET ASSIGNED but exists?
        # Actually, the logic is: incomplete chores ASSIGNED TO THIS USER.
        # Let's assign standard to user first.
        
        # 5. Complete standard for user
        res = requests.put(f"{self.BACKEND_URL}/chores/{std_id}/complete?user_id={user_id}")
        self.assertEqual(res.status_code, 200)

        # 6. Now complete bonus for user - should work
        res = requests.put(f"{self.BACKEND_URL}/chores/{bonus_id}/complete?user_id={user_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["money_added"], 5.00)

if __name__ == "__main__":
    unittest.main()
