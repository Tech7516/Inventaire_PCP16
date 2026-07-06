import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.discrepancy_reports import Discrepancy_reportsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/discrepancy_reports", tags=["discrepancy_reports"])


# ---------- Pydantic Schemas ----------
class Discrepancy_reportsData(BaseModel):
    """Entity data schema (for create/update)"""
    lot_id: str
    variant_id: str = None
    report_key: str
    lot_name: str
    variant_name: str = None
    dps_name: str
    discrepancies_json: str = None
    full_inventory_json: str = None
    has_discrepancies: bool = None


class Discrepancy_reportsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    lot_id: Optional[str] = None
    variant_id: Optional[str] = None
    report_key: Optional[str] = None
    lot_name: Optional[str] = None
    variant_name: Optional[str] = None
    dps_name: Optional[str] = None
    discrepancies_json: Optional[str] = None
    full_inventory_json: Optional[str] = None
    has_discrepancies: Optional[bool] = None


class Discrepancy_reportsResponse(BaseModel):
    """Entity response schema"""
    id: int
    lot_id: str
    variant_id: Optional[str] = None
    report_key: str
    lot_name: str
    variant_name: Optional[str] = None
    dps_name: str
    discrepancies_json: Optional[str] = None
    full_inventory_json: Optional[str] = None
    has_discrepancies: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Discrepancy_reportsListResponse(BaseModel):
    """List response schema"""
    items: List[Discrepancy_reportsResponse]
    total: int
    skip: int
    limit: int


class Discrepancy_reportsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Discrepancy_reportsData]


class Discrepancy_reportsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Discrepancy_reportsUpdateData


class Discrepancy_reportsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Discrepancy_reportsBatchUpdateItem]


class Discrepancy_reportsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Discrepancy_reportsListResponse)
async def query_discrepancy_reportss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query discrepancy_reportss with filtering, sorting, and pagination"""
    logger.debug(f"Querying discrepancy_reportss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Discrepancy_reportsService(db)
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
        logger.debug(f"Found {result['total']} discrepancy_reportss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying discrepancy_reportss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Discrepancy_reportsListResponse)
async def query_discrepancy_reportss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query discrepancy_reportss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying discrepancy_reportss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Discrepancy_reportsService(db)
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
        logger.debug(f"Found {result['total']} discrepancy_reportss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying discrepancy_reportss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Discrepancy_reportsResponse)
async def get_discrepancy_reports(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single discrepancy_reports by ID"""
    logger.debug(f"Fetching discrepancy_reports with id: {id}, fields={fields}")
    
    service = Discrepancy_reportsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Discrepancy_reports with id {id} not found")
            raise HTTPException(status_code=404, detail="Discrepancy_reports not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching discrepancy_reports {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Discrepancy_reportsResponse, status_code=201)
async def create_discrepancy_reports(
    data: Discrepancy_reportsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new discrepancy_reports"""
    logger.debug(f"Creating new discrepancy_reports with data: {data}")
    
    service = Discrepancy_reportsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create discrepancy_reports")
        
        logger.info(f"Discrepancy_reports created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating discrepancy_reports: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating discrepancy_reports: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Discrepancy_reportsResponse], status_code=201)
async def create_discrepancy_reportss_batch(
    request: Discrepancy_reportsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple discrepancy_reportss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} discrepancy_reportss")
    
    service = Discrepancy_reportsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} discrepancy_reportss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Discrepancy_reportsResponse])
async def update_discrepancy_reportss_batch(
    request: Discrepancy_reportsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple discrepancy_reportss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} discrepancy_reportss")
    
    service = Discrepancy_reportsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} discrepancy_reportss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Discrepancy_reportsResponse)
async def update_discrepancy_reports(
    id: int,
    data: Discrepancy_reportsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing discrepancy_reports"""
    logger.debug(f"Updating discrepancy_reports {id} with data: {data}")

    service = Discrepancy_reportsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Discrepancy_reports with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Discrepancy_reports not found")
        
        logger.info(f"Discrepancy_reports {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating discrepancy_reports {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating discrepancy_reports {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_discrepancy_reportss_batch(
    request: Discrepancy_reportsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple discrepancy_reportss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} discrepancy_reportss")
    
    service = Discrepancy_reportsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} discrepancy_reportss successfully")
        return {"message": f"Successfully deleted {deleted_count} discrepancy_reportss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_discrepancy_reports(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single discrepancy_reports by ID"""
    logger.debug(f"Deleting discrepancy_reports with id: {id}")
    
    service = Discrepancy_reportsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Discrepancy_reports with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Discrepancy_reports not found")
        
        logger.info(f"Discrepancy_reports {id} deleted successfully")
        return {"message": "Discrepancy_reports deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting discrepancy_reports {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")