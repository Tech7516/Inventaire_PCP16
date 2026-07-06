import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.inventory_items import Inventory_items

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Inventory_itemsService:
    """Service layer for Inventory_items operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Inventory_items]:
        """Create a new inventory_items"""
        try:
            obj = Inventory_items(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created inventory_items with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating inventory_items: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Inventory_items]:
        """Get inventory_items by ID"""
        try:
            query = select(Inventory_items).where(Inventory_items.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching inventory_items {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of inventory_itemss"""
        try:
            query = select(Inventory_items)
            count_query = select(func.count(Inventory_items.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Inventory_items, field):
                        query = query.where(getattr(Inventory_items, field) == value)
                        count_query = count_query.where(getattr(Inventory_items, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Inventory_items, field_name):
                        query = query.order_by(getattr(Inventory_items, field_name).desc())
                else:
                    if hasattr(Inventory_items, sort):
                        query = query.order_by(getattr(Inventory_items, sort))
            else:
                query = query.order_by(Inventory_items.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching inventory_items list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Inventory_items]:
        """Update inventory_items"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Inventory_items {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated inventory_items {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating inventory_items {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete inventory_items"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Inventory_items {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted inventory_items {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting inventory_items {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Inventory_items]:
        """Get inventory_items by any field"""
        try:
            if not hasattr(Inventory_items, field_name):
                raise ValueError(f"Field {field_name} does not exist on Inventory_items")
            result = await self.db.execute(
                select(Inventory_items).where(getattr(Inventory_items, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching inventory_items by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Inventory_items]:
        """Get list of inventory_itemss filtered by field"""
        try:
            if not hasattr(Inventory_items, field_name):
                raise ValueError(f"Field {field_name} does not exist on Inventory_items")
            result = await self.db.execute(
                select(Inventory_items)
                .where(getattr(Inventory_items, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Inventory_items.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching inventory_itemss by {field_name}: {str(e)}")
            raise