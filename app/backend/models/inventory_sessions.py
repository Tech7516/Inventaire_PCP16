from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Inventory_sessions(Base):
    __tablename__ = "inventory_sessions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    lot_id = Column(String, nullable=False)
    variant_id = Column(String, nullable=True)
    dps_name = Column(String, nullable=False)
    status = Column(String, nullable=True, default='active', server_default='active')
    completed_at = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)