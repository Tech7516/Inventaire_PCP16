from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Lot_configs(Base):
    __tablename__ = "lot_configs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    lot_id = Column(String, index=True, nullable=False)
    config_json = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)