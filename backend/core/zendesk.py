import os
import pathlib
import requests
import logging
from dotenv import load_dotenv

env_file = pathlib.Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
load_dotenv()

logger = logging.getLogger(__name__)

ZENDESK_SUBDOMAIN = os.getenv("ZENDESK_SUBDOMAIN")
ZENDESK_EMAIL = os.getenv("ZENDESK_EMAIL")
ZENDESK_API_TOKEN = os.getenv("ZENDESK_API_TOKEN")
ZENDESK_TIMEOUT_SECONDS = 10


def escalate_to_human(ticket_id: int, handoff_summary: str, customer_email: str = None) -> dict:
    """Escalate a ticket to a human agent in Zendesk (creates ticket if configured or falls back safely)."""
    if not (ZENDESK_SUBDOMAIN and ZENDESK_EMAIL and ZENDESK_API_TOKEN):
        logger.info(f"[MOCK] Escalated ticket {ticket_id} with summary: {handoff_summary.strip()}")
        return {"status": "escalated", "zendesk_id": f"MOCK-{ticket_id}", "zendesk_url": None}

    auth = (f"{ZENDESK_EMAIL}/token", ZENDESK_API_TOKEN)
    create_url = f"https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets.json"
    payload = {
        "ticket": {
            "subject": f"Escalation: Local Ticket #{ticket_id}",
            "comment": {
                "body": f"--- AUTONOMOUS AGENT ESCALATION HANDOFF ---\n{handoff_summary}",
                "public": False
            },
            "priority": "urgent"
        }
    }
    if customer_email:
        payload["ticket"]["requester"] = {"email": customer_email}

    try:
        response = requests.post(create_url, json=payload, auth=auth, timeout=ZENDESK_TIMEOUT_SECONDS)
        if response.status_code in [200, 201]:
            data = response.json()
            zendesk_id = data.get("ticket", {}).get("id")
            zendesk_url = f"https://{ZENDESK_SUBDOMAIN}.zendesk.com/agent/tickets/{zendesk_id}" if zendesk_id else None
            return {"status": "escalated", "zendesk_id": zendesk_id, "zendesk_url": zendesk_url}
        else:
            logger.error(f"Failed to create escalation ticket in Zendesk: {response.text}")
            return {"status": "escalated", "error": response.text}
    except Exception as e:
        logger.error(f"Zendesk escalation call failed: {e}")
        return {"status": "escalated", "error": str(e)}
