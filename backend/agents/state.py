from typing import TypedDict, Annotated, Sequence, Any, Optional
import operator

class TicketState(TypedDict):
    ticket_id: int
    customer_email: str
    raw_message: str
    
    # Analysis
    category: Optional[str]
    intent: Optional[str]
    priority: Optional[str]
    sentiment: Optional[str]
    
    # Verification
    customer_id: Optional[int]
    customer_tier: Optional[str]
    is_verified: bool
    trusted_session: Optional[bool]
    
    # Tools/RAG Context
    rag_docs: Sequence[str]
    tool_outputs: Sequence[dict]
    
    # Resolution/Escalation
    draft_response: Optional[str]
    ai_findings: Optional[str]
    needs_human_review: Optional[bool]
    is_safe: bool
    resolution_status: str # 'open', 'resolved', 'escalated'
    escalation_reason: Optional[str]
    churn_risk_score: Optional[int]
    recommended_action: Optional[str]
    
    # Telemetry/Trace
    agent_trace: Annotated[Sequence[str], operator.add]
