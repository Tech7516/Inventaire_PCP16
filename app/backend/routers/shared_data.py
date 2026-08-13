"""
Shared data API — bypasses RLS entirely by using direct SQLAlchemy queries.
All inventory logs, discrepancy reports, and preferences are shared across devices.
"""
import json
import logging
from typing import List, Optional

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.inventory_logs import Inventory_logs
from models.discrepancy_reports import Discrepancy_reports
from models.app_preferences import App_preferences
from models.lot_configs import Lot_configs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/shared", tags=["shared_data"])


# ---------- Pydantic Schemas ----------

class InventoryLogResponse(BaseModel):
    id: int
    lot_id: str
    lot_name: str
    sub_entity_name: str
    variant_name: Optional[str] = None
    lot_variant_name: Optional[str] = None
    sac_type: Optional[str] = None
    dps_name: str
    intervention_type: Optional[str] = None
    completed_key: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AddLogEntryRequest(BaseModel):
    lot_id: str
    lot_name: str
    sub_entity_name: str
    variant_name: Optional[str] = None
    lot_variant_name: Optional[str] = None
    sac_type: Optional[str] = None
    dps_name: str
    intervention_type: Optional[str] = None
    completed_key: str


class DiscrepancyReportResponse(BaseModel):
    id: int
    lot_id: str
    variant_id: Optional[str] = None
    report_key: str
    lot_name: str
    variant_name: Optional[str] = None
    dps_name: Optional[str] = None
    discrepancies_json: Optional[str] = None
    full_inventory_json: Optional[str] = None
    has_discrepancies: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SaveDiscrepancyReportRequest(BaseModel):
    lot_id: str
    variant_id: Optional[str] = None
    report_key: str
    lot_name: str
    variant_name: Optional[str] = None
    dps_name: str
    discrepancies_json: Optional[str] = None
    full_inventory_json: Optional[str] = None
    has_discrepancies: Optional[bool] = None


class PreferenceResponse(BaseModel):
    id: int
    pref_key: str
    pref_value: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SetPreferenceRequest(BaseModel):
    pref_key: str
    pref_value: str


# ---------- Inventory Logs ----------

@router.get("/logs", response_model=List[InventoryLogResponse])
async def get_all_logs(
    lot_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all inventory logs (shared across all users/devices)"""
    try:
        stmt = select(Inventory_logs).order_by(Inventory_logs.created_at.desc())
        if lot_id:
            stmt = stmt.where(Inventory_logs.lot_id == lot_id)
        result = await db.execute(stmt.limit(500))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching shared logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logs", response_model=InventoryLogResponse)
async def add_log_entry(data: AddLogEntryRequest, db: AsyncSession = Depends(get_db)):
    """Add or update an inventory log entry (idempotent by completed_key)"""
    try:
        existing = await db.execute(
            select(Inventory_logs).where(Inventory_logs.completed_key == data.completed_key).limit(1)
        )
        existing_entry = existing.scalar_one_or_none()

        if existing_entry:
            existing_entry.lot_name = data.lot_name
            existing_entry.sub_entity_name = data.sub_entity_name
            existing_entry.variant_name = data.variant_name
            existing_entry.lot_variant_name = data.lot_variant_name
            existing_entry.sac_type = data.sac_type
            existing_entry.dps_name = data.dps_name
            existing_entry.intervention_type = data.intervention_type
            await db.commit()
            await db.refresh(existing_entry)
            return existing_entry

        entry = Inventory_logs(
            lot_id=data.lot_id,
            lot_name=data.lot_name,
            sub_entity_name=data.sub_entity_name,
            variant_name=data.variant_name,
            lot_variant_name=data.lot_variant_name,
            sac_type=data.sac_type,
            dps_name=data.dps_name,
            intervention_type=data.intervention_type,
            completed_key=data.completed_key,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        return entry
    except Exception as e:
        await db.rollback()
        logger.error(f"Error adding log entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/logs")
async def clear_all_logs(db: AsyncSession = Depends(get_db)):
    """Delete all inventory logs"""
    try:
        result = await db.execute(select(Inventory_logs).limit(500))
        items = result.scalars().all()
        for item in items:
            await db.delete(item)
        await db.commit()
        return {"deleted": len(items)}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error clearing logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Discrepancy Reports ----------

@router.get("/reports", response_model=List[DiscrepancyReportResponse])
async def get_all_reports(db: AsyncSession = Depends(get_db)):
    """Get all discrepancy reports (shared across all users/devices)"""
    try:
        result = await db.execute(
            select(Discrepancy_reports).order_by(Discrepancy_reports.updated_at.desc()).limit(500)
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching shared reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/{report_key}", response_model=Optional[DiscrepancyReportResponse])
async def get_report_by_key(report_key: str, db: AsyncSession = Depends(get_db)):
    """Get a single discrepancy report by report_key"""
    try:
        result = await db.execute(
            select(Discrepancy_reports).where(Discrepancy_reports.report_key == report_key).limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"Error fetching report by key: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports", response_model=DiscrepancyReportResponse)
async def save_report(data: SaveDiscrepancyReportRequest, db: AsyncSession = Depends(get_db)):
    """Save or update a discrepancy report (upsert by report_key)"""
    try:
        existing = await db.execute(
            select(Discrepancy_reports).where(Discrepancy_reports.report_key == data.report_key).limit(1)
        )
        existing_report = existing.scalar_one_or_none()

        if existing_report:
            existing_report.lot_id = data.lot_id
            existing_report.variant_id = data.variant_id
            existing_report.lot_name = data.lot_name
            existing_report.variant_name = data.variant_name
            existing_report.dps_name = data.dps_name
            existing_report.discrepancies_json = data.discrepancies_json
            existing_report.full_inventory_json = data.full_inventory_json
            existing_report.has_discrepancies = data.has_discrepancies
            await db.commit()
            await db.refresh(existing_report)
            return existing_report

        report = Discrepancy_reports(
            lot_id=data.lot_id,
            variant_id=data.variant_id,
            report_key=data.report_key,
            lot_name=data.lot_name,
            variant_name=data.variant_name,
            dps_name=data.dps_name,
            discrepancies_json=data.discrepancies_json,
            full_inventory_json=data.full_inventory_json,
            has_discrepancies=data.has_discrepancies,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        return report
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reports")
async def clear_all_reports(db: AsyncSession = Depends(get_db)):
    """Delete all discrepancy reports"""
    try:
        result = await db.execute(select(Discrepancy_reports).limit(500))
        items = result.scalars().all()
        for item in items:
            await db.delete(item)
        await db.commit()
        return {"deleted": len(items)}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error clearing reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Preferences ----------

@router.get("/preferences", response_model=List[PreferenceResponse])
async def get_all_preferences(db: AsyncSession = Depends(get_db)):
    """Get all preferences (shared across all users/devices)"""
    try:
        result = await db.execute(select(App_preferences).limit(500))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching shared preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preferences/{pref_key}")
async def get_preference(pref_key: str, db: AsyncSession = Depends(get_db)):
    """Get a single preference by key"""
    try:
        result = await db.execute(
            select(App_preferences).where(App_preferences.pref_key == pref_key).limit(1)
        )
        item = result.scalar_one_or_none()
        if not item:
            return {"pref_key": pref_key, "pref_value": None}
        return {"pref_key": item.pref_key, "pref_value": item.pref_value}
    except Exception as e:
        logger.error(f"Error fetching preference: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preferences", response_model=PreferenceResponse)
async def set_preference(data: SetPreferenceRequest, db: AsyncSession = Depends(get_db)):
    """Set a preference (upsert by pref_key)"""
    try:
        existing = await db.execute(
            select(App_preferences).where(App_preferences.pref_key == data.pref_key).limit(1)
        )
        existing_pref = existing.scalar_one_or_none()

        if existing_pref:
            existing_pref.pref_value = data.pref_value
            await db.commit()
            await db.refresh(existing_pref)
            return existing_pref

        pref = App_preferences(
            pref_key=data.pref_key,
            pref_value=data.pref_value,
        )
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
        return pref
    except Exception as e:
        await db.rollback()
        logger.error(f"Error setting preference: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Lot Configs ----------

class LotConfigResponse(BaseModel):
    id: int
    lot_id: str
    config_json: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SaveLotConfigRequest(BaseModel):
    lot_id: str
    config_json: str


@router.get("/lot-configs", response_model=List[LotConfigResponse])
async def get_all_lot_configs(db: AsyncSession = Depends(get_db)):
    """Get all lot configs (shared across all users/devices)"""
    try:
        result = await db.execute(select(Lot_configs).limit(500))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching shared lot configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lot-configs/{lot_id}", response_model=Optional[LotConfigResponse])
async def get_lot_config(lot_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single lot config by lot_id"""
    try:
        result = await db.execute(
            select(Lot_configs).where(Lot_configs.lot_id == lot_id).limit(1)
        )
        return result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"Error fetching lot config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lot-configs", response_model=LotConfigResponse)
async def save_lot_config(data: SaveLotConfigRequest, db: AsyncSession = Depends(get_db)):
    """Save or update a lot config (upsert by lot_id)"""
    try:
        existing = await db.execute(
            select(Lot_configs).where(Lot_configs.lot_id == data.lot_id).limit(1)
        )
        existing_config = existing.scalar_one_or_none()

        if existing_config:
            existing_config.config_json = data.config_json
            await db.commit()
            await db.refresh(existing_config)
            return existing_config

        config = Lot_configs(
            lot_id=data.lot_id,
            config_json=data.config_json,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return config
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving lot config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/lot-configs/{lot_id}")
async def delete_lot_config(lot_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a lot config by lot_id"""
    try:
        result = await db.execute(
            select(Lot_configs).where(Lot_configs.lot_id == lot_id).limit(1)
        )
        config = result.scalar_one_or_none()
        if config:
            await db.delete(config)
            await db.commit()
        return {"deleted": 1 if config else 0}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting lot config: {e}")
        raise HTTPException(status_code=500, detail=str(e))