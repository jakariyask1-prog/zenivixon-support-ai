import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from agents.state import TicketState
from core.tools import (
    get_customer, 
    get_order, 
    get_invoice, 
    get_subscription, 
    get_latest_customer_order, 
    get_latest_customer_invoice
)
from core.zendesk import escalate_to_human
from core.qdrant_store import search_kb

llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash", temperature=0, max_retries=0)

def _heuristic_classify(message: str) -> dict:
    """Fallback rule-based classifier when LLM is unavailable or rate-limited."""
    msg_lower = message.lower()
    
    # Priority
    if any(w in msg_lower for w in ["cancel", "cancelling", "emergency", "lawyer"]):
        priority = "Critical"
    elif any(w in msg_lower for w in ["unacceptable", "urgent", "broken", "immediately", "died", "failed"]):
        priority = "High"
    elif any(w in msg_lower for w in ["help", "question", "pricing", "cost", "how to", "services"]):
        priority = "Low"
    else:
        priority = "Medium"
    
    # Category
    if any(w in msg_lower for w in ["invoice", "charge", "refund", "card", "billing", "payment"]):
        category = "Billing"
    elif any(w in msg_lower for w in ["order", "shipped", "shipping", "delivery", "track"]):
        category = "Order"
    elif any(w in msg_lower for w in ["password", "login", "auth", "account", "2fa"]):
        category = "Account"
    elif any(w in msg_lower for w in ["error", "bug", "crash", "sync", "failed", "died", "down", "api"]):
        category = "Technical"
    elif any(w in msg_lower for w in ["plan", "subscription", "upgrade"]):
        category = "Subscription"
    else:
        category = "General"
        
    # Sentiment
    if any(w in msg_lower for w in ["unacceptable", "angry", "terrible", "worst", "cancelling", "hate"]):
        sentiment = "Angry"
    elif any(w in msg_lower for w in ["frustrated", "delay", "slow", "problem", "broken", "died"]):
        sentiment = "Frustrated"
    elif any(w in msg_lower for w in ["thanks", "thank", "great", "love"]):
        sentiment = "Positive"
    else:
        sentiment = "Neutral"
        
    words = message.split()[:5]
    intent = " ".join(words) if words else "Customer Support Inquiry"
    
    return {
        "category": category,
        "intent": intent,
        "priority": priority,
        "sentiment": sentiment
    }

def intake_node(state: TicketState) -> dict:
    """Analyze intent, urgency, and sentiment with automatic fallback."""
    prompt = f"""Analyze this support ticket and respond with ONLY a valid JSON object, no other text.

Ticket: "{state['raw_message']}"

Respond with exactly this JSON structure:
{{
  "category": "<one of: Billing, Account, Technical, Order, Subscription, Refund, Security, General>",
  "intent": "<3-5 word summary>",
  "priority": "<one of: Low, Medium, High, Critical>",
  "sentiment": "<one of: Positive, Neutral, Frustrated, Angry>"
}}"""
    
    used_fallback = False
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        raw_content = response.content

        # Handle list-of-dicts response format (newer Gemini API style)
        if isinstance(raw_content, list):
            raw_content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in raw_content
            )
        else:
            raw_content = str(raw_content)

        # Strip markdown code fences and whitespace
        cleaned = raw_content.strip()
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        # Attempt to extract JSON object using regex (handles extra surrounding text)
        import re
        match = re.search(r'\{.*?\}', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)

        data = json.loads(cleaned)

        # Validate required keys exist
        for key in ("category", "intent", "priority", "sentiment"):
            if key not in data:
                raise ValueError(f"Missing key: {key}")

    except Exception as e:
        print(f"[Intake] LLM parse failed ({e}), using rule fallback.")
        used_fallback = True
        data = _heuristic_classify(state['raw_message'])
        
    trace_msg = (
        f"Intake complete (LLM): {data['priority']} priority, {data['category']} category."
        if not used_fallback else
        f"Intake complete (Rule Fallback): {data['priority']} priority, {data['category']} category."
    )
    return {**data, "agent_trace": [trace_msg]}

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
    """Retrieve KB docs and relevant dynamic system data."""
    docs = search_kb(state['raw_message'])
    doc_texts = [d['text'] for d in docs]
    
    tools_used = []
    if state.get('customer_id'):
        cust_id = state['customer_id']
        category = state.get('category', '')
        msg_lower = state.get('raw_message', '').lower()
        
        # Check orders
        if category == 'Order' or any(k in msg_lower for k in ['order', 'ship', 'track']):
            order = get_latest_customer_order(cust_id)
            if order:
                desc = f"Order {order['order_id']} is {order['status']} (Total: ${order['total_amount']})"
                tools_used.append({
                    "name": "get_latest_customer_order",
                    "result": desc,
                    "tool": "get_latest_customer_order",
                    "data": desc
                })
        
        # Check invoices & subscriptions
        if category in ['Billing', 'Subscription', 'Refund'] or any(k in msg_lower for k in ['invoice', 'bill', 'charge', 'sub']):
            invoice = get_latest_customer_invoice(cust_id)
            if invoice:
                desc = f"Invoice {invoice['invoice_id']} is {invoice['status']} (Amount: ${invoice['amount']})"
                tools_used.append({
                    "name": "get_latest_customer_invoice",
                    "result": desc,
                    "tool": "get_latest_customer_invoice",
                    "data": desc
                })
            sub = get_subscription(cust_id)
            if sub:
                desc = f"Subscription: {sub['plan_name']} ({sub['status']}, ${sub['monthly_rate']}/mo)"
                tools_used.append({
                    "name": "get_subscription",
                    "result": desc,
                    "tool": "get_subscription",
                    "data": desc
                })
            
    return {
        "rag_docs": doc_texts,
        "tool_outputs": tools_used,
        "agent_trace": [f"Tools executed: {len(tools_used)} system data queries, {len(doc_texts)} KB docs retrieved."]
    }

def resolution_engine_node(state: TicketState) -> dict:
    """Draft a response based on tools and RAG with fallback support."""
    context = "\n".join(state.get('rag_docs', []))
    tools_data = json.dumps(state.get('tool_outputs', []))
    
    prompt = f"""
    You are ZENIVIXON Autonomous Support.
    Ticket: "{state['raw_message']}"
    KB Context: {context}
    System Data: {tools_data}
    
    Draft a helpful response. If you don't have enough info, say "I cannot resolve this."
    """
    
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        raw_draft = response.content
        if isinstance(raw_draft, list):
            draft = " ".join([i.get("text", "") for i in raw_draft if isinstance(i, dict) and "text" in i])
        else:
            draft = str(raw_draft)
        findings = "Analyzed KB context and internal system records to formulate solution."
        trace_msg = "AI Resolution Engine drafted response using Gemini."
    except Exception as e:
        # Graceful fallback when LLM is unavailable
        rag_docs = state.get('rag_docs', [])
        tool_outputs = state.get('tool_outputs', [])
        if rag_docs:
            draft = f"Thank you for contacting ZENIVIXON Support.\n\nAccording to our documentation:\n{rag_docs[0]}\n\nPlease let us know if you need additional assistance."
            findings = "Retrieved grounded documentation from Qdrant knowledge base."
        elif tool_outputs:
            tool_summary = "; ".join([t.get('result', '') for t in tool_outputs])
            draft = f"Thank you for reaching out. We retrieved your latest account status: {tool_summary}. An agent will follow up shortly."
            findings = "Queried internal customer records."
        else:
            draft = "I cannot resolve this automatically. A support specialist has been notified."
            findings = "Autonomous resolution deferred: insufficient context or model quota reached."
        trace_msg = "AI Resolution Engine drafted response using grounded fallback."
    
    return {
        "draft_response": draft,
        "ai_findings": findings,
        "agent_trace": [trace_msg]
    }

def safety_gate_node(state: TicketState) -> dict:
    """Deterministic policy gate. Rules = Authority."""
    is_safe = True
    reason = None
    
    if state.get('priority') == 'Critical':
        is_safe = False
        reason = "Deterministic Rule: Critical priority tickets cannot be auto-resolved."
    elif state.get('sentiment') == 'Angry':
        is_safe = False
        reason = "Deterministic Rule: Angry sentiment requires human empathy."
    elif not state.get('is_verified', False) and state.get('category') in ['Billing', 'Account', 'Security']:
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
    Intent: {state.get('intent', 'Unknown')}
    Priority: {state.get('priority', 'Unknown')}
    Verified: {state.get('is_verified', False)}
    Findings: {state.get('ai_findings', 'N/A')}
    Escalation Reason: {state.get('escalation_reason', 'N/A')}
    """
    # Escalate ticket in Zendesk
    escalate_to_human(state['ticket_id'], summary)
    
    return {
        "resolution_status": "escalated",
        "agent_trace": ["Ticket escalated to human agent via Zendesk."]
    }
