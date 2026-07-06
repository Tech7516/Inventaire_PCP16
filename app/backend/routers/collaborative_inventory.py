import json
import logging
from typing import List, Optional

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.inventory_sessions import Inventory_sessions
from models.sub_entity_checks import Sub_entity_checks
from models.inventory_items import Inventory_items

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/inventory", tags=["collaborative_inventory"])


# ---------- Pydantic Schemas ----------

class CreateSessionRequest(BaseModel):
    lot_id: str
    variant_id: Optional[str] = None
    dps_name: str

class SessionResponse(BaseModel):
    id: int
    lot_id: str
    variant_id: Optional[str] = None
    dps_name: str
    status: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SubEntityCheckResponse(BaseModel):
    id: int
    session_id: int
    sub_entity_id: str
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    checker_name: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MarkSubEntityRequest(BaseModel):
    session_id: int
    sub_entity_id: str
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    checker_name: str

class InventoryItemData(BaseModel):
    item_id: str
    validated: bool = True
    custom_quantity: Optional[str] = None

class SaveInventoryItemsRequest(BaseModel):
    session_id: int
    sub_entity_id: str
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    checker_name: Optional[str] = None
    items: List[InventoryItemData]

class InventoryItemResponse(BaseModel):
    id: int
    session_id: int
    sub_entity_id: str
    variant_id: Optional[str] = None
    sac_type: Optional[str] = None
    item_id: str
    validated: Optional[bool] = None
    custom_quantity: Optional[str] = None
    checker_name: Optional[str] = None

    class Config:
        from_attributes = True

class CompleteSessionRequest(BaseModel):
    session_id: int


# ---------- Routes ----------

@router.get("/active-session/{lot_id}", response_model=Optional[SessionResponse])
async def get_active_session(lot_id: str, db: AsyncSession = Depends(get_db)):
    """Get the active session for a given lot (if any)"""
    try:
        result = await db.execute(
            select(Inventory_sessions)
            .where(
                and_(
                    Inventory_sessions.lot_id == lot_id,
                    Inventory_sessions.status == "active"
                )
            )
            .order_by(Inventory_sessions.created_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        if not session:
            return None
        return session
    except Exception as e:
        logger.error(f"Error fetching active session for lot {lot_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active-sessions", response_model=List[SessionResponse])
async def get_all_active_sessions(db: AsyncSession = Depends(get_db)):
    """Get all active sessions (single call instead of N per-lot calls)"""
    try:
        result = await db.execute(
            select(Inventory_sessions)
            .where(Inventory_sessions.status == "active")
        )
        sessions = result.scalars().all()
        return sessions
    except Exception as e:
        logger.error(f"Error fetching all active sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-session", response_model=SessionResponse)
async def create_session(data: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    """Create a new inventory session for a lot"""
    try:
        # Check if there's already an active session for this lot
        existing = await db.execute(
            select(Inventory_sessions)
            .where(
                and_(
                    Inventory_sessions.lot_id == data.lot_id,
                    Inventory_sessions.status == "active"
                )
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="An active session already exists for this lot")

        session = Inventory_sessions(
            lot_id=data.lot_id,
            variant_id=data.variant_id,
            dps_name=data.dps_name,
            status="active",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/abandon-session/{session_id}")
async def abandon_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Abandon an active inventory session"""
    try:
        result = await db.execute(
            select(Inventory_sessions).where(Inventory_sessions.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Session is not active")

        session.status = "abandoned"
        await db.commit()
        return {"message": "Session abandoned", "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error abandoning session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete-session", response_model=SessionResponse)
async def complete_session(data: CompleteSessionRequest, db: AsyncSession = Depends(get_db)):
    """Mark a session as completed"""
    try:
        result = await db.execute(
            select(Inventory_sessions).where(Inventory_sessions.id == data.session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.status != "active":
            raise HTTPException(status_code=400, detail="Session is not active")

        session.status = "completed"
        session.completed_at = datetime.utcnow().isoformat()
        await db.commit()
        await db.refresh(session)
        return session
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error completing session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sub-entity-checks/{session_id}", response_model=List[SubEntityCheckResponse])
async def get_sub_entity_checks(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get all sub-entity checks for a session"""
    try:
        result = await db.execute(
            select(Sub_entity_checks)
            .where(Sub_entity_checks.session_id == session_id)
        )
        checks = result.scalars().all()
        return checks
    except Exception as e:
        logger.error(f"Error fetching sub-entity checks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-sub-entity", response_model=SubEntityCheckResponse)
async def mark_sub_entity(data: MarkSubEntityRequest, db: AsyncSession = Depends(get_db)):
    """Mark a sub-entity as checked by a rescuer"""
    try:
        # Check for existing check (idempotent)
        conditions = [
            Sub_entity_checks.session_id == data.session_id,
            Sub_entity_checks.sub_entity_id == data.sub_entity_id,
        ]
        if data.variant_id:
            conditions.append(Sub_entity_checks.variant_id == data.variant_id)
        if data.sac_type:
            conditions.append(Sub_entity_checks.sac_type == data.sac_type)

        existing = await db.execute(
            select(Sub_entity_checks).where(and_(*conditions))
        )
        existing_check = existing.scalar_one_or_none()
        if existing_check:
            # Update checker name
            existing_check.checker_name = data.checker_name
            await db.commit()
            await db.refresh(existing_check)
            return existing_check

        check = Sub_entity_checks(
            session_id=data.session_id,
            sub_entity_id=data.sub_entity_id,
            variant_id=data.variant_id,
            sac_type=data.sac_type,
            checker_name=data.checker_name,
        )
        db.add(check)
        await db.commit()
        await db.refresh(check)
        return check
    except Exception as e:
        await db.rollback()
        logger.error(f"Error marking sub-entity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-items", response_model=List[InventoryItemResponse])
async def save_inventory_items(data: SaveInventoryItemsRequest, db: AsyncSession = Depends(get_db)):
    """Save inventory items for a sub-entity check"""
    try:
        results = []
        for item_data in data.items:
            # Check if item already exists for this session/sub/variant/sac
            conditions = [
                Inventory_items.session_id == data.session_id,
                Inventory_items.sub_entity_id == data.sub_entity_id,
                Inventory_items.item_id == item_data.item_id,
            ]
            if data.variant_id:
                conditions.append(Inventory_items.variant_id == data.variant_id)
            if data.sac_type:
                conditions.append(Inventory_items.sac_type == data.sac_type)

            existing = await db.execute(
                select(Inventory_items).where(and_(*conditions))
            )
            existing_item = existing.scalar_one_or_none()

            if existing_item:
                # Update existing
                existing_item.validated = item_data.validated
                existing_item.custom_quantity = item_data.custom_quantity
                if data.checker_name:
                    existing_item.checker_name = data.checker_name
                await db.commit()
                await db.refresh(existing_item)
                results.append(existing_item)
            else:
                # Create new
                item = Inventory_items(
                    session_id=data.session_id,
                    sub_entity_id=data.sub_entity_id,
                    variant_id=data.variant_id,
                    sac_type=data.sac_type,
                    item_id=item_data.item_id,
                    validated=item_data.validated,
                    custom_quantity=item_data.custom_quantity,
                    checker_name=data.checker_name,
                )
                db.add(item)
                await db.commit()
                await db.refresh(item)
                results.append(item)

        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving inventory items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/items/{session_id}", response_model=List[InventoryItemResponse])
async def get_inventory_items(
    session_id: int,
    sub_entity_id: Optional[str] = None,
    variant_id: Optional[str] = None,
    sac_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get inventory items for a session, optionally filtered by sub-entity/variant/sac_type"""
    try:
        conditions = [Inventory_items.session_id == session_id]
        if sub_entity_id:
            conditions.append(Inventory_items.sub_entity_id == sub_entity_id)
        if variant_id:
            conditions.append(Inventory_items.variant_id == variant_id)
        if sac_type:
            conditions.append(Inventory_items.sac_type == sac_type)

        result = await db.execute(
            select(Inventory_items).where(and_(*conditions))
        )
        items = result.scalars().all()
        return items
    except Exception as e:
        logger.error(f"Error fetching inventory items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get a session by ID"""
    try:
        result = await db.execute(
            select(Inventory_sessions).where(Inventory_sessions.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching session: {e}")
        raise HTTPException(status_code=500, detail=str(e))