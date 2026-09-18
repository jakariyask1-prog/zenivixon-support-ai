from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db.models import Customer, Order, Subscription, Invoice

def get_customer(email: str) -> Optional[Dict[str, Any]]:
    """Retrieve customer details by email."""
    db = SessionLocal()
    customer = db.query(Customer).filter(Customer.email == email).first()
    db.close()
    if customer:
        return {"id": customer.id, "name": customer.name, "tier": customer.tier, "is_active": customer.is_active}
    return None

def get_subscription(customer_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve subscription details for a given customer."""
    db = SessionLocal()
    sub = db.query(Subscription).filter(Subscription.customer_id == customer_id).first()
    db.close()
    if sub:
        return {"plan_name": sub.plan_name, "status": sub.status, "monthly_rate": sub.monthly_rate}
    return None

def get_order(order_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve details for a specific order."""
    db = SessionLocal()
    order = db.query(Order).filter(Order.id == order_id).first()
    db.close()
    if order:
        return {"status": order.status, "total_amount": order.total_amount, "created_at": order.created_at.isoformat()}
    return None

def get_invoice(invoice_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve details for a specific invoice."""
    db = SessionLocal()
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    db.close()
    if invoice:
        return {"amount": invoice.amount, "status": invoice.status, "due_date": invoice.due_date.isoformat() if invoice.due_date else None}
    return None

def get_latest_customer_order(customer_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve the most recent order for a customer."""
    db = SessionLocal()
    order = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.created_at.desc()).first()
    db.close()
    if order:
        return {"order_id": order.id, "status": order.status, "total_amount": order.total_amount, "created_at": order.created_at.isoformat()}
    return None

def get_latest_customer_invoice(customer_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve the most recent invoice for a customer."""
    db = SessionLocal()
    invoice = db.query(Invoice).filter(Invoice.customer_id == customer_id).order_by(Invoice.due_date.desc()).first()
    db.close()
    if invoice:
        return {"invoice_id": invoice.id, "amount": invoice.amount, "status": invoice.status, "due_date": invoice.due_date.isoformat() if invoice.due_date else None}
    return None

def check_service_status() -> Dict[str, Any]:
    """Check the operational status of internal services."""
    # Mocking a normal state, but could be modified to simulate outages.
    return {
        "api": "operational",
        "web": "operational",
        "database": "operational"
    }
