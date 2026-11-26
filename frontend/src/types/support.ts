import { ToolExecutionItem } from '@/components/HandoffPackage';

export interface DailyTrendItem {
  day: string;
  date: string;
  total: number;
  resolved: number;
  escalated: number;
}

export interface DashboardStats {
  "Total Tickets"?: number;
  "Tickets Today": number;
  "AI Resolved": number;
  "Human Escalated": number;
  "Pending": number;
  "Resolution Rate": string;
  "Escalation Rate": string;
  "Average Churn Risk"?: string;
  average_churn_risk_value?: number;
  average_latency_ms?: number | null;
  category_breakdown?: Record<string, number>;
  priority_breakdown?: Record<string, number>;
  daily_trend?: DailyTrendItem[];
}

export interface TicketListItem {
  id: number;
  customer_email: string;
  customer_tier: string;
  raw_message: string;
  category: string;
  intent: string;
  priority: string;
  sentiment: string;
  status: string;
  churn_risk_score?: number;
  processing_time_ms?: number | null;
  recommended_action?: string;
  created_at: string | null;
  resolved_at: string | null;
  escalation_reason: string | null;
}

export interface LatestTicketResponse {
  ticket_id: number;
  status: string;
  trace: string[];
  customer_email?: string;
  customer_name?: string;
  customer_tier?: string;
  raw_message?: string;
  category?: string;
  intent?: string;
  priority?: string;
  sentiment?: string;
  ai_findings?: string;
  escalation_reason?: string;
  recommended_action?: string;
  churn_risk_score?: number;
  processing_time_ms?: number;
  draft_response?: string;
  tools_executed?: ToolExecutionItem[];
  is_verified?: boolean;
}

export interface TicketDetailModalData {
  id: number;
  customer: {
    email: string;
    name: string;
    tier: string;
    is_verified: boolean;
  };
  raw_message: string;
  category: string;
  intent: string;
  priority: string;
  sentiment: string;
  status: string;
  churn_risk_score?: number;
  processing_time_ms?: number | null;
  recommended_action?: string;
  draft_response?: string;
  ai_findings?: string;
  tools_executed?: ToolExecutionItem[];
  escalation_reason?: string;
  created_at: string | null;
  resolved_at: string | null;
}

export interface KBDocument {
  id: number;
  title: string;
  category: string;
  text: string;
  source: string;
  synced_to_qdrant?: boolean;
}

export interface StreamNodeEvent {
  node: string;
  label: string;
  trace: string[];
}
