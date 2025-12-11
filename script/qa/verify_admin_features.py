import sys
import os
import asyncio
import httpx
import logging
import uuid
from sqlalchemy import select
from passlib.context import CryptContext

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TEST_ADMIN_EMAIL = "test_admin@nearcar.com"
TEST_ADMIN_PASSWORD = "admin_password"
BASE_URL = "http://localhost:8000/api/v1"

async def create_test_admin_if_not_exists():
    logger.info("--> Checking/Creating Test Admin User...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == TEST_ADMIN_EMAIL))
        user = result.scalar_one_or_none()
        
        if not user:
            logger.info("Creating new test admin user...")
            hashed_password = pwd_context.hash(TEST_ADMIN_PASSWORD)
            new_admin = User(
                email=TEST_ADMIN_EMAIL,
                password_hash=hashed_password,
                name="Test Admin",
                phone="010-1234-5678",
                role="admin",
                status="active"
            )
            db.add(new_admin)
            await db.commit()
            logger.info(f"Test admin created: {TEST_ADMIN_EMAIL}")
        else:
            logger.info(f"Test admin already exists: {TEST_ADMIN_EMAIL}")

async def get_access_token():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD
            }
        )
        if response.status_code != 200:
            logger.error(f"Login failed: {response.text}")
            return None
        return response.json()["access_token"]

async def verify_faq_api(token):
    logger.info("\n--> Verifying FAQ API...")
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient() as client:
        # 1. Create FAQ
        faq_data = {
            "category": "payment",
            "question": "Test Question?",
            "answer": "Test Answer",
            "is_active": True,
            "display_order": 1
        }
        res = await client.post(f"{BASE_URL}/admin/faqs", json=faq_data, headers=headers)
        if res.status_code != 200:
            logger.error(f"[FAIL] Create FAQ: {res.text}")
            return
        
        faq = res.json()["data"]
        faq_id = faq["id"]
        logger.info(f"[PASS] Create FAQ: ID={faq_id}")
        
        # 2. List FAQs
        res = await client.get(f"{BASE_URL}/admin/faqs", headers=headers)
        if res.status_code != 200:
            logger.error(f"[FAIL] List FAQs: {res.text}")
        else:
            items = res.json()["data"]["items"]
            if any(item["id"] == faq_id for item in items):
                logger.info(f"[PASS] List FAQs: Found created FAQ")
            else:
                logger.error("[FAIL] List FAQs: Created FAQ not found")

        # 3. Update FAQ
        update_data = {"question": "Updated Question?"}
        res = await client.patch(f"{BASE_URL}/admin/faqs/{faq_id}", json=update_data, headers=headers)
        if res.status_code != 200:
             logger.error(f"[FAIL] Update FAQ: {res.text}")
        else:
             if res.json()["data"]["question"] == "Updated Question?":
                 logger.info("[PASS] Update FAQ: Successful")
             else:
                 logger.error("[FAIL] Update FAQ: Value mismatch")

        # 4. Delete FAQ
        res = await client.delete(f"{BASE_URL}/admin/faqs/{faq_id}", headers=headers)
        if res.status_code == 200:
            logger.info("[PASS] Delete FAQ: Successful")
        else:
            logger.error(f"[FAIL] Delete FAQ: {res.text}")

async def verify_review_api(token):
    logger.info("\n--> Verifying Review API...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Note: Creating a review usually requires a completed inspection flow. 
    # For this verification, we will just list reviews since we might rely on seed or previous data.
    # If no reviews exist, empty list is still a valid response.
    
    async with httpx.AsyncClient() as client:
        # 1. List Reviews
        res = await client.get(f"{BASE_URL}/admin/reviews", headers=headers)
        if res.status_code != 200:
            logger.error(f"[FAIL] List Reviews: {res.text}")
            return

        data = res.json()["data"]
        logger.info(f"[PASS] List Reviews: Total={data['total']}")
        
        if data["items"]:
            review_id = data["items"][0]["id"]
            current_hidden = data["items"][0]["is_hidden"]
            
            # 2. Toggle Visibility
            update_data = {"is_hidden": not current_hidden}
            res = await client.patch(f"{BASE_URL}/admin/reviews/{review_id}/visibility", json=update_data, headers=headers)
            
            if res.status_code == 200:
                new_hidden = res.json()["data"]["is_hidden"]
                if new_hidden != current_hidden:
                    logger.info(f"[PASS] Toggle Review Visibility: {current_hidden} -> {new_hidden}")
                else:
                    logger.error("[FAIL] Toggle Review Visibility: Value didn't change")
            else:
                logger.error(f"[FAIL] Toggle Review Visibility: {res.text}")
        else:
            logger.info("[SKIP] No reviews to test toggle visibility.")

async def main():
    try:
        # Wait for server to be potentially ready
        await asyncio.sleep(2)
        
        await create_test_admin_if_not_exists()
        
        token = await get_access_token()
        if not token:
            logger.error("Aborting test due to login failure.")
            return

        await verify_faq_api(token)
        await verify_review_api(token)
        
    except Exception as e:
        import traceback
        logger.error(f"Global Test Error: {e}")
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(main())
