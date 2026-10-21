from langgraph.graph import StateGraph, END, START
from agents.state import TicketState
from agents.nodes import (
    intake_node, 
    verify_node, 
    tool_execution_node, 
    resolution_engine_node, 
    safety_gate_node, 
    escalation_node
)

def check_fast_escalation(state: TicketState) -> str:
    """Fast-track critical or angry tickets directly to escalation, saving latency and quota."""
    if state.get("priority") == "Critical":
        return "escalate"
    if state.get("sentiment") == "Angry":
        return "escalate"
    return "proceed"

def route_after_gate(state: TicketState) -> str:
    if state.get("is_safe", False):
        return "resolve"
    return "escalate"

def build_graph():
    workflow = StateGraph(TicketState)
    
    workflow.add_node("intake", intake_node)
    workflow.add_node("verify", verify_node)
    workflow.add_node("tools", tool_execution_node)
    workflow.add_node("resolution", resolution_engine_node)
    workflow.add_node("safety", safety_gate_node)
    workflow.add_node("escalation", escalation_node)
    
    # Direct resolve end state
    workflow.add_node("resolve", lambda x: {"resolution_status": "resolved", "agent_trace": ["Ticket automatically resolved."]})
    
    workflow.add_edge(START, "intake")
    workflow.add_edge("intake", "verify")
    workflow.add_edge("verify", "tools")
    
    # Conditional edge after tools: bypass LLM resolution draft if already Critical / Angry,
    # but ensure customer order & invoice tools HAVE EXECUTED for Zendesk handoff!
    workflow.add_conditional_edges("tools", check_fast_escalation, {
        "proceed": "resolution",
        "escalate": "escalation"
    })
    
    workflow.add_edge("tools", "resolution")
    workflow.add_edge("resolution", "safety")
    
    workflow.add_conditional_edges("safety", route_after_gate, {
        "resolve": "resolve",
        "escalate": "escalation"
    })
    
    workflow.add_edge("resolve", END)
    workflow.add_edge("escalation", END)
    
    return workflow.compile()

zenivixon_agent = build_graph()
