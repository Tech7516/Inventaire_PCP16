import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.lot_configs import Lot_configsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/lot_configs", tags=["lot_configs"])


# ---------- Pydantic Schemas ----------
class Lot_configsData(BaseModel):
    """Entity data schema (for create/update)"""
    lot_id: str
    config_json: str


class Lot_configsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    lot_id: Optional[str] = None
    config_json: Optional[str] = None


class Lot_configsResponse(BaseModel):
    """Entity response schema"""
    id: int
    lot_id: str
    config_json: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Lot_configsListResponse(BaseModel):
    """List response schema"""
    items: List[Lot_configsResponse]
    total: int
    skip: int
    limit: int


class Lot_configsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Lot_configsData]


class Lot_configsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Lot_configsUpdateData


class Lot_configsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Lot_configsBatchUpdateItem]


class Lot_configsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Lot_configsListResponse)
async def query_lot_configss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query lot_configss with filtering, sorting, and pagination"""
    logger.debug(f"Querying lot_configss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Lot_configsService(db)
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
        logger.debug(f"Found {result['total']} lot_configss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid lot_configs query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying lot_configss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Lot_configsListResponse)
async def query_lot_configss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query lot_configss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying lot_configss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Lot_configsService(db)
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
        logger.debug(f"Found {result['total']} lot_configss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid lot_configs query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying lot_configss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Lot_configsResponse)
async def get_lot_configs(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single lot_configs by ID"""
    logger.debug(f"Fetching lot_configs with id: {id}, fields={fields}")
    
    service = Lot_configsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Lot_configs with id {id} not found")
            raise HTTPException(status_code=404, detail="Lot_configs not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching lot_configs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Lot_configsResponse, status_code=201)
async def create_lot_configs(
    data: Lot_configsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new lot_configs"""
    logger.debug(f"Creating new lot_configs with data: {data}")
    
    service = Lot_configsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create lot_configs")
        
        logger.info(f"Lot_configs created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating lot_configs: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating lot_configs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Lot_configsResponse], status_code=201)
async def create_lot_configss_batch(
    request: Lot_configsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple lot_configss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} lot_configss")
    
    service = Lot_configsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} lot_configss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Lot_configsResponse])
async def update_lot_configss_batch(
    request: Lot_configsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple lot_configss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} lot_configss")
    
    service = Lot_configsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} lot_configss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Lot_configsResponse)
async def update_lot_configs(
    id: int,
    data: Lot_configsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing lot_configs"""
    logger.debug(f"Updating lot_configs {id} with data: {data}")

    service = Lot_configsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Lot_configs with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Lot_configs not found")
        
        logger.info(f"Lot_configs {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating lot_configs {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating lot_configs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_lot_configss_batch(
    request: Lot_configsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple lot_configss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} lot_configss")
    
    service = Lot_configsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} lot_configss successfully")
        return {"message": f"Successfully deleted {deleted_count} lot_configss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_lot_configs(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single lot_configs by ID"""
    logger.debug(f"Deleting lot_configs with id: {id}")
    
    service = Lot_configsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Lot_configs with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Lot_configs not found")
        
        logger.info(f"Lot_configs {id} deleted successfully")
        return {"message": "Lot_configs deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lot_configs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")