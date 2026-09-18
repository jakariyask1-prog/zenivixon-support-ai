import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from langchain_google_genai import GoogleGenerativeAIEmbeddings

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
COLLECTION_NAME = "zenivixon_kb"

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
            vectors_config=VectorParams(size=3072, distance=Distance.COSINE),
        )
    return client

def search_kb(query: str, limit: int = 3):
    if not GEMINI_API_KEY:
        return [] # Fallback if no key
    
    embeddings = GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-2",
        google_api_key=GEMINI_API_KEY
    )
    query_vector = embeddings.embed_query(query)
    
    client = get_qdrant_client()
    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=limit
    )
    
    return [{"text": hit.payload.get("text"), "source": hit.payload.get("source"), "score": hit.score} for hit in results.points]
