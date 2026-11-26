import os
import sys
import pathlib
import pytest

# Ensure backend directory is importable
BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Configure deterministic test environment before importing app
os.environ.setdefault("APP_ENV", "development")
os.environ["ADMIN_PASSCODES"] = "test-admin-secret"
os.environ["RATE_LIMIT_PER_MINUTE"] = "200"

from fastapi.testclient import TestClient
from db.seed import seed_database
from core.tools import get_order, get_invoice, get_customer
from agents.nodes import verify_node, safety_gate_node, calculate_churn_risk
from agents.graph import check_fast_escalation, zenivixon_agent
from core.qdrant_store import _search_local_fallback
import main as main_module

ADMIN_HEADERS = {"X-Admin-Passcode": "test-admin-secret"}


@pytest.fixture(scope="module", autouse=True)
def setup_seed_data():
    seed_database()


@pytest.fixture(scope="module")
def client():
    return TestClient(main_module.app)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Health & Telemetry Endpoints
# ─────────────────────────────────────────────────────────────────────────────
def test_health_endpoints(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "online"
    assert body["service"] == "ZENIVIXON Support AI"

    deep = client.get("/api/health/deep")
    assert deep.status_code == 200
    deep_body = deep.json()
    assert "database" in deep_body["services"]
    assert "knowledge_base_rag" in deep_body["services"]
    assert "llm" in deep_body["services"]
    assert deep_body["services"]["llm"]["model"] != "gemini-3.8-flash"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Security: Admin Auth, Input Validation & IDOR
# ─────────────────────────────────────────────────────────────────────────────
def test_admin_endpoints_reject_missing_or_invalid_passcode(client):
    assert client.get("/api/dashboard/stats").status_code == 401
    assert client.get("/api/tickets").status_code == 401
    assert client.get("/api/kb").status_code == 401
    assert client.get("/api/dashboard/stats", headers={"X-Admin-Passcode": "wrong"}).status_code == 401
    assert client.get("/api/dashboard/stats", headers=ADMIN_HEADERS).status_code == 200


def test_idor_protection_strict_customer_id():
    john = get_customer("john@example.com")
    assert john is not None
    # Passing customer_id=None must NEVER leak any order or invoice
    assert get_order("ORD-1001", customer_id=None) is None
    assert get_invoice("INV-9901", customer_id=None) is None
    # Cross-account lookups must be blocked
    assert get_order("ORD-1003", customer_id=john["id"]) is None
    assert get_invoice("INV-9902", customer_id=john["id"]) is None
    # Own account lookups succeed
    assert get_order("ORD-1001", customer_id=john["id"]) is not None
    assert get_invoice("INV-9901", customer_id=john["id"]) is not None


def test_ticket_input_validation(client):
    # Invalid email rejected with 422
    res = client.post("/api/tickets", json={"email": "not-an-email", "message": "Hello world"})
    assert res.status_code == 422
    # Too short message rejected with 422
    res2 = client.post("/api/tickets", json={"email": "john@example.com", "message": "Hi"})
    assert res2.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# 3. Critical Bug Regression: Enterprise customer_tier & Churn Risk
# ─────────────────────────────────────────────────────────────────────────────
def test_enterprise_customer_tier_preserved_through_langgraph():
    final = zenivixon_agent.invoke({
        "ticket_id": 88881,
        "customer_email": "enterprise@bigcorp.com",
        "raw_message": "Our order ORD-1003 is delayed and this is urgent!",
        "is_verified": False,
        "customer_tier": "standard",
        "agent_trace": [],
    })
    assert final.get("customer_tier") == "enterprise"
    assert final.get("is_verified") is True
    assert final.get("churn_risk_score", 0) >= 55
    assert "enterprise" in (final.get("recommended_action") or "").lower()


def test_unverified_guest_is_not_marked_verified_and_cannot_query_private_records(client):
    guest_email = "brandnew.unverified.guest@example.org"
    res = client.post("/api/tickets", json={
        "email": guest_email,
        "message": "Please check order ORD-1001 and my billing invoice INV-9901."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_verified"] is False
    assert data["tools_executed"] == []
    assert data["status"] == "escalated"
    assert isinstance(data["processing_time_ms"], int) and data["processing_time_ms"] >= 1

    # Portal track must also report is_verified=False for inactive guest
    track = client.get(f"/api/portal/track?ticket_id={data['ticket_id']}&email={guest_email}")
    assert track.status_code == 200
    assert track.json()["customer"]["is_verified"] is False

    # Admin detail must also report is_verified=False
    detail = client.get(f"/api/tickets/{data['ticket_id']}", headers=ADMIN_HEADERS)
    assert detail.status_code == 200
    assert detail.json()["customer"]["is_verified"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 4. Ticket Lifecycle, Streaming SSE & Dashboard Stats
# ─────────────────────────────────────────────────────────────────────────────
def test_submit_track_and_patch_ticket_lifecycle(client):
    res = client.post("/api/tickets", json={
        "email": "john@example.com",
        "message": "Hi, can you check my order ORD-1001 status?"
    })
    assert res.status_code == 200
    body = res.json()
    ticket_id = body["ticket_id"]
    assert body["status"] == "resolved"
    assert body["is_verified"] is True
    assert len(body["tools_executed"]) >= 1
    assert body["processing_time_ms"] >= 1

    # Wrong email on portal track returns 404
    bad_track = client.get(f"/api/portal/track?ticket_id={ticket_id}&email=other@example.com")
    assert bad_track.status_code == 404

    # Correct email succeeds
    good_track = client.get(f"/api/portal/track?ticket_id={ticket_id}&email=john@example.com")
    assert good_track.status_code == 200
    assert good_track.json()["id"] == ticket_id

    # Admin PATCH status validation and update
    bad_patch = client.patch(f"/api/tickets/{ticket_id}", json={"status": "invalid_state"}, headers=ADMIN_HEADERS)
    assert bad_patch.status_code == 400

    good_patch = client.patch(f"/api/tickets/{ticket_id}", json={"status": "escalated"}, headers=ADMIN_HEADERS)
    assert good_patch.status_code == 200
    assert good_patch.json()["status"] == "escalated"


def test_sse_streaming_ticket_endpoint(client):
    res = client.post("/api/tickets/stream", json={
        "email": "john@example.com",
        "message": "What AI services does ZENIVIXON provide?"
    })
    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
    text = res.text
    assert "event: started" in text
    assert "event: node" in text
    assert "event: done" in text


def test_dashboard_stats_includes_all_categories_and_real_latency(client):
    res = client.get("/api/dashboard/stats", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    stats = res.json()
    assert "Total Tickets" in stats
    assert "Tickets Today" in stats
    assert "average_latency_ms" in stats
    assert "Refund" in stats["category_breakdown"]
    assert "Security" in stats["category_breakdown"]
    assert len(stats["daily_trend"]) == 7


# ─────────────────────────────────────────────────────────────────────────────
# 5. Admin Knowledge Base Manager & Local Fallback
# ─────────────────────────────────────────────────────────────────────────────
def test_admin_kb_list_and_create(client):
    list_res = client.get("/api/kb", headers=ADMIN_HEADERS)
    assert list_res.status_code == 200
    initial_count = list_res.json()["total"]
    assert initial_count >= 30

    create_res = client.post(
        "/api/kb",
        json={
            "title": "ZENIVIXON SLA Guarantee Policy",
            "category": "Support",
            "text": "Enterprise tier customers receive 2-hour SLA response times and dedicated architectural reviews."
        },
        headers=ADMIN_HEADERS,
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == "ZENIVIXON SLA Guarantee Policy"

    # Searchable immediately via fallback KB
    hits = _search_local_fallback("SLA Guarantee Policy Enterprise", limit=3)
    assert any("SLA Guarantee Policy" in (h.get("title") or "") for h in hits)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Safety Gate & Routing Unit Checks
# ─────────────────────────────────────────────────────────────────────────────
def test_safety_gate_and_fast_track_rules():
    assert check_fast_escalation({"priority": "Critical", "sentiment": "Neutral"}) == "escalate"
    assert check_fast_escalation({"priority": "Low", "sentiment": "Angry"}) == "escalate"
    assert check_fast_escalation({"priority": "Medium", "sentiment": "Neutral"}) == "proceed"

    res = safety_gate_node({
        "priority": "Medium",
        "sentiment": "Neutral",
        "customer_tier": "standard",
        "category": "General",
        "is_verified": True,
        "draft_response": None,
        "raw_message": "Hello",
    })
    assert res["is_safe"] is True
    assert verify_node({"customer_email": "john@example.com"})["is_verified"] is True
    score, rec = calculate_churn_risk({
        "customer_tier": "enterprise",
        "priority": "Critical",
        "sentiment": "Angry",
        "category": "Billing",
        "raw_message": "Urgent billing issue",
    })
    assert score >= 90
    assert "Enterprise" in rec
