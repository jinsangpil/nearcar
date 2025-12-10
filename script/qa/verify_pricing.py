import sys
import os
import asyncio
from sqlalchemy import select
import logging

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from app.core.database import AsyncSessionLocal
from app.services.pricing_service import PricingService
from app.models.vehicle_master import VehicleMaster
from app.models.package import Package
from app.models.service_region import ServiceRegion

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def verify_pricing():
    logger.info("--> Verifying Pricing Logic...")
    
    async with AsyncSessionLocal() as db:
        # Get Test Data
        # 1. Vehicle (Try to find a Compact car for base test)
        result = await db.execute(select(VehicleMaster).limit(1))
        vehicle = result.scalar_one_or_none()
        
        # 2. Package
        result = await db.execute(select(Package).limit(1))
        package = result.scalar_one_or_none()
        
        # 3. Region
        result = await db.execute(select(ServiceRegion).limit(1))
        region = result.scalar_one_or_none()
        
        if not vehicle or not package or not region:
            logger.error("[FAIL] Missing Master Data for Pricing Test (Vehicle/Package/Region needs to exist).")
            return

        logger.info(f"Test Context: Vehicle={vehicle.model_group}({vehicle.vehicle_class}), Package={package.name}, Region={region.city}({region.extra_fee})")

        try:
            quote = await PricingService.calculate_quote(
                db, 
                str(vehicle.id), 
                str(package.id), 
                str(region.id)
            )
            
            logger.info(f"Quote Result: {quote}")
            
            # Verify Calculation
            # Total = Base + Class Surcharge + Region Fee
            # (Rounded up to 10s)
            
            expected_total = quote['base_price'] + quote['class_surcharge'] + quote['region_fee']
            # Rounding logic in service: int(math.ceil(total_amount / 10) * 10)
            import math
            expected_rounded = int(math.ceil(expected_total / 10) * 10)
            
            if quote['total_amount'] == expected_rounded:
                logger.info("[PASS] Price Calculation is correct.")
            else:
                logger.error(f"[FAIL] Price Calculation Mismatch. Service={quote['total_amount']}, Expected={expected_rounded}")

        except Exception as e:
            logger.error(f"[FAIL] Pricing Service Error: {e}")

async def main():
    await verify_pricing()

if __name__ == "__main__":
    asyncio.run(main())
