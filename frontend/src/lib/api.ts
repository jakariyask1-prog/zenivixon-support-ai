import { DashboardStats, KBDocument, TicketDetailModalData, TicketListItem } from '@/types/support';

export function resolveApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '3000'
  ) {
    return 'http://localhost:8000';
  }
  return '';
}

export function isJsonResponse(res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('application/json');
}

export function isEventStreamResponse(res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('text/event-stream');
}

export const DEMO_PREVIEW_STATS: DashboardStats = {
  'Total Tickets': 42,
  'Tickets Today': 7,
  'AI Resolved': 31,
  'Human Escalated': 11,
  Pending: 0,
  'Resolution Rate': '73.8%',
  'Escalation Rate': '26.2%',
  'Average Churn Risk': '31.4%',
  average_churn_risk_value: 31.4,
  average_latency_ms: 480,
  category_breakdown: {
    Order: 12,
    Billing: 8,
    Refund: 4,
    Technical: 7,
    Account: 3,
    Security: 2,
    Subscription: 2,
    General: 4,
  },
  priority_breakdown: {
    Critical: 5,
    High: 9,
    Medium: 18,
    Low: 10,
  },
  daily_trend: [
    { day: 'Sat', date: 'Day -6', total: 5, resolved: 4, escalated: 1 },
    { day: 'Sun', date: 'Day -5', total: 4, resolved: 3, escalated: 1 },
    { day: 'Mon', date: 'Day -4', total: 7, resolved: 5, escalated: 2 },
    { day: 'Tue', date: 'Day -3', total: 6, resolved: 5, escalated: 1 },
    { day: 'Wed', date: 'Day -2', total: 8, resolved: 5, escalated: 3 },
    { day: 'Thu', date: 'Day -1', total: 5, resolved: 4, escalated: 1 },
    { day: 'Fri', date: 'Today', total: 7, resolved: 5, escalated: 2 },
  ],
};

export const DEMO_PREVIEW_TICKETS: TicketListItem[] = [
  {
    id: 104,
    customer_email: 'enterprise@bigcorp.com',
    customer_tier: 'enterprise',
    raw_message: 'Our high-priority shipment ORD-1003 is still marked delayed. Please provide an expedited status update.',
    category: 'Order',
    intent: 'Expedited Enterprise Order Update',
    priority: 'High',
    sentiment: 'Frustrated',
    status: 'resolved',
    churn_risk_score: 70,
    processing_time_ms: 420,
    recommended_action: 'Enterprise VIP Account: Prioritize immediately, assign Lead Solutions Architect, and offer 20% SLA courtesy credit.',
    created_at: '2026-11-27T12:15:00Z',
    resolved_at: '2026-11-27T12:15:01Z',
    escalation_reason: null,
  },
  {
    id: 103,
    customer_email: 'angry@customer.com',
    customer_tier: 'standard',
    raw_message: 'আপনাদের সার্ভিস বন্ধ হয়ে যাওয়ার কারণে আমার অনেক ক্ষতি হয়েছে! আমি অবিলম্বে ইনভয়েস INV-9902 এর ফুল রিফান্ড চাই।',
    category: 'Billing',
    intent: 'জরুরি ইনভয়েস রিফান্ড দাবি',
    priority: 'Critical',
    sentiment: 'Angry',
    status: 'escalated',
    churn_risk_score: 95,
    processing_time_ms: 195,
    recommended_action: 'উচ্চ ঝুঁকি (Critical Risk): সহানুভূতিশীল বার্তা দিন, ২ ঘণ্টার মধ্যে রেজল্যুশন নিশ্চিত করুন এবং রিটেনশন ক্রেডিট অফার করুন।',
    created_at: '2026-11-27T11:40:00Z',
    resolved_at: null,
    escalation_reason: 'Fast-track Escalation: Critical priority ticket routed directly to human response team.',
  },
  {
    id: 102,
    customer_email: 'john@example.com',
    customer_tier: 'standard',
    raw_message: 'Hi team, could you check the status of my order ORD-1001 and let me know when it arrives?',
    category: 'Order',
    intent: 'Check Order ORD-1001 Status',
    priority: 'Low',
    sentiment: 'Neutral',
    status: 'resolved',
    churn_risk_score: 20,
    processing_time_ms: 510,
    recommended_action: 'Standard Priority: Provide standard troubleshooting documentation and friendly confirmation.',
    created_at: '2026-11-27T10:05:00Z',
    resolved_at: '2026-11-27T10:05:01Z',
    escalation_reason: null,
  },
  {
    id: 101,
    customer_email: 'visitor@techcorp.io',
    customer_tier: 'standard',
    raw_message: 'What AI services, custom agent architectures, and RAG integration does ZENIVIXON offer?',
    category: 'General',
    intent: 'AI Services & RAG Capabilities',
    priority: 'Low',
    sentiment: 'Neutral',
    status: 'resolved',
    churn_risk_score: 20,
    processing_time_ms: 615,
    recommended_action: 'Standard Priority: Provide standard troubleshooting documentation and friendly confirmation.',
    created_at: '2026-11-26T18:30:00Z',
    resolved_at: '2026-11-26T18:30:01Z',
    escalation_reason: null,
  },
];

export function buildDemoTicketDetail(item: TicketListItem): TicketDetailModalData {
  return {
    id: item.id,
    customer: {
      email: item.customer_email,
      name: item.customer_email.split('@')[0].replace('.', ' '),
      tier: item.customer_tier,
      is_verified: item.customer_email !== 'visitor@techcorp.io',
    },
    raw_message: item.raw_message,
    category: item.category,
    intent: item.intent,
    priority: item.priority,
    sentiment: item.sentiment,
    status: item.status,
    churn_risk_score: item.churn_risk_score,
    processing_time_ms: item.processing_time_ms,
    recommended_action: item.recommended_action,
    draft_response:
      item.status === 'resolved'
        ? 'Thank you for contacting ZENIVIXON Support. Your inquiry was verified against live customer records and grounded Master Knowledge Base documentation.'
        : undefined,
    ai_findings:
      item.status === 'escalated'
        ? 'Fast-track diagnostics: Invoice INV-9902: Status=overdue, Amount=$29.99'
        : 'Analyzed KB context and internal system records to formulate grounded response.',
    tools_executed:
      item.category === 'Order'
        ? [{ name: 'get_order', result: `Verified ${item.customer_tier} order status from PostgreSQL ledger` }]
        : item.category === 'Billing'
        ? [{ name: 'get_invoice', result: 'Invoice INV-9902: Status=overdue, Amount=$29.99' }]
        : [],
    escalation_reason: item.escalation_reason ?? undefined,
    created_at: item.created_at,
    resolved_at: item.resolved_at,
  };
}

export const DEMO_PREVIEW_KB_DOCS: KBDocument[] = [
  {
    id: 1,
    title: 'ZENIVIXON Company Identity & Overview',
    category: 'Company',
    text: 'ZENIVIXON is an AI-first technology company focused on practical AI agents, workflow automation, RAG knowledge systems, and modern web software.',
    source: 'master-kb-step1',
    synced_to_qdrant: true,
  },
  {
    id: 3,
    title: 'ZENIVIXON Service — AI Agents & 24/7 Customer Support',
    category: 'Services',
    text: 'Purpose-built stateful LangGraph AI agents that classify tickets, verify customer context, execute tenant-isolated tools, and escalate high-risk cases to humans.',
    source: 'master-kb-step2',
    synced_to_qdrant: true,
  },
  {
    id: 16,
    title: 'ZENIVIXON Technology & Architecture Governance',
    category: 'Technology',
    text: 'Problem -> Requirements -> Constraints -> Architecture -> Technology. Strict input/output validation, deterministic safety gates, IDOR isolation, and human oversight.',
    source: 'master-kb-step7',
    synced_to_qdrant: true,
  },
  {
    id: 25,
    title: 'Human Handoff Rules & Escalation Triggers',
    category: 'Handoff',
    text: 'Escalate immediately when priority is Critical, sentiment is Angry, unverified users request sensitive billing/security actions, or custom architecture scoping is needed.',
    source: 'master-kb-step12',
    synced_to_qdrant: true,
  },
];
