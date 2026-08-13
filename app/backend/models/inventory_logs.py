from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Inventory_logs(Base):
    __tablename__ = "inventory_logs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    lot_id = Column(String, index=True, nullable=False)
    lot_name = Column(String, nullable=False)
    sub_entity_name = Column(String, nullable=False)
    variant_name = Column(String, nullable=True)
    lot_variant_name = Column(String, nullable=True)
    sac_type = Column(String, nullable=True)
    dps_name = Column(String, nullable=False)
    intervention_type = Column(String, nullable=True)
    completed_key = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)