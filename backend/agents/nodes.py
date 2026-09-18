import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from agents.state import TicketState
from core.tools import get_customer, get_order, get_invoice, get_subscription
from core.zendesk import escalate_to_human
from core.qdrant_store import search_kb

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

def intake_node(state: TicketState) -> dict:
    """Analyze intent, urgency, and sentiment."""
    prompt = f"""
    Analyze the following support ticket.
    Ticket: "{state['raw_message']}"
    
    Output JSON exactly with keys:
    category: (Billing, Account, Technical, Order, Subscription, Refund, Security, General)
    intent: (Brief 3-5 word summary)
    priority: (Low, Medium, High, Critical)
    sentiment: (Positive, Neutral, Frustrated, Angry)
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    # Simplified parsing for demo
    try:
        content = response.content.strip().replace("```json", "").replace("```", "")
        data = json.loads(content)
    except:
        data = {"category": "General", "intent": "Unknown", "priority": "Medium", "sentiment": "Neutral"}
        
    return {**data, "agent_trace": [f"Intake complete: {data['priority']} priority, {data['category']} category."]}

def verify_node(state: TicketState) -> dict:
    """Verify customer identity via DB."""
    customer = get_customer(state['customer_email'])
    if customer:
        return {
            "customer_id": customer["id"], 
            "is_verified": True,
            "agent_trace": [f"Customer verified: ID {customer['id']}, Tier {customer['tier']}."]
        }
    return {
        "customer_id": None, 
        "is_verified": False,
        "agent_trace": ["Customer verification failed. Email not found."]
    }

def tool_execution_node(state: TicketState) -> dict:
    """Retrieve KB docs and relevant system data."""
    docs = search_kb(state['raw_message'])
    doc_texts = [d['text'] for d in docs]
    
    tools_used = []
    if state['customer_id']:
        if state['category'] == 'Order':
            # Mock getting recent order
            tools_used.append({"tool": "get_order", "data": "Order ORD-1001 Shipped"})
        elif state['category'] == 'Billing':
            tools_used.append({"tool": "get_invoice", "data": "Invoice INV-9901 Paid"})
            
    return {
        "rag_docs": doc_texts,
        "tool_outputs": tools_used,
        "agent_trace": [f"Tools executed: {len(tools_used)} tools, {len(doc_texts)} KB docs retrieved."]
    }

def resolution_engine_node(state: TicketState) -> dict:
    """Draft a response based on tools and RAG."""
    context = "\\n".join(state.get('rag_docs', []))
    tools_data = json.dumps(state.get('tool_outputs', []))
    
    prompt = f"""
    You are ZENIVIXON Autonomous Support.
    Ticket: "{state['raw_message']}"
    KB Context: {context}
    System Data: {tools_data}
    
    Draft a helpful response. If you don't have enough info, say "I cannot resolve this."
    """
    
    response = llm.invoke([HumanMessage(content=prompt)])
    draft = response.content
    findings = "Analyzed KB and system data to draft response."
    
    return {
        "draft_response": draft,
        "ai_findings": findings,
        "agent_trace": ["AI Resolution Engine drafted a response."]
    }

def safety_gate_node(state: TicketState) -> dict:
    """Deterministic policy gate. Rules = Authority."""
    is_safe = True
    reason = None
    
    if state['priority'] == 'Critical':
        is_safe = False
        reason = "Deterministic Rule: Critical priority tickets cannot be auto-resolved."
    elif state['sentiment'] == 'Angry':
        is_safe = False
        reason = "Deterministic Rule: Angry sentiment requires human empathy."
    elif not state['is_verified'] and state['category'] in ['Billing', 'Account', 'Security']:
        is_safe = False
        reason = "Deterministic Rule: Unverified user asking for sensitive category."
    elif "I cannot resolve this" in state.get('draft_response', ''):
        is_safe = False
        reason = "AI Rule: Insufficient context to resolve."
        
    return {
        "is_safe": is_safe,
        "escalation_reason": reason,
        "agent_trace": [f"Safety Gate evaluated: Safe={is_safe}. Reason={reason}"]
    }

def escalation_node(state: TicketState) -> dict:
    """Handoff package to Zendesk."""
    summary = f"""
    Intent: {state['intent']}
    Priority: {state['priority']}
    Verified: {state['is_verified']}
    Findings: {state['ai_findings']}
    Escalation Reason: {state['escalation_reason']}
    """
    # Escalate ticket in Zendesk
    escalate_to_human(state['ticket_id'], summary)
    
    return {
        "resolution_status": "escalated",
        "agent_trace": ["Ticket escalated to human agent via Zendesk."]
    }
