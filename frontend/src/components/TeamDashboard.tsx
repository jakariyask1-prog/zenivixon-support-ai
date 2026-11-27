"use client";

import React, { useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Zap,
  TrendingUp,
  PieChart,
  Terminal,
  ChevronRight,
  RefreshCw,
  Send,
  Activity,
  Bot,
  User,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import HandoffPackage from '@/components/HandoffPackage';
import { Language, TRANSLATIONS, PRESET_SCENARIOS } from '@/lib/translations';
import { DashboardStats, TicketListItem, LatestTicketResponse } from '@/types/support';
import { isJsonResponse } from '@/lib/api';

interface TeamDashboardProps {
  lang: Language;
  apiBase: string;
  adminPasscode?: string;
  isDemoPreview?: boolean;
  stats: DashboardStats | null;
  tickets: TicketListItem[];
  onRefresh: () => void;
}

export default function TeamDashboard({
  lang,
  apiBase,
  adminPasscode = '',
  isDemoPreview = false,
  stats,
  tickets,
  onRefresh,
}: TeamDashboardProps) {
  const t = TRANSLATIONS[lang];
  const [simEmail, setSimEmail] = useState(PRESET_SCENARIOS[0].email);
  const [simMessage, setSimMessage] = useState(PRESET_SCENARIOS[0].message);
  const [loadingSim, setLoadingSim] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [latestSimTicket, setLatestSimTicket] = useState<LatestTicketResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildLocalPreviewSimulation = (email: string, message: string): LatestTicketResponse => {
    const lower = message.toLowerCase();
    const isCritical = lower.includes('refund') || lower.includes('unacceptable') || lower.includes('ক্ষতি') || lower.includes('রিফান্ড');
    const isEnterprise = email.toLowerCase().includes('enterprise');
    return {
      ticket_id: 901,
      customer_email: email,
      customer_tier: isEnterprise ? 'enterprise' : 'standard',
      raw_message: message,
      status: isCritical ? 'escalated' : 'resolved',
      category: lower.includes('ord-') ? 'Order' : isCritical ? 'Billing' : 'General',
      intent: 'Demo Preview Simulation',
      priority: isCritical ? 'Critical' : isEnterprise ? 'High' : 'Low',
      sentiment: isCritical ? 'Angry' : 'Neutral',
      churn_risk_score: isCritical ? 85 : isEnterprise ? 55 : 20,
      processing_time_ms: 210,
      is_verified: email !== 'visitor@techcorp.io',
      draft_response: isCritical
        ? undefined
        : 'Demo Preview Response: Ticket analyzed through ZENIVIXON 6-node LangGraph architecture with grounded RAG & tenant-isolated tool context.',
      ai_findings: 'Demo Preview Mode: Simulated LangGraph execution without active backend write.',
      escalation_reason: isCritical
        ? 'Fast-track Escalation: Critical/Angry inquiry routed directly to human engineering.'
        : undefined,
      recommended_action: isEnterprise
        ? 'Enterprise VIP Account: Prioritize immediately, assign Lead Solutions Architect, and offer 20% SLA courtesy credit.'
        : isCritical
        ? 'Critical Risk: Lead with active empathy, guarantee resolution within 2 hours, and offer retention goodwill credit.'
        : 'Standard Priority: Provide standard troubleshooting documentation and friendly confirmation.',
      tools_executed: lower.includes('ord-')
        ? [{ name: 'get_order', result: 'Simulated Order lookup (Demo Preview)' }]
        : [],
      trace: [
        '1. Intake complete (Demo Preview)',
        '2. Customer identity checked',
        '3. RAG & Tenant-isolated tools evaluated',
        isCritical ? '6. Fast-track escalated to Zendesk queue' : '4-6. Grounded draft verified & resolved',
      ],
    };
  };

  const simulateTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simMessage.trim() || !simEmail.trim()) return;

    setLoadingSim(true);
    setSimError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminPasscode) {
        headers['X-Admin-Passcode'] = adminPasscode;
      }
      const res = await fetch(`${apiBase}/api/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: simEmail.trim(),
          message: simMessage.trim(),
        }),
      });
      if (res.ok && isJsonResponse(res)) {
        const data: LatestTicketResponse = await res.json();
        setLatestSimTicket(data);
        if (!isDemoPreview) {
          onRefresh();
        }
      } else if (isDemoPreview) {
        setLatestSimTicket(buildLocalPreviewSimulation(simEmail.trim(), simMessage.trim()));
      } else {
        const err = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        const detail = typeof err.detail === 'string' ? err.detail : 'Simulation failed. Check input and backend logs.';
        setSimError(detail);
      }
    } catch {
      if (isDemoPreview) {
        setLatestSimTicket(buildLocalPreviewSimulation(simEmail.trim(), simMessage.trim()));
      } else {
        setSimError('Unable to reach backend API for simulation.');
      }
    } finally {
      setLoadingSim(false);
    }
  };

  const totalTickets = stats?.['Total Tickets'] ?? stats?.['Tickets Today'] ?? tickets.length;
  const ticketsToday = stats?.['Tickets Today'] ?? 0;

  const avgChurnVal =
    stats?.average_churn_risk_value ??
    (stats?.['Average Churn Risk'] ? parseFloat(stats['Average Churn Risk']) : 0);

  const riskBadge =
    avgChurnVal >= 60
      ? { label: 'High Risk', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' }
      : avgChurnVal >= 35
      ? { label: 'Moderate', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
      : { label: t.healthy, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };

  const latencyDisplay =
    stats?.average_latency_ms != null
      ? stats.average_latency_ms >= 1000
        ? `${(stats.average_latency_ms / 1000).toFixed(2)} sec`
        : `${stats.average_latency_ms} ms`
      : 'No data yet';

  const dailyTrend = stats?.daily_trend ?? [];
  const maxTrendVal = Math.max(...dailyTrend.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-5 shadow-lg">
          <div className="absolute top-0 inset-x-0 h-0.5 bg-blue-500/60" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.kpiTotal}</p>
              <h3 className="text-3xl font-black mt-1 text-white tracking-tight">{stats ? totalTickets : '--'}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
            {stats ? `${ticketsToday} today • ${t.kpiTotalSub}` : t.kpiTotalSub}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-5 shadow-lg">
          <div className="absolute top-0 inset-x-0 h-0.5 bg-emerald-500/60" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.kpiResolved}</p>
              <h3 className="text-3xl font-black mt-1 text-emerald-400 tracking-tight">
                {stats ? stats['AI Resolved'] : '--'}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-400 mt-3 font-bold">
            {stats ? stats['Resolution Rate'] : '--'} {t.resolutionRate}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-5 shadow-lg">
          <div className="absolute top-0 inset-x-0 h-0.5 bg-amber-500/60" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.kpiEscalated}</p>
              <h3 className="text-3xl font-black mt-1 text-amber-400 tracking-tight">
                {stats ? stats['Human Escalated'] : '--'}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-amber-400 mt-3 font-bold">
            {stats ? stats['Escalation Rate'] : '--'} {t.escalationRate}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-5 shadow-lg">
          <div className="absolute top-0 inset-x-0 h-0.5 bg-purple-500/60" />
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.kpiAvgChurn}</p>
              <h3 className="text-3xl font-black mt-1 text-purple-400 tracking-tight">
                {stats ? stats['Average Churn Risk'] || '0.0%' : '--'}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-purple-300 mt-3 font-bold">{riskBadge.label}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-5 shadow-xl text-white flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <p className="text-[11px] font-bold text-blue-100 uppercase tracking-wider">{t.kpiLatency}</p>
              <Zap className="w-4 h-4 text-cyan-200" />
            </div>
            <h3 className="text-3xl font-black mt-1 tracking-tight">{latencyDisplay}</h3>
          </div>
          <p className="text-[11px] text-blue-100 mt-3 font-medium">{t.kpiLatencySub}</p>
        </div>
      </div>

      {/* Live Monitoring Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xl">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> {t.trendTitle}
              </h3>
              <p className="text-xs text-slate-400">{t.trendDesc}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-blue-500"></span> {t.trendTotal}
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-3 rounded-sm bg-emerald-500"></span> {t.trendResolved}
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-3 rounded-sm bg-amber-500"></span> {t.trendEscalated}
              </span>
            </div>
          </div>

          {dailyTrend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500 border-b border-slate-800">
              No 7-day trend data recorded yet. Submit a ticket to populate live telemetry.
            </div>
          ) : (
            <div className="h-48 w-full flex items-end justify-between gap-3 pt-4 pb-2 px-2 border-b border-slate-800">
              {dailyTrend.map((item, idx) => {
                const totalH = item.total > 0 ? Math.max(10, Math.round((item.total / maxTrendVal) * 140)) : 2;
                const resH = item.resolved > 0 ? Math.max(8, Math.round((item.resolved / maxTrendVal) * 140)) : 2;
                const escH = item.escalated > 0 ? Math.max(6, Math.round((item.escalated / maxTrendVal) * 140)) : 2;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="w-full flex items-end justify-center gap-1.5 h-36 pb-1">
                      <div
                        style={{ height: `${totalH}px` }}
                        className="w-2.5 sm:w-3.5 bg-gradient-to-t from-blue-700 to-cyan-500 hover:brightness-125 rounded-t-md transition-all shadow-sm"
                        title={`${item.date} — Total: ${item.total}`}
                      />
                      <div
                        style={{ height: `${resH}px` }}
                        className="w-2.5 sm:w-3.5 bg-gradient-to-t from-emerald-700 to-emerald-400 hover:brightness-125 rounded-t-md transition-all shadow-sm"
                        title={`${item.date} — AI Resolved: ${item.resolved}`}
                      />
                      <div
                        style={{ height: `${escH}px` }}
                        className="w-2.5 sm:w-3.5 bg-gradient-to-t from-amber-700 to-amber-400 hover:brightness-125 rounded-t-md transition-all shadow-sm"
                        title={`${item.date} — Escalated: ${item.escalated}`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" /> {t.catDistribution}
              </h3>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
                {t.liveDistribution}
              </span>
            </div>

            <div className="space-y-2.5 mt-1">
              {[
                { name: 'Order & Shipping', key: 'Order', color: 'bg-blue-500' },
                { name: 'Billing', key: 'Billing', color: 'bg-amber-500' },
                { name: 'Refund', key: 'Refund', color: 'bg-orange-500' },
                { name: 'Technical / API', key: 'Technical', color: 'bg-rose-500' },
                { name: 'Account & Security', key: 'Account', extraKey: 'Security', color: 'bg-cyan-500' },
                { name: 'Subscription', key: 'Subscription', color: 'bg-indigo-500' },
                { name: 'General Inquiry', key: 'General', color: 'bg-emerald-500' },
              ].map((cat, idx) => {
                const primaryCount = stats?.category_breakdown?.[cat.key] ?? 0;
                const extraCount = cat.extraKey ? stats?.category_breakdown?.[cat.extraKey] ?? 0 : 0;
                const count = primaryCount + extraCount;
                const pct = totalTickets > 0 ? Math.min(100, Math.round((count / totalTickets) * 100)) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{cat.name}</span>
                      <span className="text-slate-400 font-mono">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                      <div
                        style={{ width: `${pct > 0 ? Math.max(pct, 4) : 0}%` }}
                        className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.portfolioRisk}</p>
                <p className="text-xs font-black text-white">{stats?.['Average Churn Risk'] || '0.0%'} Average</p>
              </div>
            </div>
            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border uppercase tracking-wide ${riskBadge.cls}`}>
              {riskBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Inbound Ticket Simulator */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xl">
        <div className="mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" /> {t.simulatorTitle}
          </h3>
          <p className="text-xs text-slate-400">{t.simulatorDesc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
          {PRESET_SCENARIOS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSimEmail(preset.email);
                setSimMessage(preset.message);
              }}
              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/90 text-left transition-all group shadow-sm"
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-cyan-300 border border-blue-500/30">
                  {preset.tag}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs font-bold text-slate-200 truncate">{preset.label}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{preset.email}</p>
            </button>
          ))}
        </div>

        <form onSubmit={simulateTicket} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.simEmailLabel}</label>
              <input
                type="email"
                value={simEmail}
                onChange={e => setSimEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.simMessageLabel}</label>
              <input
                type="text"
                value={simMessage}
                onChange={e => setSimMessage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
                required
              />
            </div>
          </div>

          {simError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{simError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loadingSim}
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loadingSim ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.simRunningBtn}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t.simRunBtn}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Visual LangGraph 6-Node Architecture */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xl">
        <h3 className="text-xs font-extrabold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-emerald-400" /> {t.architectureTitle}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { step: '1', name: t.node1, desc: t.node1Desc, icon: Bot, color: 'text-purple-400' },
            { step: '2', name: t.node2, desc: t.node2Desc, icon: User, color: 'text-cyan-400' },
            { step: '3', name: t.node3, desc: t.node3Desc, icon: BookOpen, color: 'text-emerald-400' },
            { step: '4', name: t.node4, desc: t.node4Desc, icon: Sparkles, color: 'text-amber-400' },
            { step: '5', name: t.node5, desc: t.node5Desc, icon: ShieldCheck, color: 'text-rose-400' },
            { step: '6', name: t.node6, desc: t.node6Desc, icon: CheckCircle2, color: 'text-emerald-400' },
          ].map((node, i) => (
            <div
              key={i}
              className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 p-3.5 rounded-2xl flex flex-col justify-between transition-all group shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-black text-slate-500">#{node.step}</span>
                <node.icon className={`w-4 h-4 ${node.color} group-hover:scale-110 transition-transform`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">{node.name}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{node.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulation Output Card */}
      {latestSimTicket && (
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-800/80 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-cyan-300 border border-blue-500/30 font-mono">
                Ticket #{latestSimTicket.ticket_id}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  latestSimTicket.status === 'resolved'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
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
              <span className="px-2.5 py-0.5 rounded-lg text-xs bg-slate-900 text-slate-300 border border-slate-800">
                Category: {latestSimTicket.category || 'General'}
              </span>
              {latestSimTicket.processing_time_ms != null && (
                <span className="text-xs font-mono text-slate-400">
                  {latestSimTicket.processing_time_ms} ms
                </span>
              )}
            </div>

            {latestSimTicket.draft_response && (
              <button
                type="button"
                onClick={() => handleCopy(latestSimTicket.draft_response || '')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 transition-all border border-slate-700 shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Response'}</span>
              </button>
            )}
          </div>

          {latestSimTicket.status === 'escalated' ? (
            <HandoffPackage
              onDismiss={() => setLatestSimTicket(null)}
              ticket={{
                customer: {
                  email: latestSimTicket.customer_email || simEmail,
                  isVerified: Boolean(latestSimTicket.is_verified),
                  tier: latestSimTicket.customer_tier || 'standard',
                },
                rawMessage: latestSimTicket.raw_message || simMessage,
                category: latestSimTicket.category || 'General',
                intent: latestSimTicket.intent || 'Inquiry',
                priority: latestSimTicket.priority || 'Medium',
                aiFindings: latestSimTicket.ai_findings || '',
                toolsExecuted: latestSimTicket.tools_executed || [],
                escalationReason: latestSimTicket.escalation_reason || 'Autonomous processing escalation.',
                churnRiskScore: latestSimTicket.churn_risk_score,
                recommendedAction: latestSimTicket.recommended_action,
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-white/[0.08] p-5 rounded-2xl shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-emerald-400" /> Grounded AI Solution Drafted:
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">Grounded by ZENIVIXON Master KB</span>
                </div>
                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-[#050811] p-4 rounded-xl border border-slate-800/80">
                  {latestSimTicket.draft_response || 'Inquiry processed and closed.'}
                </div>
              </div>

              {latestSimTicket.recommended_action && (
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs text-purple-200 font-medium">
                      <strong>Retention Guidance:</strong> {latestSimTicket.recommended_action}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 whitespace-nowrap">
                    Churn Risk: {latestSimTicket.churn_risk_score || 20}%
                  </span>
                </div>
              )}

              <div className="bg-slate-950/80 border border-white/[0.08] p-5 rounded-2xl shadow-inner">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" /> LangGraph Telemetry Execution Trace:
                </p>
                <div className="space-y-1.5 font-mono text-xs text-slate-300">
                  {latestSimTicket.trace?.map((step: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 bg-[#050811] px-3.5 py-2 rounded-xl border border-slate-800/60 shadow-sm"
                    >
                      <span className="text-cyan-400 select-none font-bold">[{idx + 1}]</span>
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
  );
}
