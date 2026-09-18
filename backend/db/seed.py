from db.database import Base, SessionLocal, engine
from db.models import Customer, Subscription, Order, Invoice, Ticket
from datetime import datetime, timedelta, timezone

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    if db.query(Customer).count() > 0:
        db.close()
        return False
        
    # Customers
    c1 = Customer(email="john@example.com", name="John Doe", tier="standard")
    c2 = Customer(email="enterprise@bigcorp.com", name="Big Corp", tier="enterprise")
    c3 = Customer(email="angry@customer.com", name="Angry Customer", tier="standard")
    
    db.add_all([c1, c2, c3])
    db.commit()

    # Subscriptions
    db.add_all([
        Subscription(customer_id=c1.id, plan_name="Standard Plan", status="active", monthly_rate=29.99),
        Subscription(customer_id=c2.id, plan_name="Enterprise Plan", status="active", monthly_rate=999.00),
        Subscription(customer_id=c3.id, plan_name="Standard Plan", status="past_due", monthly_rate=29.99),
    ])
    
    # Orders
    now = datetime.now(timezone.utc)
    db.add_all([
        Order(id="ORD-1001", customer_id=c1.id, status="shipped", total_amount=150.00, created_at=now - timedelta(days=2)),
        Order(id="ORD-1002", customer_id=c1.id, status="processing", total_amount=45.00, created_at=now),
        Order(id="ORD-1003", customer_id=c2.id, status="delayed", total_amount=5000.00, created_at=now - timedelta(days=5)),
    ])
    
    # Invoices
    db.add_all([
        Invoice(id="INV-9901", customer_id=c1.id, amount=29.99, status="paid", due_date=now - timedelta(days=10)),
        Invoice(id="INV-9902", customer_id=c3.id, amount=29.99, status="overdue", due_date=now - timedelta(days=5)),
    ])
    
    db.commit()
    db.close()
    return True

if __name__ == "__main__":
    if seed_database():
        print("Database seeded.")
    else:
        print("Database already seeded.")
