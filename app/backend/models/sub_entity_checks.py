from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Sub_entity_checks(Base):
    __tablename__ = "sub_entity_checks"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    session_id = Column(Integer, index=True, nullable=False)
    sub_entity_id = Column(String, index=True, nullable=False)
    variant_id = Column(String, index=True, nullable=True)
    sac_type = Column(String, nullable=True)
    checker_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)