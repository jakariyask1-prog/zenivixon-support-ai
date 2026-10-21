import os
import sys
import pathlib

# Ensure backend root is in sys.path
backend_dir = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))
project_root = backend_dir.parent

from core.tools import get_order, get_invoice, get_customer, get_latest_customer_order
from agents.nodes import verify_node, safety_gate_node, _heuristic_classify, calculate_churn_risk
from agents.graph import check_fast_escalation, route_after_gate, zenivixon_agent
from core.qdrant_store import _search_local_fallback
from db.database import engine, SessionLocal
from db.models import Customer, Order, Invoice, Ticket
from sqlalchemy import text

tests_passed = 0
tests_failed = 0

def run_test(name, fn):
    global tests_passed, tests_failed
    try:
        fn()
        print(f"  [PASS] {name}")
        tests_passed += 1
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")
        tests_failed += 1

print("\n" + "="*60)
print("  ZENIVIXON Automated System Test & Remediation Verification")
print("="*60 + "\n")

# 1. Tenant Isolation Tests (IDOR Prevention)
print("[Group 1] Tenant Isolation & IDOR Tests:")
def test_idor_protection_order():
    john = get_customer("john@example.com")
    assert john is not None, "Expected seeded customer john@example.com"
    john_id = john["id"]
    
    # ORD-1003 belongs to Enterprise customer; John should be blocked from seeing it
    cross_order = get_order("ORD-1003", customer_id=john_id)
    assert cross_order is None, f"Expected None for cross-account order, got {cross_order}"
    
    # ORD-1001 belongs to John; John should be able to see it
    own_order = get_order("ORD-1001", customer_id=john_id)
    assert own_order is not None, f"Expected order ORD-1001 for customer {john_id}"
    assert own_order["status"] in ["shipped", "delivered", "processing"], f"Unexpected status: {own_order}"
run_test("Cross-customer order lookup is blocked (IDOR resolved)", test_idor_protection_order)

def test_idor_protection_invoice():
    john = get_customer("john@example.com")
    john_id = john["id"]
    
    # INV-9902 belongs to angry customer; John should not see it
    cross_invoice = get_invoice("INV-9902", customer_id=john_id)
    assert cross_invoice is None, f"Expected None for cross-account invoice, got {cross_invoice}"
    
    # INV-9901 belongs to John
    own_invoice = get_invoice("INV-9901", customer_id=john_id)
    assert own_invoice is not None, f"Expected invoice INV-9901 for customer {john_id}"
run_test("Cross-customer invoice lookup is blocked (IDOR resolved)", test_idor_protection_invoice)

# 2. Safety Gate & NoneType Coalescing Tests
print("\n[Group 2] Safety Gate & Node Stability Tests:")
def test_safety_gate_none_draft():
    # If draft_response is explicitly None, it should not throw TypeError
    state = {
        "priority": "Medium",
        "sentiment": "Neutral",
        "customer_tier": "standard",
        "category": "General",
        "is_verified": True,
        "draft_response": None,
        "raw_message": "Can you help me?"
    }
    result = safety_gate_node(state)
    assert "is_safe" in result
    assert result["is_safe"] is True
run_test("safety_gate_node handles None draft_response without TypeError", test_safety_gate_none_draft)

def test_safety_gate_unverified_sensitive():
    # Unverified customer inquiring about sensitive categories MUST be blocked
    state = {
        "priority": "Medium",
        "sentiment": "Neutral",
        "customer_tier": "standard",
        "category": "Billing",
        "is_verified": False,
        "draft_response": "Here is billing info",
        "raw_message": "Tell me about my billing"
    }
    result = safety_gate_node(state)
    assert result["is_safe"] is False
    assert "Unverified user" in result["escalation_reason"]
run_test("Safety Gate blocks unverified user on sensitive categories", test_safety_gate_unverified_sensitive)

# 3. Customer Verification Tests
print("\n[Group 3] Customer Identity Verification Tests:")
def test_verify_node_registered_customer():
    state = {"customer_email": "john@example.com"}
    result = verify_node(state)
    assert result["is_verified"] is True
    assert result["customer_id"] is not None
run_test("Registered active customer is verified", test_verify_node_registered_customer)

def test_verify_node_stranger_customer():
    state = {"customer_email": "unregistered_stranger_test@randomdomain.xyz"}
    result = verify_node(state)
    assert result["is_verified"] is False
run_test("Stranger/unregistered email is marked unverified", test_verify_node_stranger_customer)

# 4. LangGraph Flow & Fast-Track Routing Tests
print("\n[Group 4] LangGraph Routing & Graph Integrity:")
def test_fast_track_escalation_routing():
    crit_state = {"priority": "Critical", "sentiment": "Neutral"}
    assert check_fast_escalation(crit_state) == "escalate"
    
    angry_state = {"priority": "Medium", "sentiment": "Angry"}
    assert check_fast_escalation(angry_state) == "escalate"
    
    normal_state = {"priority": "Medium", "sentiment": "Neutral"}
    assert check_fast_escalation(normal_state) == "proceed"
run_test("check_fast_escalation correctly routes Critical and Angry tickets", test_fast_track_escalation_routing)

def test_graph_fast_track_execution():
    # Test full agent execution on angry refund inquiry
    state = {
        "ticket_id": 99999,
        "customer_email": "angry@customer.com",
        "raw_message": "I demand an immediate refund for invoice INV-9902! Your service failed and I am angry.",
        "is_verified": True,
        "customer_tier": "standard",
        "agent_trace": []
    }
    final = zenivixon_agent.invoke(state)
    assert final.get("resolution_status") == "escalated"
    assert "escalated" in final.get("resolution_status")
run_test("LangGraph end-to-end execution escalates angry ticket without crashing", test_graph_fast_track_execution)

# 5. Database Concurrency & Pragma Tests
print("\n[Group 5] Database Settings & Concurrency:")
def test_sqlite_pragmas():
    if "sqlite" in str(engine.url):
        with engine.connect() as conn:
            journal_mode = conn.execute(text("PRAGMA journal_mode;")).scalar()
            busy_timeout = conn.execute(text("PRAGMA busy_timeout;")).scalar()
            assert journal_mode.lower() == "wal", f"Expected WAL mode, got {journal_mode}"
            assert busy_timeout >= 5000, f"Expected >= 5000 busy timeout, got {busy_timeout}"
run_test("SQLite WAL mode and busy timeout are configured", test_sqlite_pragmas)

# 6. Local Fallback Knowledge Base Search
print("\n[Group 6] Resilient Vector Knowledge Base Fallback:")
def test_local_kb_search():
    results = _search_local_fallback("ZENIVIXON AI Agents", limit=2)
    assert len(results) > 0, "Expected local knowledge base fallback to return docs"
    assert "text" in results[0]
    assert "score" in results[0]
run_test("In-memory local knowledge base search functions cleanly", test_local_kb_search)

print("\n" + "="*60)
print(f"  Test Suite Completed: {tests_passed} Passed, {tests_failed} Failed")
print("="*60 + "\n")

if tests_failed > 0:
    sys.exit(1)
