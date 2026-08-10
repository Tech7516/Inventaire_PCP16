import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.inventory_items import Inventory_itemsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/inventory_items", tags=["inventory_items"])


# ---------- Pydantic Schemas ----------
class Inventory_itemsData(BaseModel):
    """Entity data schema (for create/update)"""
    session_id: int
    sub_entity_id: str
    variant_id: str = None
    sac_type: str = None
    item_id: str
    validated: bool = None
    custom_quantity: str = None
    checker_name: str = None


class Inventory_itemsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_id: Optional[int] = None
    sub_entity_id: Optional[str] = None
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    item_id: Optional[str] = None
    validated: Optional[bool] = None
    custom_quantity: Optional[str] = None
    checker_name: Optional[str] = None


class Inventory_itemsResponse(BaseModel):
    """Entity response schema"""
    id: int
    session_id: int
    sub_entity_id: str
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    item_id: str
    validated: Optional[bool] = None
    custom_quantity: Optional[str] = None
    checker_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Inventory_itemsListResponse(BaseModel):
    """List response schema"""
    items: List[Inventory_itemsResponse]
    total: int
    skip: int
    limit: int


class Inventory_itemsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Inventory_itemsData]


class Inventory_itemsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Inventory_itemsUpdateData


class Inventory_itemsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Inventory_itemsBatchUpdateItem]


class Inventory_itemsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Inventory_itemsListResponse)
async def query_inventory_itemss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query inventory_itemss with filtering, sorting, and pagination"""
    logger.debug(f"Querying inventory_itemss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Inventory_itemsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} inventory_itemss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid inventory_items query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying inventory_itemss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Inventory_itemsListResponse)
async def query_inventory_itemss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query inventory_itemss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying inventory_itemss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Inventory_itemsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} inventory_itemss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid inventory_items query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying inventory_itemss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Inventory_itemsResponse)
async def get_inventory_items(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single inventory_items by ID"""
    logger.debug(f"Fetching inventory_items with id: {id}, fields={fields}")
    
    service = Inventory_itemsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Inventory_items with id {id} not found")
            raise HTTPException(status_code=404, detail="Inventory_items not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching inventory_items {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Inventory_itemsResponse, status_code=201)
async def create_inventory_items(
    data: Inventory_itemsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new inventory_items"""
    logger.debug(f"Creating new inventory_items with data: {data}")
    
    service = Inventory_itemsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create inventory_items")
        
        logger.info(f"Inventory_items created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating inventory_items: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating inventory_items: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Inventory_itemsResponse], status_code=201)
async def create_inventory_itemss_batch(
    request: Inventory_itemsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple inventory_itemss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} inventory_itemss")
    
    service = Inventory_itemsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} inventory_itemss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Inventory_itemsResponse])
async def update_inventory_itemss_batch(
    request: Inventory_itemsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple inventory_itemss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} inventory_itemss")
    
    service = Inventory_itemsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} inventory_itemss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Inventory_itemsResponse)
async def update_inventory_items(
    id: int,
    data: Inventory_itemsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing inventory_items"""
    logger.debug(f"Updating inventory_items {id} with data: {data}")

    service = Inventory_itemsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Inventory_items with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Inventory_items not found")
        
        logger.info(f"Inventory_items {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating inventory_items {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating inventory_items {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_inventory_itemss_batch(
    request: Inventory_itemsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple inventory_itemss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} inventory_itemss")
    
    service = Inventory_itemsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} inventory_itemss successfully")
        return {"message": f"Successfully deleted {deleted_count} inventory_itemss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_inventory_items(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single inventory_items by ID"""
    logger.debug(f"Deleting inventory_items with id: {id}")
    
    service = Inventory_itemsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Inventory_items with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Inventory_items not found")
        
        logger.info(f"Inventory_items {id} deleted successfully")
        return {"message": "Inventory_items deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting inventory_items {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")