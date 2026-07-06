import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.sub_entity_checks import Sub_entity_checks

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Sub_entity_checksService:
    """Service layer for Sub_entity_checks operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Sub_entity_checks]:
        """Create a new sub_entity_checks"""
        try:
            obj = Sub_entity_checks(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created sub_entity_checks with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating sub_entity_checks: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Sub_entity_checks]:
        """Get sub_entity_checks by ID"""
        try:
            query = select(Sub_entity_checks).where(Sub_entity_checks.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching sub_entity_checks {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of sub_entity_checkss"""
        try:
            query = select(Sub_entity_checks)
            count_query = select(func.count(Sub_entity_checks.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Sub_entity_checks, field):
                        query = query.where(getattr(Sub_entity_checks, field) == value)
                        count_query = count_query.where(getattr(Sub_entity_checks, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Sub_entity_checks, field_name):
                        query = query.order_by(getattr(Sub_entity_checks, field_name).desc())
                else:
                    if hasattr(Sub_entity_checks, sort):
                        query = query.order_by(getattr(Sub_entity_checks, sort))
            else:
                query = query.order_by(Sub_entity_checks.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching sub_entity_checks list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Sub_entity_checks]:
        """Update sub_entity_checks"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Sub_entity_checks {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated sub_entity_checks {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating sub_entity_checks {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete sub_entity_checks"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Sub_entity_checks {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted sub_entity_checks {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting sub_entity_checks {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Sub_entity_checks]:
        """Get sub_entity_checks by any field"""
        try:
            if not hasattr(Sub_entity_checks, field_name):
                raise ValueError(f"Field {field_name} does not exist on Sub_entity_checks")
            result = await self.db.execute(
                select(Sub_entity_checks).where(getattr(Sub_entity_checks, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching sub_entity_checks by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Sub_entity_checks]:
        """Get list of sub_entity_checkss filtered by field"""
        try:
            if not hasattr(Sub_entity_checks, field_name):
                raise ValueError(f"Field {field_name} does not exist on Sub_entity_checks")
            result = await self.db.execute(
                select(Sub_entity_checks)
                .where(getattr(Sub_entity_checks, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Sub_entity_checks.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching sub_entity_checkss by {field_name}: {str(e)}")
            raise