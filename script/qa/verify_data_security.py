import sys
import os
import asyncio
from sqlalchemy import select, text
import logging

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from app.core.database import AsyncSessionLocal
from app.models.vehicle_master import VehicleMaster
from app.models.user import User
from app.core.security import decrypt_phone, encrypt_phone

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def verify_vehicle_data():
    logger.info("--> Verifying Vehicle Master Data...")
    async with AsyncSessionLocal() as db:
        result_domestic = await db.execute(select(VehicleMaster).where(VehicleMaster.origin == 'domestic'))
        domestic_count = len(result_domestic.scalars().all())
        
        result_imported = await db.execute(select(VehicleMaster).where(VehicleMaster.origin == 'imported'))
        imported_count = len(result_imported.scalars().all())
        
        logger.info(f"Domestic Vehicles: {domestic_count}")
        logger.info(f"Imported Vehicles: {imported_count}")
        
        if domestic_count > 0 and imported_count > 0:
            logger.info("[PASS] Vehicle Master Data populated.")
        else:
            logger.error("[FAIL] Vehicle Master Data missing or incomplete.")

async def verify_security():
    logger.info("--> Verifying Security (Phone Encryption)...")
    
    # Test encryption/decryption function
    test_phone = "010-1234-5678"
    encrypted = encrypt_phone(test_phone)
    decrypted = decrypt_phone(encrypted)
    
    if test_phone == decrypted and test_phone != encrypted:
        logger.info("[PASS] Encryption/Decryption logic works.")
    else:
        logger.error("[FAIL] Encryption/Decryption logic failed.")
        return

    # Check database records
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.phone.isnot(None)).limit(5))
        users = result.scalars().all()
        
        if not users:
            logger.warning("[WARN] No users found to verify encryption.")
            return

        for user in users:
            try:
                decrypted_phone = decrypt_phone(user.phone)
                # Simple check if it looks like a phone number after decryption
                if decrypted_phone.startswith("010") or "-" in decrypted_phone:
                     logger.info(f"[PASS] User {user.email} phone is encrypted correctly.")
                else:
                     logger.error(f"[FAIL] User {user.email} phone decryption result unexpected: {decrypted_phone}")
            except Exception as e:
                # If decryption fails, it might be plain text or wrong key
                logger.error(f"[FAIL] User {user.email} phone is likely NOT encrypted properly or key mismatch. Error: {e}")
                logger.error(f"     Stored value: {user.phone}")

async def main():
    await verify_vehicle_data()
    await verify_security()

if __name__ == "__main__":
    asyncio.run(main())
