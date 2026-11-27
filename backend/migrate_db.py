import pathlib
import sys
from sqlalchemy import inspect, text

backend_dir = pathlib.Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from db.database import Base, engine
from db import models  # noqa: F401 - ensure all models register on Base.metadata


def run_migration() -> None:
    print(f"Checking database dialect: {engine.dialect.name} ({engine.url.render_as_string(hide_password=True)})")

    # Create any newly introduced tables (such as kb_articles)
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    print(f"Existing tables: {sorted(tables)}")

    is_postgres = engine.dialect.name == "postgresql"
    bool_default = "TRUE" if is_postgres else "1"
    ts_type = "TIMESTAMPTZ" if is_postgres else "TIMESTAMP"

    with engine.begin() as conn:
        if "customers" in tables:
            cols = {c["name"] for c in inspector.get_columns("customers")}
            if "is_active" not in cols:
                print("Adding 'is_active' column to customers table...")
                conn.execute(text(f"ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT {bool_default}"))
                print("[OK] Added 'is_active' column successfully.")

        if "tickets" in tables:
            t_cols = {c["name"] for c in inspector.get_columns("tickets")}
            expected_cols = {
                "customer_email": "TEXT",
                "raw_message": "TEXT",
                "category": "TEXT",
                "intent": "TEXT",
                "priority": "TEXT",
                "sentiment": "TEXT",
                "resolution_status": "TEXT DEFAULT 'open'",
                "draft_response": "TEXT",
                "ai_findings": "TEXT",
                "tools_executed": "TEXT",
                "escalation_reason": "TEXT",
                "recommended_action": "TEXT",
                "churn_risk_score": "INTEGER DEFAULT 20",
                "processing_time_ms": "INTEGER",
                "resolved_at": ts_type,
            }
            for col, col_type in expected_cols.items():
                if col not in t_cols:
                    print(f"Adding '{col}' column to tickets table...")
                    conn.execute(text(f"ALTER TABLE tickets ADD COLUMN {col} {col_type}"))
                    print(f"[OK] Added '{col}' column successfully.")

    print("Migration completed successfully.")


if __name__ == "__main__":
    run_migration()

