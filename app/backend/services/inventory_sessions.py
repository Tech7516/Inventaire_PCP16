import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.inventory_sessions import Inventory_sessions

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Inventory_sessionsService:
    """Service layer for Inventory_sessions operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Inventory_sessions]:
        """Create a new inventory_sessions"""
        try:
            obj = Inventory_sessions(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created inventory_sessions with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating inventory_sessions: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Inventory_sessions]:
        """Get inventory_sessions by ID"""
        try:
            query = select(Inventory_sessions).where(Inventory_sessions.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching inventory_sessions {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of inventory_sessionss"""
        try:
            query = select(Inventory_sessions)
            count_query = select(func.count(Inventory_sessions.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Inventory_sessions, field):
                        query = query.where(getattr(Inventory_sessions, field) == value)
                        count_query = count_query.where(getattr(Inventory_sessions, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Inventory_sessions, field_name):
                        query = query.order_by(getattr(Inventory_sessions, field_name).desc())
                else:
                    if hasattr(Inventory_sessions, sort):
                        query = query.order_by(getattr(Inventory_sessions, sort))
            else:
                query = query.order_by(Inventory_sessions.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching inventory_sessions list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Inventory_sessions]:
        """Update inventory_sessions"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Inventory_sessions {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated inventory_sessions {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating inventory_sessions {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete inventory_sessions"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Inventory_sessions {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted inventory_sessions {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting inventory_sessions {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Inventory_sessions]:
        """Get inventory_sessions by any field"""
        try:
            if not hasattr(Inventory_sessions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Inventory_sessions")
            result = await self.db.execute(
                select(Inventory_sessions).where(getattr(Inventory_sessions, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching inventory_sessions by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Inventory_sessions]:
        """Get list of inventory_sessionss filtered by field"""
        try:
            if not hasattr(Inventory_sessions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Inventory_sessions")
            result = await self.db.execute(
                select(Inventory_sessions)
                .where(getattr(Inventory_sessions, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Inventory_sessions.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching inventory_sessionss by {field_name}: {str(e)}")
            raise