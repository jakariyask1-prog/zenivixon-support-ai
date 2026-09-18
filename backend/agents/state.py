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
    is_verified: bool
    
    # Tools/RAG Context
    rag_docs: Sequence[str]
    tool_outputs: Sequence[dict]
    
    # Resolution/Escalation
    draft_response: Optional[str]
    ai_findings: Optional[str]
    is_safe: bool
    resolution_status: str # 'open', 'resolved', 'escalated'
    escalation_reason: Optional[str]
    
    # Telemetry/Trace
    agent_trace: Annotated[Sequence[str], operator.add]
