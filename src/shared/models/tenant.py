from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Tenant(Base):
    __tablename__ = 'tenants'

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    api_key = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
