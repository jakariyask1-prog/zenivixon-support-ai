# ZENIVIXON — Autonomous Customer Support & Triage Agent

[![FastAPI](https://img.shields.io/badge/FastAPI-0.165-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2-blue?logo=langchain)](https://github.com/langchain-ai/langgraph)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4?logo=google)](https://ai.google.dev)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-DC2626?logo=qdrant)](https://qdrant.tech)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(React%2019)-black?logo=next.js)](https://nextjs.org)

**ZENIVIXON** is an enterprise-grade autonomous customer support console and intelligent ticket triage system. Driven by a stateful **LangGraph 6-node multi-agent pipeline**, it classifies inbound customer tickets, verifies customer identity and tier, executes tenant-isolated live database lookups (Orders, Invoices, Subscriptions) alongside grounded Qdrant RAG retrieval, streams real-time execution progress via SSE, computes quantitative churn risk, and routes high-risk cases to human engineers with structured handoff packages.

---

## 🌟 Key Highlights

- **Dual-Portal Architecture**:
  - **Public Customer Portal**: Submit inquiries with **real-time SSE pipeline streaming** and track live resolution status securely using Ticket ID + Email in **English & বাংলা (Bengali)**.
  - **Protected Team Operations Console**: Environment-configured, timing-safe passcode-protected console featuring real-time KPIs, actual measured pipeline latency, dynamic portfolio risk health, 7-day trends, interactive scenario simulator, filterable ticket ledger, and a **Live Knowledge Base Manager**.
- **Stateful LangGraph 6-Node Pipeline**: Processes tickets through intake classification, identity & tier verification, tenant-isolated tools + 30-chunk RAG retrieval, grounded resolution drafting, deterministic safety gating, and Zendesk escalation.
- **Fast-Track Critical Escalation**: After executing tools so human agents have complete order/invoice context, Critical Priority or Angry sentiment tickets bypass LLM drafting and route directly to escalation with VIP/contextual retention advice.
- **Zero-Downtime Resilient Fallback Engine**: Seamlessly falls back to SQLite (WAL mode), in-memory 30-chunk master KB search, and bilingual heuristic classification when external cloud services or LLM quotas are unavailable.
- **Security Hardened**: Strict `customer_id` tenant isolation (IDOR prevention), `EmailStr` & length validation, per-IP sliding-window rate limiting, timing-safe admin auth (`hmac.compare_digest`), and HTTP timeouts on external calls.

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
                               │ Customer ID, Active &   │
                               │     VIP Tier Auth       │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │   3. Tool Execution     │
                               │ Tenant-Isolated Orders, │
                               │ Invoices, Subs + RAG KB │
                               └────────────┬────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      │ Priority == 'Critical' OR Sentiment == 'Angry'
             [ Fast-Track ]                                  [ Standard Flow ]
                      ▼                                           │
         ┌─────────────────────────┐                 ┌────────────▼────────────┐
         │   6. Escalation Node    │                 │  4. Resolution Engine   │
         │  Zendesk Handoff &      │                 │ Grounded Gemini Response│
         │  VIP Churn Retention    │                 └────────────┬────────────┘
         └────────────┬────────────┘                              │
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

- **Backend**: [FastAPI](https://fastapi.tiangolo.com), [SQLAlchemy](https://www.sqlalchemy.org), [Pydantic](https://docs.pydantic.dev)
- **Agent Orchestration**: [LangGraph](https://github.com/langchain-ai/langgraph) (StateGraph + SSE Streaming)
- **AI / LLM**: Google GenAI (`gemini-2.5-flash`, `models/gemini-embedding-001` with 3072-dim vectors)
- **Vector Database**: [Qdrant](https://qdrant.tech) (`zenivixon_kb` collection) + Local In-Memory Fallback
- **Relational Database**: [PostgreSQL](https://www.postgresql.org) + SQLite (WAL mode) offline fallback
- **Frontend**: [Next.js 16](https://nextjs.org) (App Router), [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Lucide Icons](https://lucide.dev)

---

## 🚀 Quick Start

### 1. Configure Environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Configure `backend/.env`:
```ini
APP_ENV="development"
DATABASE_URL="postgresql://zenivixon:changeme@localhost:5432/zenivixon_db"
QDRANT_URL="http://localhost:6333"
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-2.5-flash"
ADMIN_PASSCODES="zenivixon-admin-2026"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:8000"
RATE_LIMIT_PER_MINUTE="30"
```

### 2. Install & Seed Backend
```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
PYTHONPATH=backend backend/.venv/bin/python backend/db/seed.py
```

### 3. Run Backend & Frontend
```bash
# Terminal 1: FastAPI Backend
PYTHONPATH=backend backend/.venv/bin/uvicorn main:app --app-dir backend --reload --port 8000

# Terminal 2: Next.js Frontend
npm --prefix frontend ci
npm --prefix frontend run dev
```

- **Frontend UI**: `http://localhost:3000`
- **Swagger API Docs**: `http://localhost:8000/docs`
- **Deep Health Check**: `http://localhost:8000/api/health/deep`

---

## 🔌 API Reference (FastAPI)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Basic uptime healthcheck |
| `GET` | `/api/health/deep` | Public | Inspects Database, Qdrant RAG mode, and LLM configuration |
| `POST` | `/api/tickets` | Public (Rate-limited) | Submits a ticket and runs the 6-node LangGraph pipeline |
| `POST` | `/api/tickets/stream` | Public (Rate-limited) | Streams real-time LangGraph node execution via SSE |
| `GET` | `/api/portal/track` | Public (Rate-limited) | Privacy-protected tracking requiring matching `ticket_id` + `email` |
| `GET` | `/api/dashboard/stats` | `X-Admin-Passcode` | KPIs, real avg latency, all categories, priorities, and 7-day trend |
| `GET` | `/api/tickets` | `X-Admin-Passcode` | Lists tickets with `status`, `category`, `limit`, and `offset` |
| `GET` | `/api/tickets/{ticket_id}` | `X-Admin-Passcode` | Full ticket telemetry, verification status, tool traces, and draft |
| `PATCH` | `/api/tickets/{ticket_id}` | `X-Admin-Passcode` | Updates ticket status (`open`, `processing`, `resolved`, `escalated`) |
| `GET` | `/api/kb` | `X-Admin-Passcode` | Lists all indexed Knowledge Base chunks |
| `POST` | `/api/kb` | `X-Admin-Passcode` | Ingests a new Knowledge Base chunk into runtime RAG / Qdrant |

---

## 🧪 Automated Testing & Evaluation Benchmark

```bash
# Run full Pytest API & Agent integration test suite
backend/.venv/bin/pytest backend/tests/test_api_and_agent.py -v

# Run 12-scenario English & Bengali agent evaluation benchmark
backend/.venv/bin/python backend/eval_agent.py

# Lint and build frontend
npm --prefix frontend run lint && npm --prefix frontend run build
```

---

## 📄 License
MIT License. Built for enterprise autonomous support operations.
