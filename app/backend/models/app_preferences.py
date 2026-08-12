from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class App_preferences(Base):
    __tablename__ = "app_preferences"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    pref_key = Column(String, nullable=False)
    pref_value = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)