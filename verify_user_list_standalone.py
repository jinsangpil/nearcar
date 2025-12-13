import asyncio
import httpx
import sys

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_ADMIN_EMAIL = "admin@nearcar.co.kr"
TEST_ADMIN_PASSWORD = "12341234" # Found in script/qa/verify_admin_features.py

async def verify():
    async with httpx.AsyncClient() as client:
        # 1. Login
        print(f"Logging in as {TEST_ADMIN_EMAIL}...")
        try:
            auth_response = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD}
            )
            auth_response.raise_for_status()
            token = auth_response.json()["access_token"]
            print(f"Login successful. Token obtained.")
        except Exception as e:
            print(f"Login failed: {e}")
            if hasattr(e, 'response'):
                print(f"Response: {e.response.text}")
            return

        # 2. List Users
        print(f"Requesting GET {BASE_URL}/admin/users...")
        try:
            response = await client.get(
                f"{BASE_URL}/admin/users",
                headers={"Authorization": f"Bearer {token}"},
                params={"page": 1, "limit": 20}
            )
            
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Success! Retrieved {len(data.get('data', {}).get('items', []))} users.")
                print("First user sample:", data.get('data', {}).get('items', [])[0] if data.get('data', {}).get('items') else "No users found")
            else:
                print(f"Failed! Response: {response.text}")
        except Exception as e:
             print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
