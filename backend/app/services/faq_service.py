from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from typing import Optional, List
import uuid

from app.models.faq import FAQ

class FAQService:
    @staticmethod
    async def create_faq(
        db: AsyncSession,
        category: str,
        question: str,
        answer: str,
        is_active: bool = True,
        display_order: int = 0
    ) -> FAQ:
        faq = FAQ(
            category=category,
            question=question,
            answer=answer,
            is_active=is_active,
            display_order=display_order
        )
        db.add(faq)
        await db.commit()
        await db.refresh(faq)
        return faq

    @staticmethod
    async def get_faqs(
        db: AsyncSession,
        category: Optional[str] = None
    ) -> List[FAQ]:
        query = select(FAQ).order_by(FAQ.display_order)
        if category:
            query = query.where(FAQ.category == category)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_faq(
        db: AsyncSession,
        faq_id: uuid.UUID,
        **kwargs
    ) -> Optional[FAQ]:
        query = update(FAQ).where(FAQ.id == faq_id).values(**kwargs).returning(FAQ)
        result = await db.execute(query)
        await db.commit()
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_faq(
        db: AsyncSession,
        faq_id: uuid.UUID
    ) -> bool:
        query = delete(FAQ).where(FAQ.id == faq_id)
        result = await db.execute(query)
        await db.commit()
        return result.rowcount > 0
