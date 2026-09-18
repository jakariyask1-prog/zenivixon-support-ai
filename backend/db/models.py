from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from db.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    tier = Column(String, default="standard") # standard, enterprise, pro
    is_active = Column(Boolean, default=True)

    tickets = relationship("Ticket", back_populates="customer")
    orders = relationship("Order", back_populates="customer")
    subscription = relationship("Subscription", back_populates="customer", uselist=False)
    invoices = relationship("Invoice", back_populates="customer")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    plan_name = Column(String)
    status = Column(String) # active, past_due, canceled
    monthly_rate = Column(Float)

    customer = relationship("Customer", back_populates="subscription")


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True) # e.g. ORD-1234
    customer_id = Column(Integer, ForeignKey("customers.id"))
    status = Column(String) # processing, shipped, delivered, delayed
    total_amount = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer", back_populates="orders")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, index=True) # e.g. INV-1001
    customer_id = Column(Integer, ForeignKey("customers.id"))
    amount = Column(Float)
    status = Column(String) # paid, unpaid, overdue
    due_date = Column(DateTime)

    customer = relationship("Customer", back_populates="invoices")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    
    # User Input
    raw_message = Column(Text, nullable=False)
    
    # Intake & Analysis
    category = Column(String, nullable=True)
    intent = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    sentiment = Column(String, nullable=True)
    
    # Handoff Package & Resolution
    resolution_status = Column(String, default="open") # open, processing, resolved, escalated
    draft_response = Column(Text, nullable=True)
    ai_findings = Column(Text, nullable=True)
    tools_executed = Column(Text, nullable=True) # JSON list of tools
    escalation_reason = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="tickets")
