from fastapi import FastAPI, Depends, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone, timedelta
from typing import Optional
import json
import os
import pathlib

from db.database import engine, Base, get_db
from db.models import Customer, Ticket
from agents.graph import zenivixon_agent

app = FastAPI(title="ZENIVIXON Support API")

# Configurable CORS
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin Passcode / Security Dependency
ADMIN_PASSCODES = set(
    p.strip().lower() 
    for p in os.getenv(
        "ADMIN_PASSCODES", 
        "zenivixon admin pannel,zenivixon admin panel,zenivixon,zenivixon2026"
    ).split(",")
    if p.strip()
)

def require_admin_auth(x_admin_passcode: Optional[str] = Header(None, alias="X-Admin-Passcode")):
    """Validate administrative team passcode from header."""
    if not x_admin_passcode or x_admin_passcode.strip().lower() not in ADMIN_PASSCODES:
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized: Valid Team Console passcode required in X-Admin-Passcode header."
        )
    return True

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
        "version": "1.0.0",
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

Base.metadata.create_all(bind=engine)

class TicketRequest(BaseModel):

    email: str
    message: str

@app.post("/api/tickets")
def submit_ticket(req: TicketRequest, db: Session = Depends(get_db)):
    clean_email = req.email.strip().lower()
    
    # 1. Create or retrieve customer in DB (case-insensitive & trimmed)
    customer = db.query(Customer).filter(func.lower(Customer.email) == clean_email).first()
    if not customer:
        name_part = clean_email.split("@")[0].replace(".", " ").title() if "@" in clean_email else "Customer"
        customer = Customer(
            email=clean_email,
            name=name_part,
            company="General",
            tier="standard",
            is_active=True
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    ticket = Ticket(
        customer_id=customer.id,
        customer_email=clean_email,
        raw_message=req.message,
        resolution_status="processing"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    
    # 2. Prepare LangGraph State
    initial_state = {
        "ticket_id": ticket.id,
        "customer_email": clean_email,
        "raw_message": req.message,
        "is_verified": True,
        "customer_tier": customer.tier or "standard",
        "agent_trace": []
    }
    
    # 3. Execute LangGraph
    try:
        final_state = zenivixon_agent.invoke(initial_state)
    except Exception as e:
        print(f"Agent execution failed: {e}")
        final_state = initial_state.copy()
        final_state["resolution_status"] = "escalated"
        final_state["escalation_reason"] = f"System Error: Autonomous processing failed."
        final_state["agent_trace"].append(f"System Error: {str(e)}")
    
    # 4. Save results to DB
    ticket.category = final_state.get("category")
    ticket.intent = final_state.get("intent")
    ticket.priority = final_state.get("priority")
    ticket.sentiment = final_state.get("sentiment")
    ticket.resolution_status = final_state.get("resolution_status", "open")
    ticket.draft_response = final_state.get("draft_response")
    ticket.ai_findings = final_state.get("ai_findings")
    ticket.tools_executed = json.dumps(final_state.get("tool_outputs", []))
    ticket.escalation_reason = final_state.get("escalation_reason")
    ticket.recommended_action = final_state.get("recommended_action")
    ticket.churn_risk_score = final_state.get("churn_risk_score", 20)
    if ticket.resolution_status == "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
        
    db.commit()
    
    return {
        "ticket_id": ticket.id,
        "customer_email": clean_email,
        "customer_name": customer.name,
        "customer_tier": customer.tier,
        "status": ticket.resolution_status,
        "trace": final_state.get("agent_trace"),
        "category": final_state.get("category"),
        "intent": final_state.get("intent"),
        "priority": final_state.get("priority"),
        "sentiment": final_state.get("sentiment"),
        "ai_findings": final_state.get("ai_findings"),
        "escalation_reason": final_state.get("escalation_reason"),
        "recommended_action": final_state.get("recommended_action"),
        "churn_risk_score": final_state.get("churn_risk_score", 20),
        "draft_response": final_state.get("draft_response"),
        "tools_executed": final_state.get("tool_outputs", []),
        "is_verified": final_state.get("is_verified", True)
    }

@app.get("/api/dashboard/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin_auth)
):
    """Aggregated telemetry & KPI metrics for Team Console (Admin Only)."""
    # 1. High-speed SQL count aggregations instead of in-memory load
    total = db.query(func.count(Ticket.id)).scalar() or 0
    
    status_rows = db.query(Ticket.resolution_status, func.count(Ticket.id)).group_by(Ticket.resolution_status).all()
    status_map = dict(status_rows)
    resolved = status_map.get("resolved", 0)
    escalated = status_map.get("escalated", 0)
    pending = status_map.get("open", 0) + status_map.get("processing", 0)
    
    # 2. Category breakdown via SQL GROUP BY
    cat_rows = db.query(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category).all()
    cat_map = dict(cat_rows)
    categories = ["Order", "Billing", "Technical", "Account", "Subscription", "General"]
    cat_counts = {cat: cat_map.get(cat, 0) for cat in categories}
    
    # 3. Priority breakdown via SQL GROUP BY
    prio_rows = db.query(Ticket.priority, func.count(Ticket.id)).group_by(Ticket.priority).all()
    prio_map = dict(prio_rows)
    priorities = ["Critical", "High", "Medium", "Low"]
    prio_counts = {p: prio_map.get(p, 0) for p in priorities}
    
    # 4. Average Churn Risk via SQL AVG
    avg_churn_score = db.query(func.avg(Ticket.churn_risk_score)).filter(Ticket.churn_risk_score.isnot(None)).scalar()
    avg_churn = round(float(avg_churn_score), 1) if avg_churn_score is not None else 22.5
    
    # 5. 7-day trend bounded by timestamp filter
    now = datetime.now(timezone.utc)
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
        "Tickets Today": total,
        "AI Resolved": resolved,
        "Human Escalated": escalated,
        "Pending": pending,
        "Resolution Rate": f"{round((resolved / total * 100), 1)}%" if total > 0 else "0.0%",
        "Escalation Rate": f"{round((escalated / total * 100), 1)}%" if total > 0 else "0.0%",
        "Average Churn Risk": f"{avg_churn}%",
        "category_breakdown": cat_counts,
        "priority_breakdown": prio_counts,
        "daily_trend": daily_stats
    }

@app.get("/api/portal/track")
def portal_track_ticket(
    ticket_id: int = Query(..., description="Numeric Ticket ID"),
    email: str = Query(..., description="Customer Email address"),
    db: Session = Depends(get_db)
):
    """Secure, privacy-protected ticket tracking for Customer Portal verifying Ticket ID and Email."""
    clean_email = email.strip().lower()
    ticket = db.query(Ticket).options(joinedload(Ticket.customer)).join(Customer).filter(
        Ticket.id == ticket_id,
        Customer.email == clean_email
    ).first()
    
    if not ticket:
        raise HTTPException(
            status_code=404, 
            detail=f"Ticket #{ticket_id} was not found for email '{email}'. Please check your Ticket ID and Email."
        )
        
    return {
        "id": ticket.id,
        "customer": {
            "email": ticket.customer.email if ticket.customer else clean_email,
            "name": ticket.customer.name if ticket.customer else "Customer",
            "tier": ticket.customer.tier if ticket.customer else "standard",
            "is_verified": bool(ticket.customer)
        },
        "raw_message": ticket.raw_message,
        "category": ticket.category or "General",
        "intent": ticket.intent or "Inquiry",
        "priority": ticket.priority or "Medium",
        "sentiment": ticket.sentiment or "Neutral",
        "status": ticket.resolution_status,
        "draft_response": ticket.draft_response,
        "ai_findings": ticket.ai_findings,
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
        except:
            tools_parsed = []
            
    email_val = ticket.customer.email if ticket.customer else (ticket.customer_email or "Guest")
    name_val = ticket.customer.name if ticket.customer else (ticket.customer_email.split("@")[0].title() if ticket.customer_email and "@" in ticket.customer_email else "Customer")
    tier_val = ticket.customer.tier if ticket.customer else "standard"
    is_ver = bool(ticket.customer or ticket.customer_email)

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

@app.patch("/api/tickets/{ticket_id}")
def update_ticket_status(
    ticket_id: int, 
    body: TicketStatusUpdate, 
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin_auth)
):
    """Update ticket resolution status (Admin Only)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.resolution_status = body.status
    if body.status == "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Status updated", "ticket_id": ticket.id, "status": ticket.resolution_status}

