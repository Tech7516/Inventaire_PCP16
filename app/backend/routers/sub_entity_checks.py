import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.sub_entity_checks import Sub_entity_checksService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/sub_entity_checks", tags=["sub_entity_checks"])


# ---------- Pydantic Schemas ----------
class Sub_entity_checksData(BaseModel):
    """Entity data schema (for create/update)"""
    session_id: int
    sub_entity_id: str
    variant_id: str = None
    sac_type: str = None
    checker_name: str


class Sub_entity_checksUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    session_id: Optional[int] = None
    sub_entity_id: Optional[str] = None
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    checker_name: Optional[str] = None


class Sub_entity_checksResponse(BaseModel):
    """Entity response schema"""
    id: int
    session_id: int
    sub_entity_id: str
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    checker_name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Sub_entity_checksListResponse(BaseModel):
    """List response schema"""
    items: List[Sub_entity_checksResponse]
    total: int
    skip: int
    limit: int


class Sub_entity_checksBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Sub_entity_checksData]


class Sub_entity_checksBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Sub_entity_checksUpdateData


class Sub_entity_checksBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Sub_entity_checksBatchUpdateItem]


class Sub_entity_checksBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Sub_entity_checksListResponse)
async def query_sub_entity_checkss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query sub_entity_checkss with filtering, sorting, and pagination"""
    logger.debug(f"Querying sub_entity_checkss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Sub_entity_checksService(db)
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
        logger.debug(f"Found {result['total']} sub_entity_checkss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid sub_entity_checks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying sub_entity_checkss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Sub_entity_checksListResponse)
async def query_sub_entity_checkss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query sub_entity_checkss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying sub_entity_checkss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Sub_entity_checksService(db)
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
        logger.debug(f"Found {result['total']} sub_entity_checkss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid sub_entity_checks query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying sub_entity_checkss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}")
async def get_sub_entity_checks(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single sub_entity_checks by ID - returns null instead of 404 for SDK compatibility"""
    logger.debug(f"Fetching sub_entity_checks with id: {id}, fields={fields}")
    
    service = Sub_entity_checksService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.debug(f"Sub_entity_checks with id {id} not found - returning null for SDK compatibility")
            return None
        
        return result
    except Exception as e:
        logger.error(f"Error fetching sub_entity_checks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Sub_entity_checksResponse, status_code=201)
async def create_sub_entity_checks(
    data: Sub_entity_checksData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new sub_entity_checks"""
    logger.debug(f"Creating new sub_entity_checks with data: {data}")
    
    service = Sub_entity_checksService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create sub_entity_checks")
        
        logger.info(f"Sub_entity_checks created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating sub_entity_checks: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating sub_entity_checks: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Sub_entity_checksResponse], status_code=201)
async def create_sub_entity_checkss_batch(
    request: Sub_entity_checksBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple sub_entity_checkss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} sub_entity_checkss")
    
    service = Sub_entity_checksService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} sub_entity_checkss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Sub_entity_checksResponse])
async def update_sub_entity_checkss_batch(
    request: Sub_entity_checksBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple sub_entity_checkss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} sub_entity_checkss")
    
    service = Sub_entity_checksService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} sub_entity_checkss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Sub_entity_checksResponse)
async def update_sub_entity_checks(
    id: int,
    data: Sub_entity_checksUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing sub_entity_checks"""
    logger.debug(f"Updating sub_entity_checks {id} with data: {data}")

    service = Sub_entity_checksService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Sub_entity_checks with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Sub_entity_checks not found")
        
        logger.info(f"Sub_entity_checks {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating sub_entity_checks {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating sub_entity_checks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_sub_entity_checkss_batch(
    request: Sub_entity_checksBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple sub_entity_checkss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} sub_entity_checkss")
    
    service = Sub_entity_checksService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} sub_entity_checkss successfully")
        return {"message": f"Successfully deleted {deleted_count} sub_entity_checkss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_sub_entity_checks(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single sub_entity_checks by ID"""
    logger.debug(f"Deleting sub_entity_checks with id: {id}")
    
    service = Sub_entity_checksService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Sub_entity_checks with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Sub_entity_checks not found")
        
        logger.info(f"Sub_entity_checks {id} deleted successfully")
        return {"message": "Sub_entity_checks deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting sub_entity_checks {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")