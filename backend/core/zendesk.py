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

def escalate_to_human(ticket_id: int, handoff_summary: str) -> dict:
    """Escalate a ticket to a human agent by adding an internal note in Zendesk."""
    if not (ZENDESK_SUBDOMAIN and ZENDESK_EMAIL and ZENDESK_API_TOKEN):
        logger.info(f"[MOCK] Escalated ticket {ticket_id} with summary: {handoff_summary}")
        return {"status": "escalated"}
        
    url = f"https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/{ticket_id}.json"
    auth = (f"{ZENDESK_EMAIL}/token", ZENDESK_API_TOKEN)
    
    payload = {
        "ticket": {
            "comment": {
                "body": f"--- ESCALATION HANDOFF ---\n{handoff_summary}",
                "public": False
            }
        }
    }
    
    response = requests.put(url, json=payload, auth=auth)
    if response.status_code == 200:
        return {"status": "escalated"}
    else:
        logger.error(f"Failed to escalate Zendesk ticket: {response.text}")
        raise Exception(f"Zendesk API Error: {response.status_code}")
