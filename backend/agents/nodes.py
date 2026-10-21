import os
import re
import json
import pathlib
from dotenv import load_dotenv

env_file = pathlib.Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
load_dotenv()

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

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_KEY
    os.environ["GOOGLE_API_KEY"] = GEMINI_KEY

llm = None
if GEMINI_KEY:
    try:
        llm = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL, 
            api_key=GEMINI_KEY,
            temperature=0, 
            timeout=10.0,
            max_retries=0
        )
    except Exception as err:
        print(f"[LLM Init Warning] Could not initialize ChatGoogleGenerativeAI: {err}")
        llm = None

def _heuristic_classify(message: str) -> dict:
    """Fallback rule-based classifier when LLM is unavailable or rate-limited, with multilingual support (Bengali & English)."""
    msg_lower = message.lower()
    
    # Priority
    if any(w in msg_lower for w in ["cancel", "cancelling", "emergency", "lawyer", "জরুরি", "তাড়াতাড়ি", "ক্ষতি", "বন্ধ"]):
        priority = "Critical"
    elif any(w in msg_lower for w in ["unacceptable", "urgent", "broken", "immediately", "died", "failed", "সমস্যা", "দেরি"]):
        priority = "High"
    elif any(w in msg_lower for w in ["help", "question", "pricing", "cost", "how to", "services", "জানতে", "কি", "তথ্য"]):
        priority = "Low"
    else:
        priority = "Medium"
    
    # Category
    if any(w in msg_lower for w in ["invoice", "charge", "refund", "card", "billing", "payment", "বিল", "ইনভয়েস", "টাকা", "রিফান্ড"]):
        category = "Billing"
    elif any(w in msg_lower for w in ["order", "shipped", "shipping", "delivery", "track", "ord-", "অর্ডার", "ডেলিভারি", "পার্সেল"]):
        category = "Order"
    elif any(w in msg_lower for w in ["password", "login", "auth", "account", "2fa", "পাসওয়ার্ড", "লগইন", "একাউন্ট"]):
        category = "Account"
    elif any(w in msg_lower for w in ["error", "bug", "crash", "sync", "failed", "died", "down", "api", "সার্ভিস", "ইরর"]):
        category = "Technical"
    elif any(w in msg_lower for w in ["plan", "subscription", "upgrade", "প্ল্যান"]):
        category = "Subscription"
    else:
        category = "General"
        
    # Sentiment
    if any(w in msg_lower for w in ["unacceptable", "angry", "terrible", "worst", "cancelling", "hate", "ফালতু", "বাজে", "জঘন্য", "রাগান্বিত"]):
        sentiment = "Angry"
    elif any(w in msg_lower for w in ["frustrated", "delay", "slow", "problem", "broken", "died", "সমস্যা", "দেরি", "বিরক্ত"]):
        sentiment = "Frustrated"
    elif any(w in msg_lower for w in ["thanks", "thank", "great", "love", "ধন্যবাদ", "ভালো"]):
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
        if not llm:
            raise ValueError("LLM is not initialized (missing API key or client)")
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

        # Attempt to extract JSON object using greedy regex (handles nested structures & extra text)
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
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
    email = (state.get('customer_email') or '').strip()
    customer = get_customer(email)
    if customer:
        return {
            "customer_id": customer["id"], 
            "customer_tier": customer.get("tier", "standard"),
            "is_verified": True,
            "agent_trace": [f"Customer verified: ID {customer['id']}, Tier {customer.get('tier', 'standard')} ({customer.get('name', 'Customer')})."]
        }
    is_valid_email = bool(email and "@" in email)
    return {
        "customer_id": None, 
        "customer_tier": "standard",
        "is_verified": is_valid_email,
        "agent_trace": [f"Customer email recorded: {email}."]
    }

def tool_execution_node(state: TicketState) -> dict:
    """Retrieve KB docs and relevant dynamic system data (Orders, Invoices, Subscriptions)."""
    raw_msg = state.get('raw_message', '')
    msg_lower = raw_msg.lower()
    category = state.get('category', '')
    cust_id = state.get('customer_id')
    
    # 1. Search Knowledge Base
    docs = search_kb(raw_msg)
    doc_texts = [d['text'] for d in docs]
    
    tools_used = []
    
    # 2. Extract Specific Order IDs (e.g. ORD-1001)
    order_id_matches = re.findall(r'(?:ORD|ord)-\d+', raw_msg, re.IGNORECASE)
    matched_orders = set([m.upper() for m in order_id_matches])
    
    for oid in matched_orders:
        order_info = get_order(oid)
        if order_info:
            desc = f"Order {oid}: Status={order_info['status']}, Total=${order_info['total_amount']}, Placed={order_info['created_at'][:10]}"
            tools_used.append({
                "name": "get_order",
                "result": desc,
                "tool": "get_order",
                "data": desc
            })
            
    # If no specific order ID matched, check customer's latest order if inquiry is about orders
    is_order_query = category == 'Order' or any(k in msg_lower for k in ['order', 'ship', 'track', 'অর্ডার', 'ডেলিভারি', 'পার্সেল'])
    if not matched_orders and is_order_query and cust_id:
        latest_order = get_latest_customer_order(cust_id)
        if latest_order:
            desc = f"Latest Order {latest_order['order_id']}: Status={latest_order['status']}, Total=${latest_order['total_amount']}"
            tools_used.append({
                "name": "get_latest_customer_order",
                "result": desc,
                "tool": "get_latest_customer_order",
                "data": desc
            })

    # 3. Extract Specific Invoice IDs (e.g. INV-9901)
    invoice_id_matches = re.findall(r'(?:INV|inv)-\d+', raw_msg, re.IGNORECASE)
    matched_invoices = set([m.upper() for m in invoice_id_matches])
    
    for iid in matched_invoices:
        inv_info = get_invoice(iid)
        if inv_info:
            desc = f"Invoice {iid}: Status={inv_info['status']}, Amount=${inv_info['amount']}, Due={inv_info.get('due_date', 'N/A')}"
            tools_used.append({
                "name": "get_invoice",
                "result": desc,
                "tool": "get_invoice",
                "data": desc
            })
            
    # Check invoices & subscriptions for customer
    is_billing_query = category in ['Billing', 'Subscription', 'Refund'] or any(k in msg_lower for k in ['invoice', 'bill', 'charge', 'sub', 'ইনভয়েস', 'বিল', 'পেমেন্ট', 'টাকা', 'রিফান্ড'])
    if is_billing_query and cust_id:
        if not matched_invoices:
            latest_inv = get_latest_customer_invoice(cust_id)
            if latest_inv:
                desc = f"Latest Invoice {latest_inv['invoice_id']}: Status={latest_inv['status']}, Amount=${latest_inv['amount']}"
                tools_used.append({
                    "name": "get_latest_customer_invoice",
                    "result": desc,
                    "tool": "get_latest_customer_invoice",
                    "data": desc
                })
        sub = get_subscription(cust_id)
        if sub:
            desc = f"Subscription: {sub['plan_name']} (Status: {sub['status']}, ${sub['monthly_rate']}/mo)"
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
    """Draft a response based on tools and RAG with multilingual & fallback support."""
    context = "\n".join(state.get('rag_docs', []))
    tools_data = json.dumps(state.get('tool_outputs', []))
    
    prompt = f"""
You are ZENIVIXON Autonomous Support AI Assistant.
Default Language: English (Global).
Customer Inquiry: "{state['raw_message']}"
Knowledge Base Context:
{context}
Internal System Data / Live Records:
{tools_data}

Instructions:
1. Default to English for international inquiries. If the customer wrote in Bengali, reply warmly and politely in fluent Bengali. Otherwise, reply in professional English.
2. If live system data contains specific order or invoice records (e.g., status, order ID, amount), clearly communicate this status to the customer.
3. If Knowledge Base context provides the answer (e.g., company overview, services, policies), clearly explain ZENIVIXON's capabilities and guidance.
4. For custom enterprise engineering, bespoke integrations (e.g. enterprise RAG pipelines, custom software), or inquiries needing tailored architectural design, provide a helpful summary of ZENIVIXON's relevant capabilities and state: "I cannot resolve this automatically as custom architectural design requires review by our senior engineering team. I have escalated this ticket to our solutions team to follow up with you."
5. If the request is completely outside your knowledge base and no system data is available, respond with: "I cannot resolve this automatically. A support specialist has been notified."
"""
    
    try:
        if not llm:
            raise ValueError("LLM is not initialized (missing API key or client)")
        response = llm.invoke([HumanMessage(content=prompt)])
        raw_draft = response.content
        if isinstance(raw_draft, list):
            draft = " ".join([i.get("text", "") for i in raw_draft if isinstance(i, dict) and "text" in i])
        else:
            draft = str(raw_draft)
        findings = "Analyzed KB context and internal system records to formulate grounded response."
        trace_msg = "AI Resolution Engine drafted response using Gemini."
    except Exception as e:
        # Graceful fallback when LLM is unavailable
        rag_docs = state.get('rag_docs', [])
        tool_outputs = state.get('tool_outputs', [])
        is_bengali = any(ord(char) >= 0x0980 and ord(char) <= 0x09FF for char in state.get('raw_message', ''))
        
        if tool_outputs:
            tool_summary = "; ".join([t.get('result', '') for t in tool_outputs])
            if is_bengali:
                draft = f"আপনার অনুরোধের প্রেক্ষিতে আমাদের ডাটাবেজ থেকে পাওয়া তথ্য:\n{tool_summary}\n\nআপনার আর কোনো জিজ্ঞাসা থাকলে আমাদের জানান।"
            else:
                draft = f"Thank you for reaching out. We retrieved your latest account status:\n{tool_summary}\n\nPlease let us know if you need additional assistance."
            findings = "Queried internal customer records."
        elif rag_docs:
            if is_bengali:
                draft = f"ZENIVIXON সাপোর্টে যোগাযোগ করার জন্য ধন্যবাদ।\n\nআমাদের নলেজ বেস থেকে প্রাপ্ত তথ্য:\n{rag_docs[0]}"
            else:
                draft = f"Thank you for contacting ZENIVIXON Support.\n\nAccording to our documentation:\n{rag_docs[0]}\n\nPlease let us know if you need additional assistance."
            findings = "Retrieved grounded documentation from Qdrant knowledge base."
        else:
            draft = "I cannot resolve this automatically. A support specialist has been notified."
            findings = "Autonomous resolution deferred: insufficient context or model quota reached."
        trace_msg = "AI Resolution Engine drafted response using grounded fallback."
    
    return {
        "draft_response": draft,
        "ai_findings": findings,
        "agent_trace": [trace_msg]
    }

def calculate_churn_risk(state: TicketState) -> tuple[int, str]:
    """Calculate quantitative Churn Risk % and generate contextual retention advice."""
    tier = (state.get("customer_tier") or "standard").lower()
    priority = state.get("priority", "Medium")
    sentiment = state.get("sentiment", "Neutral")
    category = state.get("category", "General")
    
    score = 20
    if priority == "Critical":
        score += 40
    elif priority == "High":
        score += 20
        
    if sentiment == "Angry":
        score += 25
    elif sentiment == "Frustrated":
        score += 15
        
    if tier == "enterprise":
        score += 15
        
    if category in ["Billing", "Refund"]:
        score += 10
        
    score = min(max(score, 5), 98)
    
    # Language detection: Default to English, adapt to Bengali if message is in Bengali
    is_bengali = any(ord(char) >= 0x0980 and ord(char) <= 0x09FF for char in state.get('raw_message', ''))
    
    if is_bengali:
        if tier == "enterprise":
            recommendation = "এন্টারপ্রাইজ ক্লায়েন্ট (VIP Account): সর্বোচ্চ অগ্রাধিকার দিন, সিনিয়র সাপোর্ট লিড নিয়োগ করুন এবং ২০% SLA ক্রেডিট অফার করুন।"
        elif priority == "Critical" or sentiment == "Angry":
            recommendation = "উচ্চ ঝুঁকি (Critical Risk): সহানুভূতিশীল বার্তা দিন, ২ ঘণ্টার মধ্যে রেজল্যুশন নিশ্চিত করুন এবং রিটেনশন ক্রেডিট অফার করুন।"
        elif priority == "High" or sentiment == "Frustrated":
            recommendation = "মধ্যম ঝুঁকি (High Priority): দ্রুত টেকনিক্যাল টিমের সাথে যোগাযোগ করে ১ কার্যদিবসের মধ্যে সমাধান নিশ্চিত করুন।"
        else:
            recommendation = "স্ট্যান্ডার্ড সাপোর্ট: কাস্টমারকে যথাসময়ে প্রয়োজনীয় তথ্য দিয়ে সমাধান সমাপ্ত করুন।"
    else:
        # Default: Global English
        if tier == "enterprise":
            recommendation = "Enterprise VIP Account: Prioritize immediately, assign Lead Solutions Architect, and offer 20% SLA courtesy credit."
        elif priority == "Critical" or sentiment == "Angry":
            recommendation = "Critical Risk: Lead with active empathy, guarantee resolution within 2 hours, and offer retention goodwill credit."
        elif priority == "High" or sentiment == "Frustrated":
            recommendation = "High Priority: Expedite with Tier-2 engineering and deliver resolution within 1 business day."
        else:
            recommendation = "Standard Priority: Provide standard troubleshooting documentation and friendly confirmation."
        
    return score, recommendation

def safety_gate_node(state: TicketState) -> dict:
    """Deterministic policy gate. Rules = Authority."""
    is_safe = True
    reason = None
    
    churn_score, recommendation = calculate_churn_risk(state)
    
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
        "churn_risk_score": churn_score,
        "recommended_action": recommendation,
        "agent_trace": [f"Safety Gate evaluated: Safe={is_safe}. Reason={reason}"]
    }

def escalation_node(state: TicketState) -> dict:
    """Handoff package to Zendesk with Churn Risk prediction."""
    churn_score = state.get("churn_risk_score")
    rec_action = state.get("recommended_action")
    if not churn_score or not rec_action:
        churn_score, rec_action = calculate_churn_risk(state)

    esc_reason = state.get("escalation_reason")
    if not esc_reason:
        if state.get("priority") == "Critical":
            esc_reason = "Fast-track Escalation: Critical priority ticket routed directly to human response team."
        elif state.get("sentiment") == "Angry":
            esc_reason = "Fast-track Escalation: Negative/Angry sentiment detected requiring empathetic human care."
        else:
            esc_reason = "Policy Escalation: Autonomous resolution deferred for specialist human handling."

    findings = state.get('ai_findings')
    if not findings:
        tools = state.get('tool_outputs', [])
        if tools:
            findings = "Fast-track diagnostics: " + "; ".join([t.get('result', '') for t in tools])
        else:
            findings = "Fast-track escalation: direct routing to human agent."

    summary = f"""
    Intent: {state.get('intent', 'Unknown')}
    Priority: {state.get('priority', 'Unknown')}
    Sentiment: {state.get('sentiment', 'Unknown')}
    Verified: {state.get('is_verified', False)}
    Churn Risk: {churn_score}%
    Recommended Action: {rec_action}
    Findings: {findings}
    Escalation Reason: {esc_reason}
    """
    # Escalate ticket in Zendesk
    escalate_to_human(
        ticket_id=state['ticket_id'],
        handoff_summary=summary,
        customer_email=state.get('customer_email')
    )
    
    return {
        "resolution_status": "escalated",
        "escalation_reason": esc_reason,
        "ai_findings": findings,
        "churn_risk_score": churn_score,
        "recommended_action": rec_action,
        "agent_trace": [
            f"Ticket escalated to human agent via Zendesk. Reason: {esc_reason} (Churn Risk: {churn_score}%)."
        ]
    }
