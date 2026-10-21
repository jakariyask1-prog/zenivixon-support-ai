import React from 'react';
import { User, AlertCircle, Bot, Activity, CheckCircle2, AlertTriangle, MessageSquare, ShieldAlert, Zap, Terminal } from 'lucide-react';

export interface HandoffCustomer {
  email: string;
  isVerified: boolean;
  tier: string;
}

export interface ToolExecutionItem {
  name?: string;
  tool?: string;
  result?: string;
  data?: string;
}

export interface HandoffTicket {
  customer: HandoffCustomer;
  rawMessage: string;
  category: string;
  intent: string;
  priority: string;
  aiFindings: string;
  toolsExecuted: ToolExecutionItem[];
  escalationReason: string;
  churnRiskScore?: number;
  recommendedAction?: string;
}

export default function HandoffPackage({ ticket }: { ticket: HandoffTicket | null }) {
  if (!ticket) return null;

  // Smart Retention Logic (using backend computed values or high-fidelity fallback)
  const isEnterprise = ticket.customer.tier.toLowerCase() === 'enterprise';
  const isCritical = ticket.priority.toLowerCase() === 'critical';
  
  let churnRiskScore = ticket.churnRiskScore ?? 35;
  if (ticket.churnRiskScore === undefined || ticket.churnRiskScore === null) {
    if (isCritical) churnRiskScore += 40;
    if (isEnterprise) churnRiskScore += 15;
    if (ticket.escalationReason.toLowerCase().includes('angry')) churnRiskScore += 10;
    churnRiskScore = Math.min(churnRiskScore, 98);
  }

  const retentionPoints = ticket.recommendedAction || (isEnterprise
    ? "Enterprise VIP Account: Waive SLA penalty, assign Lead Solutions Architect, schedule 1-on-1 recovery call."
    : isCritical
    ? "Critical Risk: Lead with empathy, confirm timeline under 2 hours, offer service credit upon resolution."
    : "Standard Tier: Acknowledge ticket, review recent account history, provide clear ETA.");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/20 via-slate-900/80 to-slate-950/90 backdrop-blur-xl shadow-[0_12px_40px_-10px_rgba(244,63,94,0.15)] mt-6">
      {/* Top Ambient Glow Line */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-80" />

      {/* Header */}
      <div className="px-6 py-4 border-b border-rose-500/20 bg-rose-500/5 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-rose-200 tracking-wide flex items-center gap-2">
              Human Escalation Package
            </h3>
            <p className="text-[11px] text-rose-300/70">
              Autonomous handoff protocol triggered &bull; L2 Solutions Engineering queue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Churn Risk: {churnRiskScore}%
          </span>
          <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-full uppercase tracking-wider shadow-sm">
            {ticket.priority} Priority
          </span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Issue */}
        <div className="space-y-5 lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-6 lg:pb-0 lg:pr-6">
          <div>
            <h4 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> Verified Customer Profile
            </h4>
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-inner">
              <p className="text-sm font-bold text-white break-all">{ticket.customer.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                {ticket.customer.isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Verified ID
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-semibold">
                    <AlertTriangle className="w-3 h-3" /> Unverified
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 text-[11px] capitalize font-medium">
                  {ticket.customer.tier} Tier
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> Raw Customer Inquiry
            </h4>
            <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold rounded uppercase tracking-wider">
                  {ticket.category}
                </span>
                <span className="text-xs text-amber-300/80 font-medium">{ticket.intent}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed italic bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                &ldquo;{ticket.rawMessage}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis & Handoff */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h4 className="text-[10px] font-bold tracking-widest text-blue-400 uppercase mb-2 flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-blue-400" /> Autonomous Multi-Agent Synthesis
            </h4>
            <div className="bg-blue-950/20 border border-blue-500/20 p-4 rounded-xl text-xs text-slate-200 leading-relaxed shadow-inner">
              {ticket.aiFindings || "Inquiry evaluated through intent routing and enterprise knowledge store."}
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-2 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> Recommended Account Retention Playbook
            </h4>
            <div className="bg-purple-950/20 border border-purple-500/20 p-4 rounded-xl text-xs text-purple-200 leading-relaxed font-medium">
              {retentionPoints}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Tools & API Context
              </h4>
              <ul className="space-y-2">
                {ticket.toolsExecuted.length > 0 ? (
                  ticket.toolsExecuted.map((tool, idx) => {
                    const toolName = tool.name || tool.tool || 'tool';
                    const toolResult = tool.result || tool.data || 'Completed';
                    return (
                      <li key={idx} className="flex items-start gap-2.5 text-xs bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-blue-400 font-mono text-[11px] block truncate font-semibold">
                            {toolName}()
                          </span>
                          <span className="text-slate-300 mt-0.5 block truncate text-[11px]">{toolResult}</span>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-xs text-slate-400 italic bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    Direct handoff triggered before secondary tool execution.
                  </li>
                )}
              </ul>
            </div>
            
            <div>
              <h4 className="text-[10px] font-bold tracking-widest text-rose-400 uppercase mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Escalation Gate Trigger
              </h4>
              <div className="bg-rose-950/20 border border-rose-500/20 p-3.5 rounded-xl text-xs text-rose-300 font-medium leading-relaxed">
                {ticket.escalationReason}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap justify-end gap-3">
            <button className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
              Dismiss
            </button>
            <button className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" /> Start Replying in Zendesk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
