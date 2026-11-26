"""
ZENIVIXON Autonomous Support Agent — Bilingual Evaluation & Benchmark Script.
Measures classification accuracy, escalation precision, VIP churn detection, and average latency
across 12 curated English & Bengali customer support scenarios.
"""
import pathlib
import sys
import time

backend_dir = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from db.seed import seed_database
from agents.graph import zenivixon_agent


EVAL_CASES = [
    {
        "id": "EN-01",
        "email": "john@example.com",
        "message": "Hi team, could you check the status of my order ORD-1001?",
        "expected_category": "Order",
        "expected_status": "resolved",
        "expect_tools": True,
    },
    {
        "id": "EN-02",
        "email": "visitor@techcorp.io",
        "message": "What AI services and RAG solutions does ZENIVIXON offer?",
        "expected_category": "General",
        "expected_status": "resolved",
        "expect_tools": False,
    },
    {
        "id": "EN-03",
        "email": "enterprise@bigcorp.com",
        "message": "Our high-priority shipment ORD-1003 is still delayed. Please update us.",
        "expected_category": "Order",
        "expected_status": "resolved",
        "expect_vip_churn": True,
    },
    {
        "id": "EN-04",
        "email": "angry@customer.com",
        "message": "I demand an immediate refund for invoice INV-9902! This is completely unacceptable.",
        "expected_category": "Billing",
        "expected_status": "escalated",
        "expect_tools": True,
    },
    {
        "id": "EN-05",
        "email": "guest.stranger@unknown.io",
        "message": "Please tell me about my billing invoice and refund status.",
        "expected_category": "Billing",
        "expected_status": "escalated",
        "expect_tools": False,
    },
    {
        "id": "EN-06",
        "email": "john@example.com",
        "message": "My API integration keeps crashing with a sync error.",
        "expected_category": "Technical",
        "expected_status": "resolved",
        "expect_tools": False,
    },
    {
        "id": "EN-07",
        "email": "enterprise@bigcorp.com",
        "message": "We are cancelling our contract immediately unless a lawyer reviews this emergency!",
        "expected_category": "General",
        "expected_status": "escalated",
        "expect_vip_churn": True,
    },
    {
        "id": "EN-08",
        "email": "john@example.com",
        "message": "Can I upgrade my subscription plan next month?",
        "expected_category": "Subscription",
        "expected_status": "resolved",
        "expect_tools": True,
    },
    {
        "id": "BN-01",
        "email": "john@example.com",
        "message": "আমার অর্ডার ORD-1001 এর খবর কী? কবে ডেলিভারি পাব?",
        "expected_category": "Order",
        "expected_status": "resolved",
        "expect_tools": True,
    },
    {
        "id": "BN-02",
        "email": "angry@customer.com",
        "message": "আপনাদের সার্ভিস বন্ধ হয়ে যাওয়ার কারণে আমার অনেক ক্ষতি হয়েছে! আমি ইনভয়েস INV-9902 এর রিফান্ড চাই।",
        "expected_category": "Billing",
        "expected_status": "escalated",
        "expect_tools": True,
    },
    {
        "id": "BN-03",
        "email": "visitor@bangla.org",
        "message": "ZENIVIXON সম্পর্কে বিস্তারিত তথ্য জানতে চাই।",
        "expected_category": "General",
        "expected_status": "resolved",
        "expect_tools": False,
    },
    {
        "id": "BN-04",
        "email": "unknown.user@example.org",
        "message": "আমার একাউন্ট পাসওয়ার্ড লগইন সমস্যা হচ্ছে।",
        "expected_category": "Account",
        "expected_status": "escalated",
        "expect_tools": False,
    },
]


def run_evaluation():
    seed_database()
    total = len(EVAL_CASES)
    cat_hits = 0
    status_hits = 0
    tool_hits = 0
    tool_checks = 0
    vip_hits = 0
    vip_checks = 0
    latencies_ms = []

    print("\n" + "=" * 72)
    print("  ZENIVIXON Bilingual Agent Evaluation Benchmark (12 Scenarios)")
    print("=" * 72)

    for idx, case in enumerate(EVAL_CASES, 1):
        start = time.perf_counter()
        result = zenivixon_agent.invoke({
            "ticket_id": 50000 + idx,
            "customer_email": case["email"],
            "raw_message": case["message"],
            "is_verified": False,
            "customer_tier": "standard",
            "agent_trace": [],
        })
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies_ms.append(elapsed_ms)

        cat_ok = result.get("category") == case["expected_category"]
        status_ok = result.get("resolution_status") == case["expected_status"]
        if cat_ok:
            cat_hits += 1
        if status_ok:
            status_hits += 1

        if "expect_tools" in case:
            tool_checks += 1
            has_tools = len(result.get("tool_outputs", [])) > 0
            if has_tools == case["expect_tools"]:
                tool_hits += 1

        if case.get("expect_vip_churn"):
            vip_checks += 1
            rec = (result.get("recommended_action") or "").lower()
            if "enterprise" in rec or "এন্টারপ্রাইজ" in rec:
                vip_hits += 1

        badge = "PASS" if (cat_ok and status_ok) else "WARN"
        print(
            f"  [{badge}] {case['id']} | cat={result.get('category')} (exp {case['expected_category']}) | "
            f"status={result.get('resolution_status')} (exp {case['expected_status']}) | "
            f"churn={result.get('churn_risk_score')}% | {elapsed_ms:.1f}ms"
        )

    avg_ms = sum(latencies_ms) / len(latencies_ms)
    print("-" * 72)
    print(f"  Category Accuracy   : {cat_hits}/{total} ({cat_hits / total * 100:.1f}%)")
    print(f"  Routing Accuracy    : {status_hits}/{total} ({status_hits / total * 100:.1f}%)")
    print(f"  Tool Guard Accuracy : {tool_hits}/{tool_checks} ({tool_hits / tool_checks * 100:.1f}%)")
    print(f"  VIP Tier Detection  : {vip_hits}/{vip_checks} ({vip_hits / vip_checks * 100:.1f}%)")
    print(f"  Average Latency     : {avg_ms:.1f} ms")
    print("=" * 72 + "\n")


if __name__ == "__main__":
    run_evaluation()
