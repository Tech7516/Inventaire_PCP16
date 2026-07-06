from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Inventory_items(Base):
    __tablename__ = "inventory_items"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_id = Column(Integer, nullable=False)
    sub_entity_id = Column(String, nullable=False)
    variant_id = Column(String, nullable=True)
    sac_type = Column(String, nullable=True)
    item_id = Column(String, nullable=False)
    validated = Column(Boolean, nullable=True, default=True, server_default='true')
    custom_quantity = Column(String, nullable=True)
    checker_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)