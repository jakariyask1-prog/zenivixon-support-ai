import React from 'react';
import { User, AlertCircle, Bot, Activity, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';

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
}

export default function HandoffPackage({ ticket }: { ticket: HandoffTicket | null }) {
  if (!ticket) return null;

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-red-200 dark:border-red-900/50 rounded-2xl shadow-xl overflow-hidden mt-6">
      {/* Header */}
      <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h3 className="font-bold text-red-900 dark:text-red-300 font-heading">Human Escalation Required</h3>
        </div>
        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold rounded-full uppercase tracking-widest">
          {ticket.priority} Priority
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Customer & Issue */}
        <div className="space-y-6 lg:col-span-1 border-r border-slate-100 dark:border-slate-800 pr-6">
          <div>
            <h4 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3">Customer Context</h4>
            <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <User className="w-4 h-4 text-slate-500 mt-1" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ticket.customer.email}</p>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  {ticket.customer.isVerified ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Verified ID
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-slate-500 capitalize">{ticket.customer.tier} Tier</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3">Original Issue</h4>
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded uppercase">
                  {ticket.category}
                </span>
                <span className="text-xs text-amber-600/70 font-medium">{ticket.intent}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                &ldquo;{ticket.rawMessage}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis & Handoff */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h4 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4" /> AI Analysis & Findings
            </h4>
            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {ticket.aiFindings}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Tools Executed
              </h4>
              <ul className="space-y-2">
                {ticket.toolsExecuted.map((tool, idx) => {
                  const toolName = tool.name || tool.tool || 'tool';
                  const toolResult = tool.result || tool.data || 'Completed';
                  return (
                    <li key={idx} className="flex items-start gap-2 text-sm bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {toolName}()<br />
                        <span className="text-slate-900 dark:text-slate-200 font-sans mt-0.5 block">{toolResult}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div>
              <h4 className="text-[11px] font-bold tracking-widest text-red-400 uppercase mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Escalation Reason
              </h4>
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl text-sm text-red-800 dark:text-red-300 font-medium">
                {ticket.escalationReason}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
              Dismiss
            </button>
            <button className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-700 hover:to-violet-700 rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Start Replying
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

