import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.discrepancy_reports import Discrepancy_reports

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Discrepancy_reportsService:
    """Service layer for Discrepancy_reports operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Discrepancy_reports]:
        """Create a new discrepancy_reports"""
        try:
            obj = Discrepancy_reports(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created discrepancy_reports with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating discrepancy_reports: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Discrepancy_reports]:
        """Get discrepancy_reports by ID"""
        try:
            query = select(Discrepancy_reports).where(Discrepancy_reports.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching discrepancy_reports {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of discrepancy_reportss"""
        try:
            query = select(Discrepancy_reports)
            count_query = select(func.count(Discrepancy_reports.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Discrepancy_reports, field):
                        query = query.where(getattr(Discrepancy_reports, field) == value)
                        count_query = count_query.where(getattr(Discrepancy_reports, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Discrepancy_reports, field_name):
                        query = query.order_by(getattr(Discrepancy_reports, field_name).desc())
                else:
                    if hasattr(Discrepancy_reports, sort):
                        query = query.order_by(getattr(Discrepancy_reports, sort))
            else:
                query = query.order_by(Discrepancy_reports.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching discrepancy_reports list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Discrepancy_reports]:
        """Update discrepancy_reports"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Discrepancy_reports {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated discrepancy_reports {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating discrepancy_reports {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete discrepancy_reports"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Discrepancy_reports {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted discrepancy_reports {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting discrepancy_reports {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Discrepancy_reports]:
        """Get discrepancy_reports by any field"""
        try:
            if not hasattr(Discrepancy_reports, field_name):
                raise ValueError(f"Field {field_name} does not exist on Discrepancy_reports")
            result = await self.db.execute(
                select(Discrepancy_reports).where(getattr(Discrepancy_reports, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching discrepancy_reports by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Discrepancy_reports]:
        """Get list of discrepancy_reportss filtered by field"""
        try:
            if not hasattr(Discrepancy_reports, field_name):
                raise ValueError(f"Field {field_name} does not exist on Discrepancy_reports")
            result = await self.db.execute(
                select(Discrepancy_reports)
                .where(getattr(Discrepancy_reports, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Discrepancy_reports.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching discrepancy_reportss by {field_name}: {str(e)}")
            raise