import os
import pathlib
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

env_file = pathlib.Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://zenivixon:password@localhost:5432/zenivixon_db")

# Automatically map postgresql:// to postgresql+psycopg2:// if psycopg2 is installed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(
            DATABASE_URL, 
            connect_args={"connect_timeout": 3},
            pool_pre_ping=True
        )
        # Test connection
        with engine.connect() as conn:
            pass
except Exception as e:
    # Fallback to local SQLite for offline/Docker-less development
    import pathlib
    project_root = pathlib.Path(__file__).resolve().parent.parent.parent
    fallback_db = project_root / "logiflow_support.db"
    fallback_url = f"sqlite:///{fallback_db.as_posix()}"
    print(f"[Database] Could not connect to primary DB ({e}). Falling back to SQLite: {fallback_url}")
    engine = create_engine(fallback_url, connect_args={"check_same_thread": False})

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in str(engine.url):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
