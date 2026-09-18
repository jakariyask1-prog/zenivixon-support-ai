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
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
