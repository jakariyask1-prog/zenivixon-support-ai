import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "zenivixon_kb"

if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY is not set. Please set it in your .env or .env.local file.")
    exit(1)

# Here you can add all the FAQ, pricing, and documentation data
documents = [
    {
        "id": 1,
        "category": "FAQ",
        "title": "What services does Zenivixon offer?",
        "text": "Zenivixon engineers purpose-built autonomous AI agents, AI workflows & business automation pipelines, custom software & modern web development (Next.js/React), and AI system integration (Vector RAG). We transform manual operations into intelligent automated workflows.",
        "source": "website-faq"
    },
    {
        "id": 2,
        "category": "Pricing",
        "title": "How much does a custom AI agent cost?",
        "text": "Pricing for custom AI agents depends on complexity, integration requirements, and scale. We offer customized quotes after an initial consultation.",
        "source": "pricing-policy"
    }
    # Add more ZENIVIXON documents here...
]

def ingest_data():
    if QDRANT_API_KEY:
        client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    else:
        client = QdrantClient(url=QDRANT_URL)
    
    # 1. Check if collection exists, if not create it
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        print(f"Creating collection: {COLLECTION_NAME} with vector size 768...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=3072, distance=Distance.COSINE),
        )
    else:
        print(f"Collection {COLLECTION_NAME} already exists.")

    # 2. Initialize Gemini Embeddings Model
    embeddings_model = GoogleGenerativeAIEmbeddings(
        model="gemini-embedding-2",
        google_api_key=GEMINI_API_KEY
    )

    # 3. Generate embeddings and create Qdrant Points
    points = []
    print("Generating Gemini embeddings and preparing data...")
    for doc in documents:
        text_to_embed = f"Title: {doc['title']}\nCategory: {doc['category']}\nContent: {doc['text']}"
        
        # Get the vector embedding from Gemini
        vector = embeddings_model.embed_query(text_to_embed)
        
        points.append(
            PointStruct(
                id=doc["id"],
                vector=vector,
                payload={
                    "category": doc["category"],
                    "title": doc["title"],
                    "text": doc["text"],
                    "source": doc["source"]
                }
            )
        )

    # 4. Upsert data to Qdrant
    print(f"Upserting {len(points)} documents to Qdrant...")
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points
    )
    print("Successfully ingested all documents! Your ZENIVIXON RAG Knowledge Base is ready.")

if __name__ == "__main__":
    ingest_data()
