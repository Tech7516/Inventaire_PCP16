from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Discrepancy_reports(Base):
    __tablename__ = "discrepancy_reports"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    lot_id = Column(String, nullable=False)
    variant_id = Column(String, nullable=True)
    report_key = Column(String, nullable=False)
    lot_name = Column(String, nullable=False)
    variant_name = Column(String, nullable=True)
    dps_name = Column(String, nullable=False)
    discrepancies_json = Column(String, nullable=True)
    full_inventory_json = Column(String, nullable=True)
    has_discrepancies = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)