# ZENIVIXON — Autonomous Customer Support & Triage Agent

[![FastAPI](https://img.shields.io/badge/FastAPI-0.148-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2-blue?logo=langchain)](https://github.com/langchain-ai/langgraph)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-3.8%20Flash-4285F4?logo=google)](https://ai.google.dev)
[![Qdrant](https://img.shields.io/badge/Qdrant-Cloud%20Vector%20DB-DC2626?logo=qdrant)](https://qdrant.tech)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(React%2019)-black?logo=next.js)](https://nextjs.org)

**ZENIVIXON** is an enterprise-grade autonomous customer support console and intelligent ticket triage system. Driven by a stateful **LangGraph multi-agent pipeline**, it automatically classifies inbound customer tickets, retrieves relevant knowledge base articles via grounded RAG, executes internal database lookups (Orders, Invoices, Subscriptions), calculates customer churn risk, and resolves inquiries—seamlessly escalating high-risk cases to human workflows with ready-to-reply handoff packages.

---

## 🌟 Key Highlights

- **Dual-Portal Architecture**:
  - **Public Customer Portal**: Allows customers to submit inquiries and track live resolution status using their numeric Ticket ID with bilingual support (English & বাংলা Bengali).
  - **Protected Team Operations Console**: Passcode-protected console (`zenivixon admin pannel`, `zenivixon`) featuring real-time KPIs, 7-day resolution trends, category/priority distribution, interactive scenario simulator, and filterable inbound ticket ledger.
- **Stateful LangGraph 6-Node Pipeline**: Processes tickets through intake classification, customer verification, live system tools & RAG retrieval, grounded resolution drafting, and deterministic safety policy gating.
- **Fast-Track Critical Escalation**: Bypasses latency and token quota for Critical Priority or Angry sentiment inquiries, instantly routing to Zendesk escalation with contextual retention advice.
- **Zero-Downtime Resilient Fallback Engine**: If cloud vector search or external LLM quotas reach rate limits (`RESOURCE_EXHAUSTED 429`), the system seamlessly falls back to an in-memory 30-chunk master knowledge base and multilingual heuristic classification without failing.
- **Dual Deployment Modes**: Run the pre-built frontend directly from the FastAPI backend at `http://localhost:8000/ui`, or run the Next.js development server at `http://localhost:3000`.

---

## 🏗️ System Architecture

```text
                               ┌─────────────────────────┐
                               │     Inbound Ticket      │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │   1. Intake Node        │
                               │  Intent / Sentiment /   │
                               │   Priority Analysis     │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │   2. Verify Node        │
                               │ Customer ID & Tier Auth │
                               └────────────┬────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      │ Priority == 'Critical' OR Sentiment == 'Angry'
             [ Fast-Track ]                                  [ Standard Flow ]
                      ▼                                           │
         ┌─────────────────────────┐                 ┌────────────▼────────────┐
         │   6. Escalation Node    │                 │   3. Tool Execution     │
         │  Zendesk Handoff &      │                 │  Orders, Invoices, Subs │
         │  Retention Calculation  │                 │  + 30-Chunk Qdrant RAG  │
         └────────────┬────────────┘                 └────────────┬────────────┘
                      │                                           │
                      │                              ┌────────────▼────────────┐
                      │                              │  4. Resolution Engine   │
                      │                              │ Grounded Gemini AI Response│
                      │                              └────────────┬────────────┘
                      │                                           │
                      │                              ┌────────────▼────────────┐
                      │                              │   5. Safety Gate Node   │
                      │                              │  Deterministic Policy   │
                      │                              └────────────┬────────────┘
                      │                                           │
                      │                         ┌─────────────────┴─────────────────┐
                      │                         │ Is Safe & Verified?               │
                      │                     [ No ]                                [ Yes ]
                      │                         │                                   │
                      └─────────────────────────┼──────────────────────────┐        │
                                                ▼                          │        ▼
                                   ┌─────────────────────────┐             │ ┌───────────────┐
                                   │   Escalation Package    │             │ │ Auto-Resolved │
                                   │ (Agent Action & Credit) │             │ └───────────────┘
                                   └─────────────────────────┘             │
```

---

## 🛠️ Tech Stack

- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com) + [SQLAlchemy](https://www.sqlalchemy.org)
- **Agent Orchestration**: [LangGraph](https://github.com/langchain-ai/langgraph) (StateGraph pipeline)
- **AI / LLM**: Google GenAI SDK (`gemini-3.8-flash`, `models/gemini-embedding-001` with 3072-dim vectors)
- **Vector Database**: [Qdrant Cloud](https://qdrant.tech) (`zenivixon_kb` collection) + Local In-Memory Fallback
- **Relational Ledger**: [Neon PostgreSQL](https://neon.tech) + SQLite automatic offline fallback
- **Frontend**: [Next.js 16](https://nextjs.org) (App Router), [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Lucide Icons](https://lucide.dev)

---

## 🚀 Quick Start & Setup

### Prerequisites
- **Python 3.10+**
- **Node.js v20+** (Optional if running pre-built UI via FastAPI)

### 1. Automated Setup (Windows PowerShell)
Run the automated environment setup script:
```powershell
.\setup_and_run.ps1
```

### 2. Manual Launch

#### Step 1: Configure Environment
Copy `.env.example` to `.env` in `backend/` and configure your credentials:
```bash
cp backend/.env.example backend/.env
```

Ensure `backend/.env` contains your Gemini API key and database connection:
```ini
DATABASE_URL="postgresql+psycopg2://<user>:<pass>@<neon-host>/neondb?sslmode=require"
QDRANT_URL="https://<your-qdrant-cluster>.qdrant.io"
QDRANT_API_KEY="<your-qdrant-api-key>"
GEMINI_API_KEY="AIzaSy... or AQ...."
GEMINI_MODEL="gemini-3.8-flash"
```

#### Step 2: Seed the Database
```powershell
cd backend
.venv\Scripts\python.exe db/seed.py
```

#### Step 3: Run Backend API & Integrated UI
```powershell
cd backend
.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```
- **Integrated Full Web UI**: [http://localhost:8000/ui](http://localhost:8000/ui)
- **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Granular Health Check**: [http://localhost:8000/api/health/deep](http://localhost:8000/api/health/deep)

#### Step 4: Run Next.js Frontend (Optional / Standalone Dev)
```powershell
cd frontend
npm install
npm run dev
```
- **Public Portal & Team Console**: [http://localhost:3000](http://localhost:3000)

> **Team Console Passcode**: `zenivixon admin pannel` (or `zenivixon`)

---

## 🔌 API Reference (FastAPI)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | External healthcheck returning uptime and service timestamp |
| `GET` | `/api/health/deep` | Granular telemetry checking Database (Postgres/SQLite), Qdrant Vector RAG, and LLM key status |
| `GET` | `/ui` | Serves the pre-compiled full Next.js UI directly from FastAPI |
| `POST` | `/api/tickets` | Submits a new support ticket and executes the 6-node LangGraph agent pipeline |
| `GET` | `/api/dashboard/stats` | Aggregated KPIs, resolution/escalation counts, categories, priorities, and 7-day trend |
| `GET` | `/api/tickets` | Lists support tickets with filtering by `status`, `category`, and pagination (`limit`, `offset`) |
| `GET` | `/api/tickets/{ticket_id}` | Retrieves full ticket telemetry, customer verification, tool executions, and draft responses |
| `PATCH` | `/api/tickets/{ticket_id}` | Manually updates ticket resolution status (`resolved` or `escalated`) |

---

## 🧪 Verification & Test Suite

The project includes a 22-point end-to-end integration test suite verifying all database tools, vector RAG retrieval, multilingual heuristic classification, churn risk calculation, LangGraph nodes, auto-resolve flows, fast-track escalation, and all REST endpoints:

```powershell
backend\.venv\Scripts\python.exe C:\Users\pc\.gemini\antigravity\brain\8fa82567-ca85-43d8-a394-2357bad2ac45\scratch\test_all_systems.py
```

**Test Results: 22/22 Tests Passed (100%)**

---

## 📸 Screenshots

| View | Description |
|---|---|
| **Operations Dashboard** | Real-time KPIs, 7-day resolution trend, category & churn distribution |
| **Inbound Ledger** | Searchable & filterable ticket table with customer tiers and risk flags |
| **Handoff Package** | Contextual retention talking points, tool traces, and one-click agent action |
| **Customer Portal** | Self-service ticket submission and live tracking by Ticket ID in English & বাংলা |

---

## 📄 License
MIT License. Built for enterprise autonomous support operations.
