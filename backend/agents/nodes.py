import os
import re
import json
import pathlib
from typing import Optional
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

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
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
            temperature=0.1, 
            timeout=15.0,
            max_retries=1
        )
    except Exception as err:
        print(f"[LLM Init Warning] Could not initialize ChatGoogleGenerativeAI: {err}")
        llm = None

_BN_BOUNDARY = r'[\s,.;:!?\'\"()\[\]{}\-/|—।]'
_BN_SUFFIXES = r'(?:ের|দের|গুলো|গুলি|টি|টা|কে|তে|য়|য়ে|ও)?'


def _contains_any(msg_lower: str, keywords: list[str]) -> bool:
    """Match keywords with strict word boundaries to prevent substring false positives in English & Bengali."""
    for kw in keywords:
        if not kw:
            continue
        is_bn = any(0x0980 <= ord(ch) <= 0x09FF for ch in kw)
        if is_bn:
            pattern = rf'(?:^|{_BN_BOUNDARY}){re.escape(kw)}{_BN_SUFFIXES}(?:$|{_BN_BOUNDARY})'
        elif kw.endswith("-"):
            pattern = rf'(?:^|\b){re.escape(kw)}'
        else:
            pattern = rf'\b{re.escape(kw)}\b'
        if re.search(pattern, msg_lower):
            return True
    return False


def _heuristic_classify(message: str) -> dict:
    """Fallback rule-based classifier when LLM is unavailable or rate-limited, with multilingual support (Bengali & English)."""
    msg_lower = message.lower()

    # Priority
    if _contains_any(msg_lower, [
        "cancel", "canceling", "cancelling", "emergency", "lawyer", "lawsuit", "breach", "hacked",
        "জরুরি", "তাড়াতাড়ি", "তাড়াতাড়ি", "ক্ষতি", "বন্ধ", "হ্যাক"
    ]):
        priority = "Critical"
    elif _contains_any(msg_lower, [
        "unacceptable", "urgent", "broken", "immediately", "died", "failed", "overdue", "delayed",
        "সমস্যা", "দেরি", "অবিলম্বে"
    ]):
        priority = "High"
    elif _contains_any(msg_lower, [
        "help", "question", "pricing", "cost", "how to", "services", "overview",
        "জানতে", "কি", "কী", "কীভাবে", "কিভাবে", "তথ্য", "দাম"
    ]):
        priority = "Low"
    else:
        priority = "Medium"

    # Category (with dedicated Refund and Security detection)
    if _contains_any(msg_lower, [
        "security", "breach", "hacked", "hack", "phishing", "unauthorized", "vulnerability",
        "সিকিউরিটি", "হ্যাক", "নিরাপত্তা"
    ]):
        category = "Security"
    elif _contains_any(msg_lower, [
        "invoice", "invoices", "charge", "charged", "card", "billing", "bill", "payment", "inv-",
        "বিল", "ইনভয়েস", "ইনভয়েস", "পেমেন্ট"
    ]):
        category = "Billing"
    elif _contains_any(msg_lower, [
        "refund", "refunds", "chargeback", "reimburse", "money back",
        "রিফান্ড", "টাকা ফেরত", "ফেরত চাই"
    ]):
        category = "Refund"
    elif _contains_any(msg_lower, ["টাকা"]):
        category = "Billing"
    elif _contains_any(msg_lower, [
        "order", "orders", "ship", "shipped", "shipping", "shipment", "delivery", "track", "tracking", "ord-",
        "অর্ডার", "ডেলিভারি", "পার্সেল"
    ]):
        category = "Order"
    elif _contains_any(msg_lower, [
        "password", "login", "signin", "auth", "account", "2fa",
        "পাসওয়ার্ড", "পাসওয়ার্ড", "লগইন", "একাউন্ট", "অ্যাকাউন্ট"
    ]):
        category = "Account"
    elif _contains_any(msg_lower, [
        "error", "errors", "bug", "bugs", "crash", "crashing", "sync", "failed", "died", "down", "api",
        "সার্ভিস", "ইরর", "ক্র্যাশ"
    ]):
        category = "Technical"
    elif _contains_any(msg_lower, [
        "plan", "plans", "subscription", "subscriptions", "upgrade", "downgrade",
        "প্ল্যান", "সাবস্ক্রিপশন"
    ]):
        category = "Subscription"
    else:
        category = "General"

    # Sentiment
    if _contains_any(msg_lower, [
        "unacceptable", "angry", "terrible", "worst", "canceling", "cancelling", "hate", "demand",
        "ফালতু", "বাজে", "জঘন্য", "রাগান্বিত"
    ]):
        sentiment = "Angry"
    elif _contains_any(msg_lower, [
        "frustrated", "delay", "delayed", "slow", "problem", "broken", "died", "crashing",
        "সমস্যা", "দেরি", "বিরক্ত"
    ]):
        sentiment = "Frustrated"
    elif _contains_any(msg_lower, [
        "thanks", "thank", "great", "love", "awesome",
        "ধন্যবাদ", "ভালো"
    ]):
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
    """Analyze intent, urgency, and sentiment with hybrid classification."""
    raw_msg = state.get('raw_message', '')

    # Fast-path check: If LLM is not initialized, immediately use heuristic
    if not llm:
        fast_data = _heuristic_classify(raw_msg)
        return {
            **fast_data,
            "agent_trace": [f"Intake complete (Fast-path/Fallback): {fast_data['priority']} priority, {fast_data['category']} category."]
        }

    prompt = f"""Analyze this support ticket and respond with ONLY a valid JSON object, no other text.

Ticket: {json.dumps(raw_msg)}

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
    # A customer is only verified if already registered and marked active in DB
    if customer and customer.get("is_active", True):
        return {
            "customer_id": customer["id"],
            "customer_tier": customer.get("tier", "standard"),
            "is_verified": True,
            "agent_trace": [f"Customer verified: ID {customer['id']}, Tier {customer.get('tier', 'standard')} ({customer.get('name', 'Customer')})."]
        }
    cust_id = customer["id"] if customer else None
    return {
        "customer_id": cust_id,
        "customer_tier": "standard",
        "is_verified": False,
        "agent_trace": [f"Unverified customer ticket recorded: {email}."]
    }


def tool_execution_node(state: TicketState) -> dict:
    """Retrieve KB docs and relevant dynamic system data (Orders, Invoices, Subscriptions)."""
    raw_msg = state.get('raw_message', '')
    msg_lower = raw_msg.lower()
    category = state.get('category', '')
    cust_id = state.get('customer_id')
    is_verified = bool(state.get('is_verified', False))
    # Public portal submissions pass trusted_session=False so email-only callers must supply matching ORD-/INV- IDs
    trusted_val = state.get('trusted_session')
    is_trusted = True if trusted_val is None else bool(trusted_val)

    # 1. Search Knowledge Base (always available for all inquiries)
    docs = search_kb(raw_msg)
    doc_texts = [d['text'] for d in docs]

    tools_used = []

    # Only query private customer records when customer identity is verified
    if is_verified and cust_id is not None:
        # 2. Extract Specific Order IDs (e.g. ORD-1001) — requires both matching customer_id and exact Order ID
        order_id_matches = re.findall(r'\b(?:ORD|ord)-\d+\b', raw_msg, re.IGNORECASE)
        matched_orders = sorted({m.upper() for m in order_id_matches})

        for oid in matched_orders:
            order_info = get_order(oid, customer_id=cust_id)
            if order_info:
                desc = f"Order {oid}: Status={order_info['status']}, Total=${order_info['total_amount']}, Placed={order_info['created_at'][:10]}"
                tools_used.append({
                    "name": "get_order",
                    "result": desc,
                    "tool": "get_order",
                    "data": desc
                })

        # Account-wide latest order lookup is restricted to trusted/authenticated sessions
        is_order_query = category == 'Order' or _contains_any(msg_lower, [
            'order', 'orders', 'ship', 'shipped', 'shipping', 'shipment', 'track', 'tracking',
            'অর্ডার', 'ডেলিভারি', 'পার্সেল'
        ])
        if is_trusted and not matched_orders and is_order_query:
            latest_order = get_latest_customer_order(cust_id)
            if latest_order:
                desc = f"Latest Order {latest_order['order_id']}: Status={latest_order['status']}, Total=${latest_order['total_amount']}"
                tools_used.append({
                    "name": "get_latest_customer_order",
                    "result": desc,
                    "tool": "get_latest_customer_order",
                    "data": desc
                })

        # 3. Extract Specific Invoice IDs (e.g. INV-9901) — requires both matching customer_id and exact Invoice ID
        invoice_id_matches = re.findall(r'\b(?:INV|inv)-\d+\b', raw_msg, re.IGNORECASE)
        matched_invoices = sorted({m.upper() for m in invoice_id_matches})

        for iid in matched_invoices:
            inv_info = get_invoice(iid, customer_id=cust_id)
            if inv_info:
                desc = f"Invoice {iid}: Status={inv_info['status']}, Amount=${inv_info['amount']}, Due={inv_info.get('due_date', 'N/A')}"
                tools_used.append({
                    "name": "get_invoice",
                    "result": desc,
                    "tool": "get_invoice",
                    "data": desc
                })

        # Account-wide latest invoice & subscription lookups are restricted to trusted/authenticated sessions
        is_billing_query = category in ['Billing', 'Subscription', 'Refund'] or _contains_any(msg_lower, [
            'invoice', 'invoices', 'bill', 'billing', 'charge', 'subscription', 'subscriptions', 'plan', 'refund',
            'ইনভয়েস', 'ইনভয়েস', 'বিল', 'পেমেন্ট', 'টাকা', 'রিফান্ড', 'সাবস্ক্রিপশন', 'প্ল্যান'
        ])
        if is_trusted and is_billing_query:
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


_ESCALATION_PHRASES = (
    "i cannot resolve this",
    "escalated this ticket",
    "support specialist has been notified",
    "স্বয়ংক্রিয়ভাবে সমাধান করতে পারছি না",
    "স্বয়ংক্রিয়ভাবে সমাধান করতে পারছি না",
    "সিনিয়র ইঞ্জিনিয়ার",
    "সাপোর্ট স্পেশালিস্ট",
    "এসকেলেট করা হয়েছে",
    "এসকেলেট করা হয়েছে",
)


def _detect_escalation_signal(text: Optional[str]) -> bool:
    if not text:
        return False
    lowered = text.lower()
    if "[escalate_required]" in lowered:
        return True
    return any(phrase in lowered for phrase in _ESCALATION_PHRASES)


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
4. For custom enterprise engineering, bespoke integrations (e.g. enterprise RAG pipelines, custom software), or inquiries needing tailored architectural design, provide a helpful summary of ZENIVIXON's relevant capabilities, explain that senior engineering review is needed (in the customer's language), and append the exact tag [ESCALATE_REQUIRED] at the end.
5. If the request is completely outside your knowledge base and no system data is available, state politely that a support specialist has been notified (in the customer's language) and append the exact tag [ESCALATE_REQUIRED] at the end.
"""

    needs_human_review = False
    try:
        if not llm:
            raise ValueError("LLM is not initialized (missing API key or client)")
        response = llm.invoke([HumanMessage(content=prompt)])
        raw_draft = response.content
        if isinstance(raw_draft, list):
            draft = " ".join([i.get("text", "") for i in raw_draft if isinstance(i, dict) and "text" in i])
        else:
            draft = str(raw_draft)

        needs_human_review = _detect_escalation_signal(draft)
        draft = re.sub(r'\s*\[ESCALATE_REQUIRED\]\s*', '', draft, flags=re.IGNORECASE).strip()
        findings = "Analyzed KB context and internal system records to formulate grounded response."
        trace_msg = "AI Resolution Engine drafted response using Gemini."
    except Exception:
        # Graceful fallback when LLM is unavailable
        rag_docs = state.get('rag_docs', [])
        tool_outputs = state.get('tool_outputs', [])
        is_bengali = any(0x0980 <= ord(char) <= 0x09FF for char in state.get('raw_message', ''))

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
            needs_human_review = True
            if is_bengali:
                draft = "আমি এটি স্বয়ংক্রিয়ভাবে সমাধান করতে পারছি না। আমাদের একজন সাপোর্ট স্পেশালিস্টকে বিষয়টি জানানো হয়েছে।"
            else:
                draft = "I cannot resolve this automatically. A support specialist has been notified."
            findings = "Autonomous resolution deferred: insufficient context or model quota reached."
        trace_msg = "AI Resolution Engine drafted response using grounded fallback."

    return {
        "draft_response": draft,
        "ai_findings": findings,
        "needs_human_review": needs_human_review,
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
    is_bengali = any(0x0980 <= ord(char) <= 0x09FF for char in state.get('raw_message', ''))

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


SENSITIVE_CATEGORIES = {"Billing", "Refund", "Subscription", "Account", "Security"}
PRIVATE_LOOKUP_CATEGORIES = {"Order", "Billing", "Refund", "Subscription", "Account", "Security"}


def safety_gate_node(state: TicketState) -> dict:
    """Deterministic policy gate. Rules = Authority."""
    is_safe = True
    reason = None

    churn_score, recommendation = calculate_churn_risk(state)
    trusted_val = state.get("trusted_session")
    is_trusted = True if trusted_val is None else bool(trusted_val)
    category = state.get("category") or "General"
    has_verified_tool_match = len(state.get("tool_outputs") or []) > 0

    if state.get('priority') == 'Critical':
        is_safe = False
        reason = "Deterministic Rule: Critical priority tickets cannot be auto-resolved."
    elif state.get('sentiment') == 'Angry':
        is_safe = False
        reason = "Deterministic Rule: Angry sentiment requires human empathy."
    elif not state.get('is_verified', False) and category in SENSITIVE_CATEGORIES:
        is_safe = False
        reason = "Deterministic Rule: Unverified user asking for sensitive category."
    elif not is_trusted and not has_verified_tool_match and category in PRIVATE_LOOKUP_CATEGORIES:
        is_safe = False
        reason = "Security Policy: Specific Order/Invoice ID verification required on public portal before disclosing account records."
    elif state.get("needs_human_review") or _detect_escalation_signal(state.get('draft_response')):
        is_safe = False
        reason = "AI Rule: Insufficient context or specialist engineering review required."

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
