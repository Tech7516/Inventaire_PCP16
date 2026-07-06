import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, Boolean, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from models.sub_entity_checks import Sub_entity_checks

logger = logging.getLogger(__name__)


def _coerce_query_value(model_class, field_name: str, value: Any) -> Any:
    """Coerce query values to match the SQLAlchemy column type.
    
    URL query params arrive as strings, but PostgreSQL requires type-compatible
    comparisons (e.g. integer = integer, not integer = varchar).
    """
    if not hasattr(model_class, field_name):
        return value
    col = getattr(model_class, field_name)
    # Handle Column properties — descend to the actual Column
    col_type = getattr(col, "type", None)
    if col_type is None:
        return value
    if isinstance(col_type, Integer) and isinstance(value, str):
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    if isinstance(col_type, Boolean) and isinstance(value, str):
        return value.lower() in ("true", "1", "yes")
    return value


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
                        coerced = _coerce_query_value(Sub_entity_checks, field, value)
                        query = query.where(getattr(Sub_entity_checks, field) == coerced)
                        count_query = count_query.where(getattr(Sub_entity_checks, field) == coerced)
            
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