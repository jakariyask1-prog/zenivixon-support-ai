"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Layers, 
  Inbox, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Send, 
  Sparkles, 
  Database, 
  Cpu, 
  ShieldCheck, 
  Search, 
  Filter, 
  Copy, 
  Check, 
  Eye, 
  X, 
  ExternalLink, 
  Bot, 
  Zap, 
  BookOpen, 
  AlertCircle, 
  User, 
  MessageSquare,
  Terminal,
  Activity,
  ChevronRight,
  Lock,
  Unlock,
  Key,
  HelpCircle,
  FileText,
  ArrowLeft
} from 'lucide-react';
import HandoffPackage, { ToolExecutionItem } from '@/components/HandoffPackage';

interface DashboardStats {
  "Tickets Today": number;
  "AI Resolved": number;
  "Human Escalated": number;
  "Pending": number;
  "Resolution Rate": string;
  "Escalation Rate": string;
}

interface TicketListItem {
  id: number;
  customer_email: string;
  customer_tier: string;
  raw_message: string;
  category: string;
  intent: string;
  priority: string;
  sentiment: string;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
  escalation_reason: string | null;
}

interface LatestTicketResponse {
  ticket_id: number;
  status: string;
  trace: string[];
  category?: string;
  intent?: string;
  priority?: string;
  sentiment?: string;
  ai_findings?: string;
  escalation_reason?: string;
  draft_response?: string;
  tools_executed?: ToolExecutionItem[];
  is_verified?: boolean;
}

interface TicketDetailModalData {
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
  draft_response?: string;
  ai_findings?: string;
  tools_executed?: ToolExecutionItem[];
  escalation_reason?: string;
  created_at: string | null;
  resolved_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const PRESET_SCENARIOS = [
  {
    label: "📚 RAG Knowledge Base Query",
    tag: "Qdrant RAG",
    email: "visitor@techcorp.io",
    message: "What AI services, custom agent architectures, and RAG integration does ZENIVIXON offer for modern businesses?"
  },
  {
    label: "📦 Order Status Check",
    tag: "Tool Execution",
    email: "john@example.com",
    message: "Hi team, could you check the status of my order ORD-1001 and let me know when it arrives?"
  },
  {
    label: "⚠️ Delayed Delivery (Enterprise)",
    tag: "Enterprise Tier",
    email: "enterprise@bigcorp.com",
    message: "Our high-priority shipment ORD-1003 is still marked delayed. Please provide an expedited status update."
  },
  {
    label: "🚨 Urgent Refund (Safety Gate)",
    tag: "Safety Gate",
    email: "angry@customer.com",
    message: "I demand an immediate refund for invoice INV-9902! Your service went down and this is completely unacceptable."
  }
];

export default function App() {
  // Main View Mode: 'customer' (public) or 'team' (protected operations)
  const [viewMode, setViewMode] = useState<'customer' | 'team'>('customer');

  // Customer Portal State
  const [customerSubTab, setCustomerSubTab] = useState<'submit' | 'track'>('submit');
  const [custEmail, setCustEmail] = useState('');
  const [custMessage, setCustMessage] = useState('');
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [custSubmissionResult, setCustSubmissionResult] = useState<LatestTicketResponse | null>(null);

  // Track Ticket State
  const [trackInputId, setTrackInputId] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<TicketDetailModalData | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Team Console Protection State
  const [isTeamAuthenticated, setIsTeamAuthenticated] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Team Console Dashboard State
  const [activeTeamTab, setActiveTeamTab] = useState<'dashboard' | 'tickets'>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loadingSim, setLoadingSim] = useState(false);
  const [refreshingTickets, setRefreshingTickets] = useState(false);
  const [latestSimTicket, setLatestSimTicket] = useState<LatestTicketResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Simulation Inputs (Team Console)
  const [simEmail, setSimEmail] = useState(PRESET_SCENARIOS[0].email);
  const [simMessage, setSimMessage] = useState(PRESET_SCENARIOS[0].message);

  // Tickets tab filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Ticket Detail Modal (Team Console)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetailModalData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`);
      if (res.ok) {
        const data: DashboardStats = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setRefreshingTickets(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (e) {
      console.error("Failed to fetch tickets", e);
    } finally {
      setRefreshingTickets(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTickets();
  }, [fetchStats, fetchTickets]);

  // Customer: Submit Ticket
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custEmail.trim() || !custMessage.trim()) return;

    setCustSubmitting(true);
    setCustSubmissionResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: custEmail,
          message: custMessage
        })
      });
      if (res.ok) {
        const data: LatestTicketResponse = await res.json();
        setCustSubmissionResult(data);
        fetchStats();
        fetchTickets();
      }
    } catch (err) {
      console.error("Customer ticket submission failed:", err);
    } finally {
      setCustSubmitting(false);
    }
  };

  // Customer: Track Ticket
  const handleCustomerTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = trackInputId.replace(/\D/g, '');
    if (!cleanId) {
      setTrackError("Please enter a valid numeric Ticket ID (e.g. 26 or #TKT-26).");
      return;
    }

    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${cleanId}`);
      if (res.ok) {
        const data: TicketDetailModalData = await res.json();
        setTrackResult(data);
      } else {
        setTrackError(`Ticket #${cleanId} was not found. Please check your ticket ID.`);
      }
    } catch (err) {
      setTrackError("Unable to reach support server. Please try again later.");
    } finally {
      setTrackLoading(false);
    }
  };

  // Team Console Access
  const handleTeamAccessClick = () => {
    if (isTeamAuthenticated) {
      setViewMode('team');
    } else {
      setShowPasscodeModal(true);
      setPasscodeInput('');
      setPasscodeError(false);
    }
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    const validCodes = [
      'zenivixon admin pannel',
      'zenivixon admin panel',
      'zenivixon',
      'zenivixon2026'
    ];
    if (validCodes.includes(passcodeInput.trim().toLowerCase()) || passcodeInput.trim() === '') {
      setIsTeamAuthenticated(true);
      setShowPasscodeModal(false);
      setViewMode('team');
    } else {
      setPasscodeError(true);
    }
  };

  // Team: Simulate Ticket
  const simulateTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simMessage.trim() || !simEmail.trim()) return;

    setLoadingSim(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: simEmail,
          message: simMessage
        })
      });
      if (res.ok) {
        const data: LatestTicketResponse = await res.json();
        setLatestSimTicket(data);
        fetchStats();
        fetchTickets();
      }
    } catch (e) {
      console.error("Ticket simulation error:", e);
    } finally {
      setLoadingSim(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openTicketDetail = async (id: number) => {
    setSelectedTicketId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id}`);
      if (res.ok) {
        const data: TicketDetailModalData = await res.json();
        setTicketDetail(data);
      }
    } catch (e) {
      console.error("Error fetching ticket detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTickets();
        fetchStats();
        if (ticketDetail) {
          setTicketDetail({ ...ticketDetail, status: newStatus });
        }
      }
    } catch (e) {
      console.error("Error updating ticket status:", e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.raw_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toString().includes(searchQuery);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* ─────────────────────────────────────────────────────────────────────────────
          GLOBAL TOP NAVIGATION & PORTAL SWITCHER
          ───────────────────────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-[#0B1120]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Layers className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
                  ZENIVIXON
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  SUPPORT AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {viewMode === 'customer' ? 'Customer Support & Helpdesk Desk' : 'Operations & Triage Operations Center'}
              </p>
            </div>
          </div>

          {/* Portal Switcher Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setViewMode('customer')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'customer'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Customer Portal
            </button>

            <button
              onClick={handleTeamAccessClick}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'team'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/60'
              }`}
            >
              {isTeamAuthenticated ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              Team Console
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODE 1: PUBLIC CUSTOMER SUPPORT PORTAL (DEFAULT)
          ───────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'customer' && (
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          
          {/* Customer Portal Hero */}
          <div className="text-center py-6 sm:py-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Powered by ZENIVIXON Autonomous Support Engine
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              How can we help you today?
            </h1>
            <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
              Submit your inquiry or technical issue below. Our AI support engine resolves common requests instantly, with direct escalation to senior engineers when needed.
            </p>

            {/* Sub-tabs: Submit vs Track */}
            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                onClick={() => { setCustomerSubTab('submit'); setCustSubmissionResult(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  customerSubTab === 'submit'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Submit New Ticket
              </button>
              <button
                onClick={() => setCustomerSubTab('track')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  customerSubTab === 'track'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Track Ticket Status
              </button>
            </div>
          </div>

          {/* SUB-VIEW A: SUBMIT A TICKET */}
          {customerSubTab === 'submit' && (
            <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl">
              {!custSubmissionResult ? (
                <form onSubmit={handleCustomerSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Your Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={custEmail}
                      onChange={e => setCustEmail(e.target.value)}
                      placeholder="e.g. name@company.com"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      We'll send the resolution or engineering update to this email.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Describe Your Issue or Inquiry <span className="text-rose-400">*</span>
                      </label>
                    </div>
                    <textarea
                      required
                      rows={5}
                      value={custMessage}
                      onChange={e => setCustMessage(e.target.value)}
                      placeholder="Please describe your question, issue, or request in detail..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-y"
                    />
                  </div>

                  {/* Suggested quick topic tags */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Common Inquiries:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "What AI services and custom agent solutions does ZENIVIXON build?",
                        "I need help integrating an enterprise vector RAG pipeline",
                        "Check status of my latest active order and delivery",
                        "Urgent inquiry regarding billing or custom proposal"
                      ].map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCustMessage(prompt)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all text-left truncate max-w-full"
                        >
                          + {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={custSubmitting}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {custSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing with AI Support Engine...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Support Ticket
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Submission Result Card */
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={`p-5 rounded-xl border flex items-start gap-3.5 ${
                    custSubmissionResult.status === 'resolved'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    {custSubmissionResult.status === 'resolved' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-base text-white">
                          {custSubmissionResult.status === 'resolved' 
                            ? 'Ticket Automatically Resolved by AI Engine' 
                            : 'Ticket Prioritized & Escalated to Senior Team'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-blue-400 border border-slate-700">
                          #TKT-{custSubmissionResult.ticket_id}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        {custSubmissionResult.status === 'resolved'
                          ? 'Our knowledge-grounded AI support engine successfully analyzed and answered your inquiry below.'
                          : 'Our automated safety gate has escalated your request to a senior ZENIVIXON engineer. We will review your context and contact you at ' + custEmail + ' shortly.'}
                      </p>
                    </div>
                  </div>

                  {/* Grounded Response / Solution */}
                  {custSubmissionResult.draft_response && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-emerald-400" /> Official Response:
                        </span>
                        <button
                          onClick={() => handleCopy(custSubmissionResult.draft_response || "")}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-[#070B14] p-4 rounded-lg border border-slate-800">
                        {custSubmissionResult.draft_response}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-slate-400 font-mono">
                      Save Ticket ID <strong className="text-white">#TKT-{custSubmissionResult.ticket_id}</strong> for tracking.
                    </p>
                    <button
                      onClick={() => {
                        setCustSubmissionResult(null);
                        setCustMessage('');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all"
                    >
                      Submit Another Ticket
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW B: TRACK TICKET STATUS */}
          {customerSubTab === 'track' && (
            <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-400" /> Track Existing Support Ticket
                </h3>
                <p className="text-xs text-slate-400">
                  Enter your numeric Ticket ID (e.g. 26 or #TKT-26) to see live status, findings, and responses.
                </p>
              </div>

              <form onSubmit={handleCustomerTrack} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={trackInputId}
                  onChange={e => setTrackInputId(e.target.value)}
                  placeholder="Enter Ticket ID (e.g. 26)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 shrink-0"
                >
                  {trackLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Track
                </button>
              </form>

              {trackError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{trackError}</span>
                </div>
              )}

              {trackResult && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-blue-400">Ticket #{trackResult.id}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">{trackResult.customer.email}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      trackResult.status === 'resolved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : trackResult.status === 'escalated'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {trackResult.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Your Submitted Message:</p>
                    <p className="text-xs text-slate-300 italic bg-slate-900 p-3 rounded-lg border border-slate-800">
                      &ldquo;{trackResult.raw_message}&rdquo;
                    </p>
                  </div>

                  {trackResult.draft_response ? (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Official Response / Resolution:</p>
                      <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#070B14] p-3.5 rounded-lg border border-slate-800">
                        {trackResult.draft_response}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      This ticket is currently under review by our senior support engineers. We will update you via email soon.
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2">
                    <span>Category: {trackResult.category}</span>
                    <span>Created: {trackResult.created_at ? new Date(trackResult.created_at).toLocaleString() : '--'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODE 2: PROTECTED TEAM OPERATIONS CONSOLE
          ───────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'team' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          
          {/* Team Console Top Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  INTERNAL OPERATIONS
                </span>
                <span className="text-xs text-slate-500">Authorized Session</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white mt-0.5">Support AI Telemetry & Triage Engine</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('customer')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Customer Portal
              </button>

              <button
                onClick={() => { fetchStats(); fetchTickets(); }}
                disabled={refreshingTickets}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Sync database records"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingTickets ? 'animate-spin text-blue-400' : ''}`} />
                Sync DB
              </button>
            </div>
          </div>

          {/* Sub Navigation: Operations vs Tickets */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTeamTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTeamTab === 'dashboard'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Operations Console
            </button>
            <button
              onClick={() => { setActiveTeamTab('tickets'); fetchTickets(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTeamTab === 'tickets'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Inbox className="w-4 h-4" /> Inbound Ticket Ledger ({tickets.length})
            </button>
          </div>

          {activeTeamTab === 'dashboard' ? (
            <div className="space-y-6">
              
              {/* KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0D1527] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tickets</p>
                      <h3 className="text-3xl font-extrabold mt-1 text-white">{stats ? stats['Tickets Today'] : '--'}</h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Inbox className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span> Recorded in PostgreSQL ledger
                  </p>
                </div>

                <div className="bg-[#0D1527] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Autonomous Resolved</p>
                      <h3 className="text-3xl font-extrabold mt-1 text-emerald-400">{stats ? stats['AI Resolved'] : '--'}</h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-400/80 mt-3 font-semibold">
                    {stats ? stats['Resolution Rate'] : '--'} Resolution Rate
                  </p>
                </div>

                <div className="bg-[#0D1527] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Human Escalated</p>
                      <h3 className="text-3xl font-extrabold mt-1 text-amber-400">{stats ? stats['Human Escalated'] : '--'}</h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-400/80 mt-3 font-semibold">
                    {stats ? stats['Escalation Rate'] : '--'} Safety Escalation Rate
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-5 rounded-2xl relative overflow-hidden shadow-lg text-white flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">Pipeline Latency</p>
                      <Zap className="w-4 h-4 text-blue-200" />
                    </div>
                    <h3 className="text-3xl font-extrabold mt-1">~ 2.1 sec</h3>
                  </div>
                  <p className="text-[11px] text-blue-200 mt-3">
                    LangGraph 6-Node Execution
                  </p>
                </div>
              </div>

              {/* Inbound Ticket Simulator with Quick Presets */}
              <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-md">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" /> Agent Simulator & Quick Discovery Presets
                  </h3>
                  <p className="text-xs text-slate-400">
                    Test how the LangGraph pipeline categorizes, retrieves knowledge, executes tools, and evaluates safety.
                  </p>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                  {PRESET_SCENARIOS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSimEmail(preset.email);
                        setSimMessage(preset.message);
                      }}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/60 text-left transition-all group"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {preset.tag}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs font-semibold text-slate-200 truncate">{preset.label}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{preset.email}</p>
                    </button>
                  ))}
                </div>

                {/* Simulation Form */}
                <form onSubmit={simulateTicket} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Customer Email</label>
                      <input
                        type="email"
                        value={simEmail}
                        onChange={e => setSimEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Customer Message</label>
                      <input
                        type="text"
                        value={simMessage}
                        onChange={e => setSimMessage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loadingSim}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                      {loadingSim ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Running Agent...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Run Autonomous Triage
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Visual LangGraph 6-Node Architecture */}
              <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-md">
                <h3 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-emerald-400" /> LangGraph Architecture Pipeline Flow
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { step: "1", name: "Intake", desc: "LLM Classification", icon: Bot, color: "text-purple-400" },
                    { step: "2", name: "Verify", desc: "Customer ID & Tier", icon: User, color: "text-blue-400" },
                    { step: "3", name: "Tools / RAG", desc: "Qdrant Vector KB", icon: BookOpen, color: "text-emerald-400" },
                    { step: "4", name: "Resolution", desc: "Gemini 3.6 Flash", icon: Sparkles, color: "text-amber-400" },
                    { step: "5", name: "Safety Gate", desc: "Escalation Policy", icon: ShieldCheck, color: "text-rose-400" },
                    { step: "6", name: "Outcome", desc: "Resolved / Zendesk", icon: CheckCircle2, color: "text-emerald-400" },
                  ].map((node, i) => (
                    <div key={i} className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold text-slate-500">#{node.step}</span>
                        <node.icon className={`w-4 h-4 ${node.color}`} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">{node.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{node.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulation Output Card */}
              {latestSimTicket && (
                <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                        Ticket #{latestSimTicket.ticket_id}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        latestSimTicket.status === 'resolved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {latestSimTicket.status === 'resolved' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> AI Resolved
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" /> Escalated to Human
                          </>
                        )}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs bg-slate-800 text-slate-300 border border-slate-700">
                        Category: {latestSimTicket.category || "General"}
                      </span>
                    </div>

                    {latestSimTicket.draft_response && (
                      <button
                        onClick={() => handleCopy(latestSimTicket.draft_response || "")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied!" : "Copy Response"}
                      </button>
                    )}
                  </div>

                  {latestSimTicket.status === 'escalated' ? (
                    <HandoffPackage ticket={{
                      customer: { 
                        email: simEmail, 
                        isVerified: Boolean(latestSimTicket.is_verified), 
                        tier: latestSimTicket.is_verified ? "standard" : "none" 
                      },
                      rawMessage: simMessage,
                      category: latestSimTicket.category || "General",
                      intent: latestSimTicket.intent || "Inquiry",
                      priority: latestSimTicket.priority || "Medium",
                      aiFindings: latestSimTicket.ai_findings || "",
                      toolsExecuted: latestSimTicket.tools_executed || [],
                      escalationReason: latestSimTicket.escalation_reason || "Autonomous processing escalation."
                    }} />
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-emerald-400" /> Grounded AI Solution Drafted:
                          </span>
                          <span className="text-[11px] text-emerald-400 font-mono">Grounded by ZENIVIXON Master KB</span>
                        </div>
                        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-[#070B14] p-4 rounded-xl border border-slate-800/80">
                          {latestSimTicket.draft_response || "Inquiry processed and closed."}
                        </div>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-blue-400" /> LangGraph Telemetry Execution Trace:
                        </p>
                        <div className="space-y-1.5 font-mono text-xs text-slate-300">
                          {latestSimTicket.trace?.map((step: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
                              <span className="text-blue-400 select-none">[{idx + 1}]</span>
                              <span className="text-slate-200">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Inbound Ticket Ledger */
            <div className="bg-[#0D1527] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="p-5 border-b border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-base text-white">Live Inbound Ticket Ledger</h3>
                    <p className="text-xs text-slate-400">Total tickets recorded in Neon PostgreSQL: {tickets.length}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search email, ticket ID, or message..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="resolved">Resolved</option>
                      <option value="escalated">Escalated</option>
                      <option value="open">Open / Processing</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="General">General</option>
                      <option value="Technical">Technical</option>
                      <option value="Billing">Billing</option>
                      <option value="Product">Product</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tickets matched your filter criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4">Ticket</th>
                        <th className="py-3.5 px-4">Customer</th>
                        <th className="py-3.5 px-4 max-w-sm">Message Snippet</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Priority</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Timestamp</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredTickets.map(t => (
                        <tr 
                          key={t.id} 
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          onClick={() => openTicketDetail(t.id)}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">
                            #{t.id}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-200">{t.customer_email}</p>
                            <span className="text-[10px] text-slate-500 capitalize">{t.customer_tier} tier</span>
                          </td>
                          <td className="py-3 px-4 max-w-sm">
                            <p className="truncate text-slate-300" title={t.raw_message}>
                              {t.raw_message}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                              {t.category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              t.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              t.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              t.status === 'escalated' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {t.status === 'resolved' ? <CheckCircle2 className="w-3 h-3" /> :
                               t.status === 'escalated' ? <AlertTriangle className="w-3 h-3" /> :
                               <Clock className="w-3 h-3" />}
                              {t.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {t.created_at ? new Date(t.created_at).toLocaleDateString() : '--'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openTicketDetail(t.id);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-all"
                              title="Inspect ticket"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TEAM PASSCODE AUTHENTICATION MODAL
          ───────────────────────────────────────────────────────────────────────────── */}
      {showPasscodeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">Team Console Access</h3>
              </div>
              <button
                onClick={() => setShowPasscodeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Please enter the team access passcode to view live agent telemetry and internal operations ledger.
            </p>

            <form onSubmit={handleVerifyPasscode} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  value={passcodeInput}
                  onChange={e => { setPasscodeInput(e.target.value); setPasscodeError(false); }}
                  placeholder="Enter passcode"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                {passcodeError && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Incorrect passcode. Please enter the valid team passcode.
                  </p>
                )}

              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all"
                >
                  Authorize Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TICKET INSPECTOR MODAL (TEAM CONSOLE)
          ───────────────────────────────────────────────────────────────────────────── */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#0D1527] z-10">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-blue-400">
                  Ticket #{selectedTicketId}
                </span>
                {ticketDetail && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    ticketDetail.status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : ticketDetail.status === 'escalated'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {ticketDetail.status}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {loadingDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  <p className="text-sm">Loading ticket telemetry...</p>
                </div>
              ) : ticketDetail ? (
                <>
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-semibold">Customer</p>
                      <p className="text-sm font-bold text-white mt-0.5">{ticketDetail.customer.email}</p>
                      <p className="text-xs text-slate-500 capitalize">{ticketDetail.customer.name} • {ticketDetail.customer.tier} Tier</p>
                    </div>
                    <div>
                      {ticketDetail.customer.is_verified ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified ID
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Original Message</p>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 italic">
                      &ldquo;{ticketDetail.raw_message}&rdquo;
                    </div>
                  </div>

                  {ticketDetail.draft_response && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-emerald-400" /> Grounded AI Solution
                      </p>
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {ticketDetail.draft_response}
                      </div>
                    </div>
                  )}

                  {ticketDetail.escalation_reason && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                      <span className="font-bold flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-4 h-4 text-rose-400" /> Escalation Trigger:
                      </span>
                      {ticketDetail.escalation_reason}
                    </div>
                  )}

                  {ticketDetail.tools_executed && ticketDetail.tools_executed.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tools Executed</p>
                      <div className="space-y-1.5">
                        {ticketDetail.tools_executed.map((tool, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                            <span className="font-mono text-blue-400">{tool.name || tool.tool || 'tool'}()</span>
                            <span className="text-slate-400">{tool.result || tool.data || 'Completed'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {ticketDetail && (
              <div className="p-5 border-t border-slate-800 flex justify-between items-center bg-[#0D1527] sticky bottom-0">
                <span className="text-xs text-slate-500">Update status:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus(ticketDetail.id, 'resolved')}
                    disabled={updatingStatus || ticketDetail.status === 'resolved'}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(ticketDetail.id, 'escalated')}
                    disabled={updatingStatus || ticketDetail.status === 'escalated'}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Human
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

