import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.inventory_logs import Inventory_logsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/inventory_logs", tags=["inventory_logs"])


# ---------- Pydantic Schemas ----------
class Inventory_logsData(BaseModel):
    """Entity data schema (for create/update)"""
    lot_id: str
    lot_name: str
    sub_entity_name: str
    variant_name: str = None
    lot_variant_name: str = None
    sac_type: str = None
    dps_name: str
    completed_key: str


class Inventory_logsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    lot_id: Optional[str] = None
    lot_name: Optional[str] = None
    sub_entity_name: Optional[str] = None
    variant_name: Optional[str] = None
    lot_variant_name: Optional[str] = None
    sac_type: Optional[str] = None
    dps_name: Optional[str] = None
    completed_key: Optional[str] = None


class Inventory_logsResponse(BaseModel):
    """Entity response schema"""
    id: int
    lot_id: str
    lot_name: str
    sub_entity_name: str
    variant_name: Optional[str] = None
    lot_variant_name: Optional[str] = None
    sac_type: Optional[str] = None
    dps_name: str
    completed_key: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Inventory_logsListResponse(BaseModel):
    """List response schema"""
    items: List[Inventory_logsResponse]
    total: int
    skip: int
    limit: int


class Inventory_logsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Inventory_logsData]


class Inventory_logsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Inventory_logsUpdateData


class Inventory_logsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Inventory_logsBatchUpdateItem]


class Inventory_logsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Inventory_logsListResponse)
async def query_inventory_logss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query inventory_logss with filtering, sorting, and pagination"""
    logger.debug(f"Querying inventory_logss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Inventory_logsService(db)
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
        logger.debug(f"Found {result['total']} inventory_logss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying inventory_logss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Inventory_logsListResponse)
async def query_inventory_logss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query inventory_logss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying inventory_logss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Inventory_logsService(db)
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
        logger.debug(f"Found {result['total']} inventory_logss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying inventory_logss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Inventory_logsResponse)
async def get_inventory_logs(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single inventory_logs by ID"""
    logger.debug(f"Fetching inventory_logs with id: {id}, fields={fields}")
    
    service = Inventory_logsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Inventory_logs with id {id} not found")
            raise HTTPException(status_code=404, detail="Inventory_logs not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching inventory_logs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Inventory_logsResponse, status_code=201)
async def create_inventory_logs(
    data: Inventory_logsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new inventory_logs"""
    logger.debug(f"Creating new inventory_logs with data: {data}")
    
    service = Inventory_logsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create inventory_logs")
        
        logger.info(f"Inventory_logs created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating inventory_logs: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating inventory_logs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Inventory_logsResponse], status_code=201)
async def create_inventory_logss_batch(
    request: Inventory_logsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple inventory_logss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} inventory_logss")
    
    service = Inventory_logsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} inventory_logss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Inventory_logsResponse])
async def update_inventory_logss_batch(
    request: Inventory_logsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple inventory_logss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} inventory_logss")
    
    service = Inventory_logsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} inventory_logss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Inventory_logsResponse)
async def update_inventory_logs(
    id: int,
    data: Inventory_logsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing inventory_logs"""
    logger.debug(f"Updating inventory_logs {id} with data: {data}")

    service = Inventory_logsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Inventory_logs with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Inventory_logs not found")
        
        logger.info(f"Inventory_logs {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating inventory_logs {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating inventory_logs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_inventory_logss_batch(
    request: Inventory_logsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple inventory_logss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} inventory_logss")
    
    service = Inventory_logsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} inventory_logss successfully")
        return {"message": f"Successfully deleted {deleted_count} inventory_logss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_inventory_logs(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single inventory_logs by ID"""
    logger.debug(f"Deleting inventory_logs with id: {id}")
    
    service = Inventory_logsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Inventory_logs with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Inventory_logs not found")
        
        logger.info(f"Inventory_logs {id} deleted successfully")
        return {"message": "Inventory_logs deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting inventory_logs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")