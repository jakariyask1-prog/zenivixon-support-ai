"use client";

import React from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, Bot, ShieldAlert } from 'lucide-react';
import { Language, TRANSLATIONS } from '@/lib/translations';
import { TicketDetailModalData } from '@/types/support';

interface TicketInspectorModalProps {
  lang: Language;
  selectedTicketId: number | null;
  ticketDetail: TicketDetailModalData | null;
  loadingDetail: boolean;
  updatingStatus: boolean;
  onClose: () => void;
  onUpdateStatus: (id: number, status: string) => void;
}

export default function TicketInspectorModal({
  lang,
  selectedTicketId,
  ticketDetail,
  loadingDetail,
  updatingStatus,
  onClose,
  onUpdateStatus,
}: TicketInspectorModalProps) {
  if (!selectedTicketId) return null;
  const t = TRANSLATIONS[lang];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/95 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="p-5 border-b border-white/[0.08] flex justify-between items-center sticky top-0 bg-slate-950/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-black text-cyan-400">
              Ticket #{selectedTicketId}
            </span>
            {ticketDetail && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                ticketDetail.status === 'resolved'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : ticketDetail.status === 'escalated'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {ticketDetail.status}
              </span>
            )}
            {ticketDetail?.processing_time_ms != null && (
              <span className="text-[11px] font-mono text-slate-400">
                {ticketDetail.processing_time_ms} ms
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 flex-1">
          {loadingDetail ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <p className="text-sm font-medium">Loading ticket telemetry...</p>
            </div>
          ) : ticketDetail ? (
            <>
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Customer</p>
                  <p className="text-sm font-bold text-white mt-0.5">{ticketDetail.customer.email}</p>
                  <p className="text-xs text-slate-400 capitalize">
                    {ticketDetail.customer.name} &bull; {ticketDetail.customer.tier} Tier
                  </p>
                </div>
                <div>
                  {ticketDetail.customer.is_verified ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified ID
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.rawInquiryTitle}</p>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 italic shadow-inner">
                  &ldquo;{ticketDetail.raw_message}&rdquo;
                </div>
              </div>

              {ticketDetail.draft_response && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-emerald-400" /> {t.officialResponseModal}
                  </p>
                  <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap shadow-inner">
                    {ticketDetail.draft_response}
                  </div>
                </div>
              )}

              <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-purple-400" /> {t.retentionAdvisorTitle} ({ticketDetail.churn_risk_score ?? 20}%)
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    (ticketDetail.churn_risk_score ?? 20) >= 60 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    (ticketDetail.churn_risk_score ?? 20) >= 35 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {(ticketDetail.churn_risk_score ?? 20) >= 60 ? 'High Risk Account' :
                     (ticketDetail.churn_risk_score ?? 20) >= 35 ? 'Medium Retention Risk' : 'Low Churn Risk'}
                  </span>
                </div>
                {ticketDetail.recommended_action && (
                  <div className="text-xs text-purple-200 leading-relaxed font-medium bg-purple-950/40 p-3.5 rounded-xl border border-purple-800/40">
                    <strong className="text-purple-300 block mb-1">Agent Retention Action:</strong>
                    {ticketDetail.recommended_action}
                  </div>
                )}
              </div>

              {ticketDetail.escalation_reason && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  <span className="font-bold flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400" /> {t.escalationReasonModal}:
                  </span>
                  {ticketDetail.escalation_reason}
                </div>
              )}

              {ticketDetail.tools_executed && ticketDetail.tools_executed.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tools Executed</p>
                  <div className="space-y-2">
                    {ticketDetail.tools_executed.map((tool, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-3">
                        <span className="font-mono text-cyan-400 font-semibold">{tool.name || tool.tool || 'tool'}()</span>
                        <span className="text-slate-300 text-right">{tool.result || tool.data || 'Completed'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {ticketDetail && (
          <div className="p-5 border-t border-white/[0.08] flex justify-between items-center bg-slate-950 sticky bottom-0">
            <span className="text-xs text-slate-400">{t.quickChangeStatus}</span>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => onUpdateStatus(ticketDetail.id, 'resolved')}
                disabled={updatingStatus || ticketDetail.status === 'resolved'}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(ticketDetail.id, 'escalated')}
                disabled={updatingStatus || ticketDetail.status === 'escalated'}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Human
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
