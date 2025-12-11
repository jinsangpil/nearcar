from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update
from typing import Optional, List, Dict, Any
import uuid

from app.models.review import Review
from app.models.user import User

class ReviewService:
    @staticmethod
    async def create_review(
        db: AsyncSession,
        user_id: uuid.UUID,
        inspection_id: uuid.UUID,
        rating: int,
        content: Optional[str] = None,
        photos: Optional[List[str]] = None
    ) -> Review:
        review = Review(
            user_id=user_id,
            inspection_id=inspection_id,
            rating=rating,
            content=content,
            photos=photos
        )
        db.add(review)
        await db.commit()
        await db.refresh(review)
        return review

    @staticmethod
    async def get_reviews(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        rating: Optional[int] = None,
        is_hidden: Optional[bool] = None
    ) -> Dict[str, Any]:
        query = select(Review).order_by(desc(Review.created_at))
        
        if rating:
            query = query.where(Review.rating == rating)
        if is_hidden is not None:
            query = query.where(Review.is_hidden == is_hidden)
            
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query)
        
        # Paginate
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        items = result.scalars().all()
        
        return {
            "items": items,
            "total": total or 0
        }

    @staticmethod
    async def update_visibility(
        db: AsyncSession,
        review_id: uuid.UUID,
        is_hidden: bool
    ) -> Optional[Review]:
        query = update(Review).where(Review.id == review_id).values(is_hidden=is_hidden).returning(Review)
        result = await db.execute(query)
        await db.commit()
        return result.scalar_one_or_none()
