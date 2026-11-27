from db.database import Base, SessionLocal, engine
from db.models import Customer, Subscription, Order, Invoice, Ticket, KBArticle
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from typing import Optional
import pathlib
import sys


def _load_master_kb_documents() -> list[dict]:
    try:
        from ingest_kb import documents
        return list(documents)
    except ImportError:
        backend_dir = pathlib.Path(__file__).resolve().parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        try:
            from ingest_kb import documents
            return list(documents)
        except Exception:
            return []


def ensure_kb_seeded(db: Optional[Session] = None) -> None:
    """Ensure the 30 master KB chunks exist in the persistent kb_articles table."""
    Base.metadata.create_all(bind=engine)
    own_session = db is None
    session = SessionLocal() if own_session else db
    try:
        if session.query(KBArticle).count() == 0:
            master_docs = _load_master_kb_documents()
            if master_docs:
                session.add_all([
                    KBArticle(
                        id=int(doc["id"]) if doc.get("id") is not None else None,
                        title=doc.get("title", ""),
                        category=doc.get("category", "General"),
                        text=doc.get("text", ""),
                        source=doc.get("source", "master-kb"),
                        synced_to_qdrant=False,
                    )
                    for doc in master_docs
                ])
                session.commit()
    finally:
        if own_session:
            session.close()


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Customers
        c1 = db.query(Customer).filter(Customer.email == "john@example.com").first()
        if not c1:
            c1 = Customer(email="john@example.com", name="John Doe", tier="standard", company="General")
            db.add(c1)

        c2 = db.query(Customer).filter(Customer.email == "enterprise@bigcorp.com").first()
        if not c2:
            c2 = Customer(email="enterprise@bigcorp.com", name="Big Corp", tier="enterprise", company="Big Corp Global")
            db.add(c2)

        c3 = db.query(Customer).filter(Customer.email == "angry@customer.com").first()
        if not c3:
            c3 = Customer(email="angry@customer.com", name="Angry Customer", tier="standard", company="Retail")
            db.add(c3)

        db.commit()
        db.refresh(c1)
        db.refresh(c2)
        db.refresh(c3)

        # 2. Subscriptions
        if db.query(Subscription).count() == 0:
            db.add_all([
                Subscription(customer_id=c1.id, plan_name="Standard Plan", status="active", monthly_rate=29.99),
                Subscription(customer_id=c2.id, plan_name="Enterprise Plan", status="active", monthly_rate=999.00),
                Subscription(customer_id=c3.id, plan_name="Standard Plan", status="past_due", monthly_rate=29.99),
            ])
            db.commit()

        # 3. Orders
        now = datetime.now(timezone.utc)
        if db.query(Order).count() == 0:
            db.add_all([
                Order(id="ORD-1001", customer_id=c1.id, status="shipped", total_amount=150.00, created_at=now - timedelta(days=2)),
                Order(id="ORD-1002", customer_id=c1.id, status="processing", total_amount=45.00, created_at=now),
                Order(id="ORD-1003", customer_id=c2.id, status="delayed", total_amount=5000.00, created_at=now - timedelta(days=5)),
            ])
            db.commit()

        # 4. Invoices
        if db.query(Invoice).count() == 0:
            db.add_all([
                Invoice(id="INV-9901", customer_id=c1.id, amount=29.99, status="paid", due_date=now - timedelta(days=10)),
                Invoice(id="INV-9902", customer_id=c3.id, amount=29.99, status="overdue", due_date=now - timedelta(days=5)),
            ])
            db.commit()

        # 5. Master Knowledge Base Articles
        ensure_kb_seeded(db)
    finally:
        db.close()
    return True


if __name__ == "__main__":
    if seed_database():
        print("Database seeded.")
    else:
        print("Database already seeded.")

