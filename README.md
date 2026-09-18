# ZENIVIXON — Autonomous Customer Support & Triage Agent

ZENIVIXON (formerly LogiFlow) is an enterprise support console and autonomous ticket triage system. Driven by a stateful LangGraph multi-agent pipeline, it automatically classifies inbound tickets, retrieves relevant knowledge base articles, and resolves inquiries via grounded RAG—seamlessly escalating complex cases to human workflows.

The system pairs a multi-agent backend orchestration layer (LangGraph + Gemini + FastAPI) with a modern web dashboard (Next.js 16 + Tailwind v4).

## Highlights

- **Multi-agent orchestration with LangGraph** — A robust stateful graph that processes tickets through sequential stages: intake, verification, tool execution, resolution, and final safety guardrails before deciding to automatically resolve or escalate to a human.
- **Modern Infrastructure** — Fully containerized backing services using Docker Compose, including PostgreSQL (relational data), Qdrant (vector search for RAG), and Redis.
- **Grounded AI** — RAG agent powered by Google Gemini (`gemini-3.6-flash`) and `models/gemini-embedding-001` (3072-dim vectors), ensuring responses are grounded in the 30-chunk ZENIVIXON Master Knowledge Base.

## Architecture

```text
                          ┌─────────────────────┐
                          │        START        │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │       intake        │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │       verify        │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │        tools        │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │      resolution     │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │       safety        │
```
User / Customer
      │
      ▼
Next.js Operations Console (Port 3000)
      │
      ▼
FastAPI Backend (Port 8000)
      │
      ▼
LangGraph Autonomous Agent Pipeline
  ├── 1. Intake & Classification (LLM: Gemini 3.6 Flash)
  ├── 2. Customer ID Verification (PostgreSQL / Neon)
  ├── 3. Tools & Knowledge Retrieval (Qdrant Vector Store: 30 Master Chunks)
  ├── 4. Grounded Resolution Engine (Gemini 3.6 Flash)
  ├── 5. Safety Gate & Policy Verification
  └── 6. Output Route: Auto-Resolve OR Human Escalation (Zendesk Mock/Live)
```

**Tech Stack:**
- **Backend:** FastAPI + SQLAlchemy, LangGraph, Google GenAI SDK (`gemini-3.6-flash`, `models/gemini-embedding-001`)
- **Vector DB:** Qdrant Cloud (`zenivixon_kb` collection with 3072-dim cosine vectors)
- **Database:** Neon PostgreSQL (`zenivixon_db` relational ledger)
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons

---

## Setup

### Prerequisites
- Docker & Docker Compose
- Node.js v20+
- Python 3.10+

### 1. Infrastructure
Start the required databases (PostgreSQL, Qdrant, Redis):
```bash
docker-compose up -d
```

### 2. Backend
Navigate to the backend directory, create a virtual environment, and run the server:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
# Note: Ensure you install necessary dependencies (fastapi, uvicorn, sqlalchemy, langgraph, langchain-google-genai, qdrant-client, etc.)

export GEMINI_API_KEY="your_api_key_here"
export QDRANT_URL="http://localhost:6333"

uvicorn main:app --reload --port 8000
```
*(The API will be available at `http://localhost:8000`)*

### 3. Frontend
Navigate to the frontend directory and start the Next.js development server:
```bash
cd frontend
npm install
npm run dev
```
*(The web UI will be available at `http://localhost:3000`)*

---

## API Surface (FastAPI)

| Endpoint | Purpose |
|---|---|
| `POST /api/tickets` | Submit a new ticket; executes the LangGraph workflow |
| `GET /api/dashboard/stats` | Retrieves current KPIs, resolved/escalated counts, and resolution rates |

---

## Screenshots

*(Note: UI screenshots from previous iteration "LogiFlow")*

| | |
|---|---|
| **Live Inbox** — filterable by urgency, category, status, and churn risk | ![Inbox](screenshots/LogiFlow-1.png) |
| **Operations Dashboard** — KPIs, category/urgency breakdowns, 7-day churn trend, critical feed | ![Dashboard](screenshots/LogiFlow-2.png) |
| **Ticket detail** — full agent pipeline trace with retrieved doc relevance scores and editable draft | ![Ticket detail](screenshots/LogiFlow-3.png) |
| **Churn-risk escalation** — flagged signals, tier-specific retention talking points | ![Churn risk](screenshots/LogiFlow-4.png) |
| **Knowledge Base** — browsable source docs with embedding stats and reload | ![Knowledge base](screenshots/LogiFlow-5.png) |
| **Submit Ticket** — live LangGraph progress as each agent completes | ![Submit ticket](screenshots/LogiFlow-6.png) |
| **Critical path** — urgency=critical skips RAG and routes straight to escalation | ![Critical escalation](screenshots/LogiFlow-7.png) |
