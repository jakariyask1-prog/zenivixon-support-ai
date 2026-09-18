import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from google import genai

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
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    return QdrantClient(url=QDRANT_URL)

def init_qdrant():
    client = get_qdrant_client()
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
    return client

def search_kb(query: str, limit: int = 3):
    if not GEMINI_API_KEY:
        return []  # Fallback if no key

    try:
        query_vector = _get_embedding(query)

        client = get_qdrant_client()
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=limit
        )
        return [
            {
                "text": hit.payload.get("text"),
                "source": hit.payload.get("source"),
                "title": hit.payload.get("title"),
                "score": hit.score
            }
            for hit in results.points
        ]
    except Exception as e:
        print(f"KB Search failed: {e}")
        return []
