import asyncio
import httpx
from script.qa.verify_admin_features import get_access_token, BASE_URL

async def verify_user_list():
    try:
        print("Getting access token...")
        token = await get_access_token()
        
        async with httpx.AsyncClient() as client:
            print(f"Requesting {BASE_URL}/admin/users...")
            response = await client.get(
                f"{BASE_URL}/admin/users",
                headers={"Authorization": f"Bearer {token}"},
                params={"page": 1, "limit": 20}
            )
            
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                print("Success! Response JSON:")
                print(response.json())
            else:
                print(f"Failed! Response: {response.text}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_user_list())
