import os
import requests
import logging

logger = logging.getLogger(__name__)

ZENDESK_SUBDOMAIN = os.getenv("ZENDESK_SUBDOMAIN")
ZENDESK_EMAIL = os.getenv("ZENDESK_EMAIL")
ZENDESK_API_TOKEN = os.getenv("ZENDESK_API_TOKEN")

def create_zendesk_ticket(subject: str, description: str, priority: str = "normal", customer_email: str = None) -> dict:
    """Create a ticket in Zendesk."""
    if not (ZENDESK_SUBDOMAIN and ZENDESK_EMAIL and ZENDESK_API_TOKEN):
        logger.info(f"[MOCK] Zendesk ticket created: {subject}")
        return {"id": "MOCK-123", "status": "new", "url": f"https://mock.zendesk.com/tickets/123"}
        
    url = f"https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets.json"
    auth = (f"{ZENDESK_EMAIL}/token", ZENDESK_API_TOKEN)
    
    payload = {
        "ticket": {
            "subject": subject,
            "description": description,
            "priority": priority,
        }
    }
    if customer_email:
        payload["ticket"]["requester"] = {"email": customer_email}

    response = requests.post(url, json=payload, auth=auth)
    if response.status_code == 201:
        data = response.json()
        return {
            "id": data["ticket"]["id"],
            "status": data["ticket"]["status"],
            "url": f"https://{ZENDESK_SUBDOMAIN}.zendesk.com/agent/tickets/{data['ticket']['id']}"
        }
    else:
        logger.error(f"Failed to create Zendesk ticket: {response.text}")
        raise Exception(f"Zendesk API Error: {response.status_code}")

def escalate_to_human(ticket_id: int, handoff_summary: str, customer_email: str = None) -> dict:
    """Escalate a ticket to a human agent in Zendesk (creates ticket if needed or falls back safely)."""
    if not (ZENDESK_SUBDOMAIN and ZENDESK_EMAIL and ZENDESK_API_TOKEN):
        logger.info(f"[MOCK] Escalated ticket {ticket_id} with summary: {handoff_summary.strip()}")
        return {"status": "escalated", "zendesk_id": f"MOCK-{ticket_id}"}
        
    auth = (f"{ZENDESK_EMAIL}/token", ZENDESK_API_TOKEN)
    
    # Check or create ticket first to ensure Zendesk has an active issue
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
        response = requests.post(create_url, json=payload, auth=auth)
        if response.status_code in [200, 201]:
            data = response.json()
            zendesk_id = data.get("ticket", {}).get("id")
            return {"status": "escalated", "zendesk_id": zendesk_id}
        else:
            logger.error(f"Failed to create escalation ticket in Zendesk: {response.text}")
            return {"status": "escalated", "error": response.text}
    except Exception as e:
        logger.error(f"Zendesk escalation call failed: {e}")
        return {"status": "escalated", "error": str(e)}
