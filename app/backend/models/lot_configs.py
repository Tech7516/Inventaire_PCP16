from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Lot_configs(Base):
    __tablename__ = "lot_configs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    lot_id = Column(String, index=True, nullable=False)
    lot_name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    config_json = Column(String, nullable=False)
    is_custom = Column(Boolean, nullable=True, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)