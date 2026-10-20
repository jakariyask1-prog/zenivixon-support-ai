import sqlite3
import pathlib

db_path = pathlib.Path(__file__).resolve().parent.parent / "logiflow_support.db"
print(f"Checking database at: {db_path}")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cur.fetchall()]
print(f"Existing tables: {tables}")

# Check customers columns
if "customers" in tables:
    cur.execute("PRAGMA table_info(customers);")
    cols = [r[1] for r in cur.fetchall()]
    print(f"Customer columns: {cols}")
    if "is_active" not in cols:
        print("Adding 'is_active' column to customers table...")
        cur.execute("ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT 1;")
        conn.commit()
        print("[OK] Added 'is_active' column successfully.")

# Check tickets columns
if "tickets" in tables:
    cur.execute("PRAGMA table_info(tickets);")
    t_cols = [r[1] for r in cur.fetchall()]
    print(f"Ticket columns: {t_cols}")
    expected_cols = {
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
        "resolved_at": "TIMESTAMP"
    }
    for col, col_type in expected_cols.items():
        if col not in t_cols:
            print(f"Adding '{col}' column to tickets table...")
            cur.execute(f"ALTER TABLE tickets ADD COLUMN {col} {col_type};")
            conn.commit()
            print(f"[OK] Added '{col}' column successfully.")

conn.close()
print("Migration completed successfully.")
