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

def _get_embedding(text: str) -> list:
    """Get embedding vector using google-genai client (supports AQ.* keys)."""
    client = genai.Client(api_key=GEMINI_API_KEY)
    result = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
    return result.embeddings[0].values

def get_qdrant_client():
    if QDRANT_API_KEY:
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=3.0, check_compatibility=False)
    return QdrantClient(url=QDRANT_URL, timeout=3.0, check_compatibility=False)

def init_qdrant():
    client = get_qdrant_client()
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
    return client

def _search_local_fallback(query: str, limit: int = 3):
    """Zero-downtime fallback: searches the master knowledge base in-memory when Qdrant Cloud is unreachable."""
    try:
        from ingest_kb import documents
    except Exception:
        return []

    words = set([w.lower().strip("?,.!\"'") for w in query.split() if len(w) > 2])
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
