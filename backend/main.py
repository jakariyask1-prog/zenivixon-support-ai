from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Optional
import hmac
import json
import logging
import os
import pathlib
import threading
import time

from db.database import engine, Base, get_db, SessionLocal
from db.models import Customer, Ticket
from db.seed import ensure_kb_seeded
from agents.graph import zenivixon_agent
from core.qdrant_store import list_kb_documents, add_kb_document

logger = logging.getLogger(__name__)

DEV_DEFAULT_PASSCODES = {"zenivixon-2026", "zenivixon-admin-2026"}


def get_configured_admin_passcodes() -> set[str]:
    """Return valid admin passcodes. Fails closed in production if ADMIN_PASSCODES is unset."""
    raw = os.getenv("ADMIN_PASSCODES", "")
    parsed = {p.strip() for p in raw.split(",") if p.strip()}
    if parsed:
        return parsed
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env == "production":
        return set()
    return set(DEV_DEFAULT_PASSCODES)


def is_valid_admin_passcode(candidate_raw: Optional[str]) -> bool:
    """Case-sensitive, timing-safe admin passcode verification."""
    if not candidate_raw:
        return False
    valid_passcodes = get_configured_admin_passcodes()
    if not valid_passcodes:
        return False
    candidate_bytes = candidate_raw.strip().encode("utf-8")
    return any(
        hmac.compare_digest(candidate_bytes, valid.encode("utf-8"))
        for valid in valid_passcodes
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_kb_seeded()
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env == "production":
        if os.getenv("ALLOWED_ORIGINS", "*").strip() == "*":
            logger.warning("SECURITY WARNING: ALLOWED_ORIGINS='*' in production. Restrict origins to your frontend domain.")
        if not get_configured_admin_passcodes():
            logger.warning("SECURITY WARNING: ADMIN_PASSCODES is unset in production. Team Console endpoints are locked.")
    yield


# Ensure schema exists even if TestClient is instantiated without lifespan context
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ZENIVIXON Support API", version="2.1.0", lifespan=lifespan)

# Configurable CORS (defaults to "*" in dev so Netlify / external frontends work unless restricted)
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-Admin-Passcode"],
)

# Bounded thread-safe sliding-window rate limiters (public + admin brute-force protection)
_MAX_TRACKED_IPS = 2048
_rate_limit_lock = threading.Lock()
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)
_admin_fail_buckets: dict[str, deque[float]] = defaultdict(deque)


def _extract_client_ip(request: Request) -> str:
    if os.getenv("TRUST_PROXY_HEADERS", "false").strip().lower() in {"1", "true", "yes"}:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            if first_ip:
                return first_ip
    return request.client.host if request.client else "unknown"


def _prune_buckets(store: dict[str, deque[float]], window_start: float) -> None:
    if len(store) <= _MAX_TRACKED_IPS:
        return
    stale_ips = []
    for ip, dq in store.items():
        while dq and dq[0] < window_start:
            dq.popleft()
        if not dq:
            stale_ips.append(ip)
    for ip in stale_ips:
        store.pop(ip, None)


def require_admin_auth(
    request: Request,
    x_admin_passcode: Optional[str] = Header(None, alias="X-Admin-Passcode")
):
    """Validate administrative team passcode with brute-force rate limiting and timing-safe comparison."""
    max_fails = int(os.getenv("ADMIN_AUTH_MAX_FAILS_PER_MINUTE", "10"))
    client_ip = _extract_client_ip(request)
    now = time.monotonic()
    window_start = now - 60.0

    with _rate_limit_lock:
        _prune_buckets(_admin_fail_buckets, window_start)
        fail_bucket = _admin_fail_buckets.get(client_ip)
        if fail_bucket is not None:
            while fail_bucket and fail_bucket[0] < window_start:
                fail_bucket.popleft()
            if not fail_bucket:
                _admin_fail_buckets.pop(client_ip, None)
            elif max_fails > 0 and len(fail_bucket) >= max_fails:
                raise HTTPException(
                    status_code=429,
                    detail="Too many failed authentication attempts. Please wait a minute before retrying."
                )

    if is_valid_admin_passcode(x_admin_passcode):
        return True

    with _rate_limit_lock:
        _admin_fail_buckets[client_ip].append(now)

    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Valid Team Console passcode required in X-Admin-Passcode header."
    )


def check_rate_limit(request: Request):
    """Enforce bounded per-IP sliding-window rate limit on public endpoints."""
    limit_per_min = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
    if limit_per_min <= 0:
        return
    client_ip = _extract_client_ip(request)
    now = time.monotonic()
    window_start = now - 60.0
    with _rate_limit_lock:
        _prune_buckets(_rate_limit_buckets, window_start)
        bucket = _rate_limit_buckets[client_ip]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= limit_per_min:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please wait a minute before submitting more requests."
            )
        bucket.append(now)


frontend_out = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "out"
if frontend_out.exists() and (frontend_out / "index.html").exists():
    if (frontend_out / "_next").exists():
        app.mount("/_next", StaticFiles(directory=str(frontend_out / "_next")), name="next_static")

    @app.get("/ui")
    def serve_ui():
        return FileResponse(frontend_out / "index.html")


@app.get("/")
@app.get("/health")
def health_check():
    """Healthcheck endpoint for external uptime monitoring."""
    return {
        "status": "online",
        "service": "ZENIVIXON Support AI",
        "version": "2.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/health/deep")
def deep_health_check(db: Session = Depends(get_db)):
    """Granular health check inspecting Database, Knowledge Base RAG, and LLM configuration."""
    health_results = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {}
    }

    # 1. Database Check
    try:
        cust_count = db.query(Customer).count()
        db_type = "postgresql" if "postgresql" in str(engine.url) else "sqlite_fallback"
        health_results["services"]["database"] = {
            "status": "healthy",
            "type": db_type,
            "customers_registered": cust_count
        }
    except Exception as e:
        health_results["services"]["database"] = {"status": "degraded", "error": str(e)}
        health_results["status"] = "degraded"

    # 2. Vector Knowledge Base Check
    try:
        from core.qdrant_store import search_kb
        test_results = search_kb("ZENIVIXON", limit=1)
        source = test_results[0].get("source", "unknown") if test_results else "empty"
        health_results["services"]["knowledge_base_rag"] = {
            "status": "healthy",
            "mode": "live_vector_store" if "offline" not in source else "local_resilient_fallback",
            "source_sample": source
        }
    except Exception as e:
        health_results["services"]["knowledge_base_rag"] = {"status": "degraded", "error": str(e)}
        health_results["status"] = "degraded"

    # 3. LLM Configuration Check
    from agents.nodes import GEMINI_MODEL
    has_key = bool(os.getenv("GEMINI_API_KEY"))
    health_results["services"]["llm"] = {
        "status": "configured" if has_key else "missing_key",
        "model": GEMINI_MODEL,
        "has_api_key": has_key
    }

    return health_results


class TicketRequest(BaseModel):
    email: EmailStr
    message: str = Field(..., min_length=3, max_length=2000)


class KBDocumentRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    category: str = Field(default="General", min_length=2, max_length=60)
    text: str = Field(..., min_length=10, max_length=5000)


def _create_ticket_snapshot(req: TicketRequest, trusted_session: bool) -> tuple[dict, dict]:
    """Create or retrieve customer and persist initial ticket in a short-lived DB transaction."""
    clean_email = str(req.email).strip().lower()
    clean_message = req.message.strip()

    with SessionLocal() as db:
        existing_customer = db.query(Customer).filter(func.lower(Customer.email) == clean_email).first()
        is_verified_user = bool(existing_customer and existing_customer.is_active)

        if not existing_customer:
            name_part = clean_email.split("@")[0].replace(".", " ").title() if "@" in clean_email else "Customer"
            customer = Customer(
                email=clean_email,
                name=name_part,
                company="General",
                tier="standard",
                is_active=False  # Guest / unverified submission until confirmed
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
        else:
            customer = existing_customer

        ticket = Ticket(
            customer_id=customer.id,
            customer_email=clean_email,
            raw_message=clean_message,
            resolution_status="processing"
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        customer_snapshot = {
            "id": customer.id,
            "email": clean_email,
            "name": customer.name,
            "tier": customer.tier or "standard",
        }
        initial_state = {
            "ticket_id": ticket.id,
            "customer_email": clean_email,
            "raw_message": clean_message,
            "customer_id": customer.id,
            "is_verified": is_verified_user,
            "trusted_session": trusted_session,
            "customer_tier": customer.tier or "standard",
            "agent_trace": []
        }
        return customer_snapshot, initial_state


def _persist_ticket_outcome(
    ticket_id: int,
    customer_snapshot: dict,
    raw_message: str,
    final_state: dict,
    elapsed_ms: int,
    trusted_session: bool,
) -> dict:
    """Persist LangGraph outcome in a short-lived DB session and sanitize public escalated drafts."""
    status_val = final_state.get("resolution_status", "open")
    internal_draft = final_state.get("draft_response")

    with SessionLocal() as db:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if ticket:
            ticket.category = final_state.get("category")
            ticket.intent = final_state.get("intent")
            ticket.priority = final_state.get("priority")
            ticket.sentiment = final_state.get("sentiment")
            ticket.resolution_status = status_val
            ticket.draft_response = internal_draft
            ticket.ai_findings = final_state.get("ai_findings")
            ticket.tools_executed = json.dumps(final_state.get("tool_outputs", []))
            ticket.escalation_reason = final_state.get("escalation_reason")
            ticket.recommended_action = final_state.get("recommended_action")
            ticket.churn_risk_score = final_state.get("churn_risk_score", 20)
            ticket.processing_time_ms = elapsed_ms
            if status_val == "resolved":
                ticket.resolved_at = datetime.now(timezone.utc)
            db.commit()

    # Suppress internal/partial draft from public callers when a ticket was blocked or escalated
    public_draft = internal_draft if (trusted_session or status_val != "escalated") else None

    return {
        "ticket_id": ticket_id,
        "customer_email": customer_snapshot["email"],
        "customer_name": customer_snapshot["name"],
        "customer_tier": final_state.get("customer_tier") or customer_snapshot["tier"],
        "raw_message": raw_message,
        "status": status_val,
        "trace": final_state.get("agent_trace", []),
        "category": final_state.get("category"),
        "intent": final_state.get("intent"),
        "priority": final_state.get("priority"),
        "sentiment": final_state.get("sentiment"),
        "ai_findings": final_state.get("ai_findings"),
        "escalation_reason": final_state.get("escalation_reason"),
        "recommended_action": final_state.get("recommended_action"),
        "churn_risk_score": final_state.get("churn_risk_score", 20),
        "processing_time_ms": elapsed_ms,
        "draft_response": public_draft,
        "tools_executed": final_state.get("tool_outputs", []),
        "is_verified": bool(final_state.get("is_verified", False))
    }


@app.post("/api/tickets")
def submit_ticket(
    req: TicketRequest,
    x_admin_passcode: Optional[str] = Header(None, alias="X-Admin-Passcode"),
    _: None = Depends(check_rate_limit)
):
    started_at = time.perf_counter()
    trusted_session = is_valid_admin_passcode(x_admin_passcode)
    customer_snapshot, initial_state = _create_ticket_snapshot(req, trusted_session=trusted_session)

    try:
        final_state = zenivixon_agent.invoke(initial_state)
    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        final_state = initial_state.copy()
        final_state["resolution_status"] = "escalated"
        final_state["escalation_reason"] = "System Policy: Autonomous triage deferred to human engineering."
        final_state["agent_trace"] = list(final_state.get("agent_trace", [])) + [
            "Autonomous triage deferred to senior engineer."
        ]

    elapsed_ms = max(1, int((time.perf_counter() - started_at) * 1000))
    return _persist_ticket_outcome(
        ticket_id=initial_state["ticket_id"],
        customer_snapshot=customer_snapshot,
        raw_message=initial_state["raw_message"],
        final_state=final_state,
        elapsed_ms=elapsed_ms,
        trusted_session=trusted_session,
    )


NODE_DISPLAY_LABELS = {
    "intake": "1. Intake & NLU Classification",
    "verify": "2. Customer Identity Verification",
    "tools": "3. Live DB Tools & Vector RAG",
    "resolution": "4. Grounded AI Resolution Engine",
    "safety": "5. Deterministic Safety & Churn Gate",
    "escalation": "6. Human Escalation Handoff",
    "resolve": "6. Auto-Resolution Finalized",
}


@app.post("/api/tickets/stream")
def submit_ticket_stream(
    req: TicketRequest,
    x_admin_passcode: Optional[str] = Header(None, alias="X-Admin-Passcode"),
    _: None = Depends(check_rate_limit)
):
    """Stream real-time LangGraph node execution progress via Server-Sent Events (SSE) without holding DB connections."""
    trusted_session = is_valid_admin_passcode(x_admin_passcode)

    def event_generator():
        started_at = time.perf_counter()
        customer_snapshot, initial_state = _create_ticket_snapshot(req, trusted_session=trusted_session)
        ticket_id = initial_state["ticket_id"]
        merged_state = dict(initial_state)
        accumulated_trace = list(initial_state.get("agent_trace", []))

        yield f"event: started\ndata: {json.dumps({'ticket_id': ticket_id})}\n\n"

        try:
            for chunk in zenivixon_agent.stream(initial_state):
                for node_name, node_output in chunk.items():
                    if isinstance(node_output, dict):
                        node_trace = node_output.get("agent_trace")
                        if node_trace:
                            accumulated_trace.extend(node_trace)
                        for k, v in node_output.items():
                            if k != "agent_trace":
                                merged_state[k] = v
                        merged_state["agent_trace"] = accumulated_trace

                    event_payload = {
                        "node": node_name,
                        "label": NODE_DISPLAY_LABELS.get(node_name, node_name),
                        "trace": node_output.get("agent_trace", []) if isinstance(node_output, dict) else [],
                    }
                    yield f"event: node\ndata: {json.dumps(event_payload)}\n\n"
        except Exception as e:
            logger.error(f"Streaming agent execution failed: {e}")
            merged_state["resolution_status"] = "escalated"
            merged_state["escalation_reason"] = "System Policy: Autonomous triage deferred to human engineering."
            accumulated_trace.append("Autonomous triage deferred to senior engineer.")
            merged_state["agent_trace"] = accumulated_trace

        elapsed_ms = max(1, int((time.perf_counter() - started_at) * 1000))
        final_payload = _persist_ticket_outcome(
            ticket_id=ticket_id,
            customer_snapshot=customer_snapshot,
            raw_message=initial_state["raw_message"],
            final_state=merged_state,
            elapsed_ms=elapsed_ms,
            trusted_session=trusted_session,
        )
        yield f"event: done\ndata: {json.dumps(final_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/dashboard/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin_auth)
):
    """Aggregated telemetry & KPI metrics for Team Console (Admin Only)."""
    total = db.query(func.count(Ticket.id)).scalar() or 0

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tickets_today = db.query(func.count(Ticket.id)).filter(Ticket.created_at >= today_start).scalar() or 0

    status_rows = db.query(Ticket.resolution_status, func.count(Ticket.id)).group_by(Ticket.resolution_status).all()
    status_map = dict(status_rows)
    resolved = status_map.get("resolved", 0)
    escalated = status_map.get("escalated", 0)
    pending = status_map.get("open", 0) + status_map.get("processing", 0)

    cat_rows = db.query(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category).all()
    cat_map = dict(cat_rows)
    categories = ["Order", "Billing", "Refund", "Technical", "Account", "Security", "Subscription", "General"]
    cat_counts = {cat: cat_map.get(cat, 0) for cat in categories}

    prio_rows = db.query(Ticket.priority, func.count(Ticket.id)).group_by(Ticket.priority).all()
    prio_map = dict(prio_rows)
    priorities = ["Critical", "High", "Medium", "Low"]
    prio_counts = {p: prio_map.get(p, 0) for p in priorities}

    avg_churn_score = db.query(func.avg(Ticket.churn_risk_score)).filter(Ticket.churn_risk_score.isnot(None)).scalar()
    avg_churn = round(float(avg_churn_score), 1) if avg_churn_score is not None else 0.0

    avg_latency_val = db.query(func.avg(Ticket.processing_time_ms)).filter(Ticket.processing_time_ms.isnot(None)).scalar()
    avg_latency_ms = round(float(avg_latency_val)) if avg_latency_val is not None else None

    seven_days_ago = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    recent_tickets = db.query(Ticket.created_at, Ticket.resolution_status).filter(Ticket.created_at >= seven_days_ago).all()

    daily_stats = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        day_statuses = []
        for t_created, t_status in recent_tickets:
            if t_created:
                t_dt = t_created.replace(tzinfo=timezone.utc) if t_created.tzinfo is None else t_created
                if day_start <= t_dt < day_end:
                    day_statuses.append(t_status)

        daily_stats.append({
            "day": day_start.strftime("%a"),
            "date": day_start.strftime("%b %d"),
            "total": len(day_statuses),
            "resolved": sum(1 for s in day_statuses if s == "resolved"),
            "escalated": sum(1 for s in day_statuses if s == "escalated")
        })

    return {
        "Total Tickets": total,
        "Tickets Today": tickets_today,
        "AI Resolved": resolved,
        "Human Escalated": escalated,
        "Pending": pending,
        "Resolution Rate": f"{round((resolved / total * 100), 1)}%" if total > 0 else "0.0%",
        "Escalation Rate": f"{round((escalated / total * 100), 1)}%" if total > 0 else "0.0%",
        "Average Churn Risk": f"{avg_churn}%",
        "average_churn_risk_value": avg_churn,
        "average_latency_ms": avg_latency_ms,
        "category_breakdown": cat_counts,
        "priority_breakdown": prio_counts,
        "daily_trend": daily_stats
    }


@app.get("/api/portal/track")
def portal_track_ticket(
    ticket_id: int = Query(..., description="Numeric Ticket ID"),
    email: str = Query(..., description="Customer Email address"),
    db: Session = Depends(get_db),
    _: None = Depends(check_rate_limit)
):
    """Secure, privacy-protected ticket tracking for Customer Portal verifying Ticket ID and Email."""
    clean_email = email.strip().lower()
    ticket = db.query(Ticket).options(joinedload(Ticket.customer)).join(Customer).filter(
        Ticket.id == ticket_id,
        func.lower(Customer.email) == clean_email
    ).first()

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail=f"Ticket #{ticket_id} was not found for email '{email}'. Please check your Ticket ID and Email."
        )

    public_draft = ticket.draft_response if ticket.resolution_status != "escalated" else None

    return {
        "id": ticket.id,
        "customer": {
            "email": ticket.customer.email if ticket.customer else clean_email,
            "name": ticket.customer.name if ticket.customer else "Customer",
            "tier": ticket.customer.tier if ticket.customer else "standard",
            "is_verified": bool(ticket.customer and ticket.customer.is_active)
        },
        "raw_message": ticket.raw_message,
        "category": ticket.category or "General",
        "intent": ticket.intent or "Inquiry",
        "priority": ticket.priority or "Medium",
        "sentiment": ticket.sentiment or "Neutral",
        "status": ticket.resolution_status,
        "draft_response": public_draft,
        "ai_findings": ticket.ai_findings,
        "processing_time_ms": ticket.processing_time_ms,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None
    }


@app.get("/api/tickets")
def list_tickets(
    status: str = Query(None, description="Filter by status: open, resolved, escalated"),
    category: str = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin_auth)
):
    """List support tickets with customer info and status (Admin Only, Eager-loaded)."""
    query = db.query(Ticket).options(joinedload(Ticket.customer)).order_by(Ticket.created_at.desc())
    if status:
        query = query.filter(Ticket.resolution_status == status)
    if category:
        query = query.filter(Ticket.category == category)

    total = query.count()
    tickets = query.offset(offset).limit(limit).all()

    items = []
    for t in tickets:
        customer_email = t.customer.email if t.customer else (t.customer_email or "Guest")
        customer_tier = t.customer.tier if t.customer else "standard"
        items.append({
            "id": t.id,
            "customer_email": customer_email,
            "customer_tier": customer_tier,
            "raw_message": t.raw_message,
            "category": t.category or "General",
            "intent": t.intent or "Inquiry",
            "priority": t.priority or "Medium",
            "sentiment": t.sentiment or "Neutral",
            "status": t.resolution_status,
            "churn_risk_score": t.churn_risk_score or 20,
            "processing_time_ms": t.processing_time_ms,
            "recommended_action": t.recommended_action,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
            "escalation_reason": t.escalation_reason
        })

    return {"total": total, "tickets": items}


@app.get("/api/tickets/{ticket_id}")
def get_ticket_detail(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin_auth)
):
    """Retrieve full detail and agent trace for a single ticket (Admin Only)."""
    ticket = db.query(Ticket).options(joinedload(Ticket.customer)).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    tools_parsed = []
    if ticket.tools_executed:
        try:
            tools_parsed = json.loads(ticket.tools_executed)
        except json.JSONDecodeError:
            tools_parsed = []

    email_val = ticket.customer.email if ticket.customer else (ticket.customer_email or "Guest")
    name_val = ticket.customer.name if ticket.customer else (
        ticket.customer_email.split("@")[0].title()
        if ticket.customer_email and "@" in ticket.customer_email
        else "Customer"
    )
    tier_val = ticket.customer.tier if ticket.customer else "standard"
    is_ver = bool(ticket.customer and ticket.customer.is_active)

    return {
        "id": ticket.id,
        "customer": {
            "email": email_val,
            "name": name_val,
            "tier": tier_val,
            "is_verified": is_ver
        },
        "raw_message": ticket.raw_message,
        "category": ticket.category or "General",
        "intent": ticket.intent or "Inquiry",
        "priority": ticket.priority or "Medium",
        "sentiment": ticket.sentiment or "Neutral",
        "status": ticket.resolution_status,
        "churn_risk_score": ticket.churn_risk_score or 20,
        "processing_time_ms": ticket.processing_time_ms,
        "recommended_action": ticket.recommended_action,
        "draft_response": ticket.draft_response,
        "ai_findings": ticket.ai_findings,
        "tools_executed": tools_parsed,
        "escalation_reason": ticket.escalation_reason,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None
    }


class TicketStatusUpdate(BaseModel):
    status: str


ALLOWED_STATUSES = {"open", "processing", "resolved", "escalated"}


@app.patch("/api/tickets/{ticket_id}")
def update_ticket_status(
    ticket_id: int,
    body: TicketStatusUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin_auth)
):
    """Update ticket resolution status (Admin Only)."""
    clean_status = body.status.strip().lower()
    if clean_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(ALLOWED_STATUSES))}"
        )

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.resolution_status = clean_status
    if clean_status == "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
    else:
        ticket.resolved_at = None

    db.commit()
    return {"message": "Status updated", "ticket_id": ticket.id, "status": ticket.resolution_status}


@app.get("/api/kb")
def get_kb_documents(_: bool = Depends(require_admin_auth)):
    """List indexed Knowledge Base documents (Admin Only)."""
    docs = list_kb_documents()
    return {"total": len(docs), "documents": docs}


@app.post("/api/kb", status_code=201)
def create_kb_document(
    body: KBDocumentRequest,
    _: bool = Depends(require_admin_auth)
):
    """Add a new Knowledge Base document to runtime RAG store and Qdrant if online (Admin Only)."""
    created = add_kb_document(
        title=body.title,
        category=body.category,
        text=body.text,
        source="admin-console",
    )
    return created
