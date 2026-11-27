import os
import pathlib
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from google import genai

env_file = pathlib.Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
COLLECTION_NAME = "zenivixon_kb"

# gemini-embedding-001 produces 3072-dimensional vectors
EMBEDDING_MODEL = "models/gemini-embedding-001"
VECTOR_SIZE = 3072

_cached_genai_client = None
_cached_qdrant_client = None

def get_genai_client():
    global _cached_genai_client
    if _cached_genai_client is None:
        _cached_genai_client = genai.Client(api_key=GEMINI_API_KEY)
    return _cached_genai_client

def _get_embedding(text: str) -> list:
    """Get embedding vector using cached google-genai client (supports AQ.* keys)."""
    client = get_genai_client()
    result = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
    return result.embeddings[0].values

def get_qdrant_client():
    global _cached_qdrant_client
    if _cached_qdrant_client is not None:
        return _cached_qdrant_client
    if QDRANT_API_KEY:
        _cached_qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=3.0, check_compatibility=False)
    else:
        _cached_qdrant_client = QdrantClient(url=QDRANT_URL, timeout=3.0, check_compatibility=False)
    return _cached_qdrant_client

def init_qdrant():
    client = get_qdrant_client()
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
    return client

BENGALI_KB_BRIDGE: dict[str, list[str]] = {
    "এআই": ["ai", "agent", "agents", "intelligent"],
    "এজেন্ট": ["agent", "agents", "support", "autonomous"],
    "সার্ভিস": ["service", "services", "solutions", "capabilities"],
    "সেবা": ["service", "services", "solutions", "support"],
    "সমাধান": ["solution", "solutions", "services"],
    "সফটওয়্যার": ["software", "custom", "web", "applications"],
    "সফটওয়্যার": ["software", "custom", "web", "applications"],
    "ওয়েব": ["web", "nextjs", "react", "software"],
    "ওয়েব": ["web", "nextjs", "react", "software"],
    "অটোমেশন": ["automation", "workflow", "workflows", "api"],
    "দাম": ["pricing", "cost", "budget", "scope", "quote"],
    "খরচ": ["pricing", "cost", "budget", "estimate"],
    "প্রাইসিং": ["pricing", "cost", "commercial"],
    "বাজেট": ["budget", "pricing", "mvp"],
    "কোম্পানি": ["company", "zenivixon", "identity", "overview", "mission"],
    "বিস্তারিত": ["overview", "company", "services", "zenivixon"],
    "তথ্য": ["information", "overview", "company", "zenivixon"],
    "সাপোর্ট": ["support", "customer", "triage", "agent"],
    "ইন্টিগ্রেশন": ["integration", "api", "crm", "erp", "webhooks"],
    "কাস্টম": ["custom", "software", "architecture", "solutions"],
    "নিরাপত্তা": ["security", "safety", "governance", "privacy"],
    "সিকিউরিটি": ["security", "safety", "governance", "privacy"],
    "নলেজ": ["knowledge", "rag", "vector"],
    "প্রস্তাব": ["proposal", "handoff", "consultation"],
}


def _extract_search_terms(query: str) -> set[str]:
    """Extract normalized search tokens and bridge Bengali domain terms to English KB concepts."""
    raw_tokens = [
        w.lower().strip("?,.!\"'()[]{}:;।—-")
        for w in query.split()
    ]
    terms: set[str] = set()
    has_bengali = any(0x0980 <= ord(ch) <= 0x09FF for ch in query)

    for tok in raw_tokens:
        if not tok:
            continue
        is_bn_tok = any(0x0980 <= ord(ch) <= 0x09FF for ch in tok)
        if (is_bn_tok and len(tok) >= 2) or (not is_bn_tok and len(tok) > 2):
            terms.add(tok)
        for bn_key, en_targets in BENGALI_KB_BRIDGE.items():
            if bn_key in tok:
                terms.update(en_targets)

    # Ensure general Bengali company/service questions still match core overview if no specific domain keyword hit
    if has_bengali and not any(t.isascii() for t in terms):
        terms.update(["zenivixon", "company", "services"])

    return terms


def _get_local_documents() -> list[dict]:
    """Load all indexed KB documents from persistent database (with safe fallback to master list)."""
    try:
        from db.database import SessionLocal
        from db.models import KBArticle
        from db.seed import ensure_kb_seeded

        ensure_kb_seeded()
        with SessionLocal() as db:
            rows = db.query(KBArticle).order_by(KBArticle.id.asc()).all()
            if rows:
                return [
                    {
                        "id": r.id,
                        "title": r.title,
                        "category": r.category or "General",
                        "text": r.text,
                        "source": r.source or "master-kb",
                        "synced_to_qdrant": bool(r.synced_to_qdrant),
                    }
                    for r in rows
                ]
    except Exception as err:
        print(f"[KB DB Fallback Warning] Falling back to static master KB list: {err}")

    try:
        try:
            from ingest_kb import documents
        except ImportError:
            import sys
            sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
            from ingest_kb import documents
        return list(documents)
    except Exception:
        return []


def _search_local_fallback(query: str, limit: int = 3):
    """Zero-downtime fallback: searches persistent knowledge base when Qdrant Cloud is unreachable."""
    documents = _get_local_documents()
    if not documents:
        return []

    words = _extract_search_terms(query)
    if not words:
        return []

    scored_docs = []
    for doc in documents:
        doc_text_lower = doc.get("text", "").lower()
        title_lower = doc.get("title", "").lower()
        category_lower = doc.get("category", "").lower()

        score = 0.0
        for w in words:
            if w in title_lower:
                score += 3.0
            if w in category_lower:
                score += 2.0
            if w in doc_text_lower:
                score += 1.0

        if score > 0:
            scored_docs.append({
                "text": doc.get("text"),
                "source": f"{doc.get('source', 'local-kb')} (offline fallback)",
                "title": doc.get("title"),
                "score": round(score / (len(words) * 3 or 1), 3)
            })

    scored_docs.sort(key=lambda x: x["score"], reverse=True)
    return scored_docs[:limit]


import socket
import time
from urllib.parse import urlparse

_qdrant_online = None
_last_check_time = 0.0
_CHECK_INTERVAL_SECONDS = 30.0


def is_qdrant_online():
    global _qdrant_online, _last_check_time
    now = time.time()
    if _qdrant_online is not None and (now - _last_check_time) < _CHECK_INTERVAL_SECONDS:
        return _qdrant_online
    _last_check_time = now
    try:
        parsed = urlparse(QDRANT_URL)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 6333)
        sock = socket.create_connection((host, port), timeout=1.5)
        sock.close()
        _qdrant_online = True
        return True
    except Exception as e:
        print(f"[Qdrant Fast Check] Remote Qdrant not reachable ({e}). Switching to local KB fallback.")
        _qdrant_online = False
        return False


def search_kb(query: str, limit: int = 3):
    if not GEMINI_API_KEY or not is_qdrant_online():
        return _search_local_fallback(query, limit=limit)

    try:
        query_vector = _get_embedding(query)

        client = get_qdrant_client()
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=limit
        )
        points = [
            {
                "text": hit.payload.get("text"),
                "source": hit.payload.get("source"),
                "title": hit.payload.get("title"),
                "score": hit.score
            }
            for hit in results.points
        ]
        if points:
            return points
        return _search_local_fallback(query, limit=limit)
    except Exception as e:
        print(f"KB Search failed ({e}). Activating smart local knowledge base fallback...")
        return _search_local_fallback(query, limit=limit)


def list_kb_documents() -> list:
    """Return all currently indexed master + custom knowledge base documents from persistent DB."""
    docs = _get_local_documents()
    return [
        {
            "id": d.get("id"),
            "title": d.get("title", ""),
            "category": d.get("category", "General"),
            "text": d.get("text", ""),
            "source": d.get("source", "master-kb"),
            "synced_to_qdrant": bool(d.get("synced_to_qdrant", False)),
        }
        for d in docs
    ]


def add_kb_document(title: str, category: str, text: str, source: str = "admin-console") -> dict:
    """Persist a new knowledge base document in the relational DB and upsert to Qdrant if online."""
    from sqlalchemy import func
    from db.database import SessionLocal
    from db.models import KBArticle
    from db.seed import ensure_kb_seeded

    ensure_kb_seeded()
    clean_title = title.strip()
    clean_cat = category.strip() or "General"
    clean_text = text.strip()

    with SessionLocal() as db:
        max_id = db.query(func.max(KBArticle.id)).scalar() or 30
        next_id = max(int(max_id), 30) + 1
        article = KBArticle(
            id=next_id,
            title=clean_title,
            category=clean_cat,
            text=clean_text,
            source=source,
            synced_to_qdrant=False,
        )
        db.add(article)
        db.commit()
        db.refresh(article)

        synced_to_qdrant = False
        if GEMINI_API_KEY and is_qdrant_online():
            try:
                from qdrant_client.http.models import PointStruct
                text_to_embed = f"Title: {article.title}\nCategory: {article.category}\nContent: {article.text}"
                vector = _get_embedding(text_to_embed)
                client = init_qdrant()
                client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=[
                        PointStruct(
                            id=article.id,
                            vector=vector,
                            payload={
                                "category": article.category,
                                "title": article.title,
                                "text": article.text,
                                "source": article.source,
                            },
                        )
                    ],
                )
                article.synced_to_qdrant = True
                db.commit()
                synced_to_qdrant = True
            except Exception as e:
                print(f"[KB Add] Qdrant upsert skipped ({e}); persisted in relational DB.")

        return {
            "id": article.id,
            "title": article.title,
            "category": article.category,
            "text": article.text,
            "source": article.source,
            "synced_to_qdrant": synced_to_qdrant,
        }

