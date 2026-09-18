from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json

from db.database import engine, Base, get_db
from db.models import Customer, Ticket
from agents.graph import zenivixon_agent

app = FastAPI(title="ZENIVIXON Support API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/health")
def health_check():
    """Healthcheck endpoint for Render and external uptime monitoring."""
    return {
        "status": "online",
        "service": "ZENIVIXON Support AI",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

Base.metadata.create_all(bind=engine)

class TicketRequest(BaseModel):

    email: str
    message: str

@app.post("/api/tickets")
def submit_ticket(req: TicketRequest, db: Session = Depends(get_db)):
    # 1. Create raw ticket in DB
    customer = db.query(Customer).filter(Customer.email == req.email).first()
    ticket = Ticket(
        customer_id=customer.id if customer else None,
        raw_message=req.message,
        resolution_status="processing"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    
    # 2. Prepare LangGraph State
    initial_state = {
        "ticket_id": ticket.id,
        "customer_email": req.email,
        "raw_message": req.message,
        "is_verified": False,
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
    if ticket.resolution_status == "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
        
    db.commit()
    
    return {
        "ticket_id": ticket.id,
        "status": ticket.resolution_status,
        "trace": final_state.get("agent_trace"),
        "category": final_state.get("category"),
        "intent": final_state.get("intent"),
        "priority": final_state.get("priority"),
        "sentiment": final_state.get("sentiment"),
        "ai_findings": final_state.get("ai_findings"),
        "escalation_reason": final_state.get("escalation_reason"),
        "draft_response": final_state.get("draft_response"),
        "tools_executed": final_state.get("tool_outputs", []),
        "is_verified": final_state.get("is_verified", False)
    }

@app.get("/api/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    total = db.query(Ticket).count()
    resolved = db.query(Ticket).filter(Ticket.resolution_status == "resolved").count()
    escalated = db.query(Ticket).filter(Ticket.resolution_status == "escalated").count()
    pending = db.query(Ticket).filter(Ticket.resolution_status.in_(["open", "processing"])).count()
    
    return {
        "Tickets Today": total,
        "AI Resolved": resolved,
        "Human Escalated": escalated,
        "Pending": pending,
        "Resolution Rate": f"{round((resolved/total)*100, 1)}%" if total else "0%",
        "Escalation Rate": f"{round((escalated/total)*100, 1)}%" if total else "0%"
    }

@app.get("/api/tickets")
def list_tickets(
    status: str = Query(None, description="Filter by status: open, resolved, escalated"),
    category: str = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List support tickets with customer info and status."""
    query = db.query(Ticket).order_by(Ticket.created_at.desc())
    if status:
        query = query.filter(Ticket.resolution_status == status)
    if category:
        query = query.filter(Ticket.category == category)
        
    total = query.count()
    tickets = query.offset(offset).limit(limit).all()
    
    items = []
    for t in tickets:
        customer_email = t.customer.email if t.customer else "Guest"
        customer_tier = t.customer.tier if t.customer else "none"
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
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
            "escalation_reason": t.escalation_reason
        })
        
    return {"total": total, "tickets": items}

@app.get("/api/tickets/{ticket_id}")
def get_ticket_detail(ticket_id: int, db: Session = Depends(get_db)):
    """Retrieve full detail and agent trace for a single ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    tools_parsed = []
    if ticket.tools_executed:
        try:
            tools_parsed = json.loads(ticket.tools_executed)
        except:
            tools_parsed = []
            
    return {
        "id": ticket.id,
        "customer": {
            "email": ticket.customer.email if ticket.customer else "Guest",
            "name": ticket.customer.name if ticket.customer else "Guest",
            "tier": ticket.customer.tier if ticket.customer else "none",
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
        "tools_executed": tools_parsed,
        "escalation_reason": ticket.escalation_reason,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None
    }

class TicketStatusUpdate(BaseModel):
    status: str

@app.patch("/api/tickets/{ticket_id}")
def update_ticket_status(ticket_id: int, body: TicketStatusUpdate, db: Session = Depends(get_db)):
    """Update ticket resolution status."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.resolution_status = body.status
    if body.status == "resolved":
        ticket.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Status updated", "ticket_id": ticket.id, "status": ticket.resolution_status}

