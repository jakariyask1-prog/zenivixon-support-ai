"use client";

import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Search,
  AlertCircle
} from 'lucide-react';
import { Language, TRANSLATIONS } from '@/lib/translations';
import { LatestTicketResponse, TicketDetailModalData, StreamNodeEvent } from '@/types/support';
import { isEventStreamResponse, isJsonResponse } from '@/lib/api';

interface CustomerPortalProps {
  lang: Language;
  apiBase: string;
  onTicketSubmitted?: () => void;
}

export default function CustomerPortal({ lang, apiBase, onTicketSubmitted }: CustomerPortalProps) {
  const t = TRANSLATIONS[lang];

  const [customerSubTab, setCustomerSubTab] = useState<'submit' | 'track'>('submit');
  const [custEmail, setCustEmail] = useState('');
  const [custMessage, setCustMessage] = useState('');
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [streamNodes, setStreamNodes] = useState<StreamNodeEvent[]>([]);
  const [custSubmissionResult, setCustSubmissionResult] = useState<LatestTicketResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Track Ticket State
  const [trackInputId, setTrackInputId] = useState('');
  const [trackEmail, setTrackEmail] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<TicketDetailModalData | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const extractApiError = (errJson: Record<string, unknown>, fallback: string): string => {
    const detail = errJson.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item: { msg?: string }) => item?.msg || 'Invalid input')
        .join(', ');
    }
    return fallback;
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custEmail.trim() || !custMessage.trim()) return;

    setCustSubmitting(true);
    setSubmitError(null);
    setStreamNodes([]);
    setCustSubmissionResult(null);

    try {
      const res = await fetch(`${apiBase}/api/tickets/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: custEmail.trim(), message: custMessage.trim() }),
      });

      if (!res.ok) {
        const errJson = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        setSubmitError(
          extractApiError(
            errJson,
            lang === 'bn'
              ? 'টিকেট জমা দেওয়া সম্ভব হয়নি। অনুগ্রহ করে ইমেইল ও মেসেজ যাচাই করে আবার চেষ্টা করুন।'
              : 'Unable to submit ticket. Please verify your email and message and try again.'
          )
        );
        return;
      }

      if (!isEventStreamResponse(res)) {
        setSubmitError(
          lang === 'bn'
            ? 'লাইভ ব্যাকএন্ড API সংযুক্ত নেই (NEXT_PUBLIC_API_URL কনফিগার করুন অথবা টিম কনসোলের ডেমো প্রিভিউ দেখুন)।'
            : 'Live Backend API is not connected to this static host. Configure NEXT_PUBLIC_API_URL or explore Team Console Demo Preview.'
        );
        return;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            let eventType = 'message';
            let dataLine = '';
            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLine = line.slice(5).trim();
              }
            }
            if (!dataLine) continue;
            try {
              const parsed = JSON.parse(dataLine);
              if (eventType === 'node') {
                setStreamNodes(prev => [...prev, parsed as StreamNodeEvent]);
              } else if (eventType === 'done') {
                receivedDone = true;
                setCustSubmissionResult(parsed as LatestTicketResponse);
                onTicketSubmitted?.();
              }
            } catch {
              // Ignore malformed partial chunk
            }
          }
        }

        if (!receivedDone) {
          setSubmitError(
            lang === 'bn'
              ? 'সার্ভার থেকে সম্পূর্ণ রেসপন্স পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
              : 'Stream ended before final response was received. Please try again.'
          );
        }
      }
    } catch {
      setSubmitError(
        lang === 'bn'
          ? 'সাপোর্ট সার্ভারে সংযোগ করা সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।'
          : 'Unable to reach support server. Please verify the backend is online and try again.'
      );
    } finally {
      setCustSubmitting(false);
    }
  };

  const handleCustomerTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = trackInputId.replace(/\D/g, '');
    if (!cleanId || !trackEmail.trim()) {
      setTrackError(
        lang === 'bn'
          ? 'অনুগ্রহ করে একটি সঠিক টিকেট নম্বর (যেমন: 26) এবং আপনার ইমেইল দিন।'
          : 'Please enter both your numeric Ticket ID (e.g. 26) and your customer email address.'
      );
      return;
    }

    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);
    try {
      const res = await fetch(
        `${apiBase}/api/portal/track?ticket_id=${cleanId}&email=${encodeURIComponent(trackEmail.trim())}`
      );
      if (res.ok && isJsonResponse(res)) {
        const data: TicketDetailModalData = await res.json();
        setTrackResult(data);
      } else if (res.ok && !isJsonResponse(res)) {
        setTrackError(
          lang === 'bn'
            ? 'লাইভ ব্যাকএন্ড API সংযুক্ত নেই (NEXT_PUBLIC_API_URL কনফিগার করুন)।'
            : 'Live Backend API is not connected to this static host (configure NEXT_PUBLIC_API_URL).'
        );
      } else {
        const errJson = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        setTrackError(
          extractApiError(
            errJson,
            lang === 'bn'
              ? `টিকেট #${cleanId} এবং '${trackEmail}' ইমেইলের কোনো রেকর্ড পাওয়া যায়নি।`
              : `Ticket #${cleanId} was not found for email '${trackEmail}'. Please verify your credentials.`
          )
        );
      }
    } catch {
      setTrackError(
        lang === 'bn'
          ? 'সাপোর্ট সার্ভারে সংযোগ করা সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।'
          : 'Unable to reach support server. Please try again later.'
      );
    } finally {
      setTrackLoading(false);
    }
  };

  const progressPct = Math.min(Math.max(streamNodes.length * 17, 15), 96);

  return (
    <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      <div className="relative text-center py-6 sm:py-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 font-semibold shadow-inner backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>{t.heroBadge}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
          {t.heroTitle}
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
          {t.heroDesc}
        </p>

        <div className="flex items-center justify-center gap-2 pt-3">
          <div className="inline-flex p-1 bg-slate-900/90 border border-white/10 rounded-2xl shadow-inner backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setCustomerSubTab('submit');
                setCustSubmissionResult(null);
                setSubmitError(null);
              }}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                customerSubTab === 'submit'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              {t.tabSubmit}
            </button>
            <button
              type="button"
              onClick={() => setCustomerSubTab('track')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                customerSubTab === 'track'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              {t.tabTrack}
            </button>
          </div>
        </div>
      </div>

      {customerSubTab === 'submit' && (
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-10 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

          {!custSubmissionResult ? (
            <form onSubmit={handleCustomerSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  {t.formEmailLabel} <span className="text-rose-400">{t.formEmailReq}</span>
                </label>
                <input
                  type="email"
                  required
                  value={custEmail}
                  onChange={e => setCustEmail(e.target.value)}
                  placeholder={t.formEmailPlaceholder}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                />
                <p className="text-[11px] text-slate-500 mt-2">{t.formEmailSub}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  {t.formMessageLabel} <span className="text-rose-400">{t.formEmailReq}</span>
                </label>
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={5}
                  value={custMessage}
                  onChange={e => setCustMessage(e.target.value)}
                  placeholder={t.formMessagePlaceholder}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-y shadow-inner"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  {t.commonInquiries}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[t.promptAiServices, t.promptRagPipeline, t.promptOrderStatus, t.promptRefundIssue].map(
                    (prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustMessage(prompt)}
                        className="px-3.5 py-2 rounded-xl text-xs bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all text-left truncate max-w-full shadow-sm"
                      >
                        + {prompt}
                      </button>
                    )
                  )}
                </div>
              </div>

              {submitError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Real-Time SSE Streaming Pipeline Stepper */}
              {custSubmitting && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/60 border border-blue-500/30 space-y-3.5 shadow-inner backdrop-blur-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                    <span className="flex items-center gap-2 text-blue-300">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                      </span>
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span className="tracking-wide">
                        {lang === 'bn'
                          ? 'লাইভ ল্যাংগ্রাফ পাইপলাইন চলছে (SSE)...'
                          : 'Live LangGraph Pipeline Streaming (SSE)...'}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-800/60 shadow-sm">
                      {streamNodes.length > 0
                        ? streamNodes[streamNodes.length - 1].label
                        : lang === 'bn'
                        ? 'এজেন্ট শুরু হচ্ছে...'
                        : 'Initializing agent graph...'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 p-0.5 border border-slate-800 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  {streamNodes.length > 0 && (
                    <div className="space-y-1 font-mono text-[11px] text-slate-300">
                      {streamNodes.map((n, i) => (
                        <div key={i} className="flex items-center gap-2 text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          <span>{n.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={custSubmitting}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {custSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.submittingBtn}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{t.submitBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div
                className={`p-6 rounded-2xl border flex items-start gap-4 backdrop-blur-md shadow-lg ${
                  custSubmissionResult.status === 'resolved'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}
              >
                {custSubmissionResult.status === 'resolved' ? (
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="font-extrabold text-base text-white">
                      {custSubmissionResult.status === 'resolved' ? t.resolvedHeader : t.escalatedHeader}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-900 text-cyan-300 border border-slate-700">
                      #TKT-{custSubmissionResult.ticket_id}
                    </span>
                    {custSubmissionResult.processing_time_ms != null && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                        {custSubmissionResult.processing_time_ms} ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {custSubmissionResult.status === 'resolved' ? t.resolvedSub : t.escalatedSub}
                  </p>
                </div>
              </div>

              {custSubmissionResult.draft_response && (
                <div className="relative overflow-hidden bg-slate-950/90 border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-400" /> {t.officialResponse}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(custSubmissionResult.draft_response || '')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 transition-all border border-slate-700 shadow-sm"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copied ? t.copied : t.copy}</span>
                    </button>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-[#050811] p-5 rounded-xl border border-slate-800/80 shadow-inner">
                    {custSubmissionResult.draft_response}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <p className="text-xs text-slate-400 font-mono">
                  {t.ticketIdNotice}{' '}
                  <strong className="text-cyan-300 font-bold">#TKT-{custSubmissionResult.ticket_id}</strong>{' '}
                  {t.forTracking}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCustSubmissionResult(null);
                    setCustMessage('');
                    setStreamNodes([]);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700/80 shadow-sm transition-all"
                >
                  {t.submitAnother}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {customerSubTab === 'track' && (
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-10 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.5)] space-y-6">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white mb-1 flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" /> {t.trackTitle}
            </h3>
            <p className="text-xs text-slate-400">{t.trackDesc}</p>
          </div>

          <form onSubmit={handleCustomerTrack} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Ticket ID *
              </label>
              <input
                type="text"
                required
                value={trackInputId}
                onChange={e => setTrackInputId(e.target.value)}
                placeholder={t.trackPlaceholder}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {t.trackEmailLabel} *
              </label>
              <input
                type="email"
                required
                value={trackEmail}
                onChange={e => setTrackEmail(e.target.value)}
                placeholder={t.trackEmailPlaceholder}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={trackLoading}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {trackLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{t.trackBtn}</span>
              </button>
            </div>
          </form>

          {trackError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{trackError}</span>
            </div>
          )}

          {trackResult && (
            <div className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-cyan-400">Ticket #{trackResult.id}</span>
                  <span className="text-xs text-slate-500">&bull;</span>
                  <span className="text-xs text-slate-300 font-semibold">{trackResult.customer.email}</span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    trackResult.status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : trackResult.status === 'escalated'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {trackResult.status}
                </span>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t.yourMessage}</p>
                <p className="text-xs text-slate-300 italic bg-slate-900/90 p-4 rounded-xl border border-slate-800 shadow-inner">
                  &ldquo;{trackResult.raw_message}&rdquo;
                </p>
              </div>

              {trackResult.draft_response ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t.officialResponse}
                  </p>
                  <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#050811] p-4 rounded-xl border border-slate-800 shadow-inner">
                    {trackResult.draft_response}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                  {t.trackUnderReview}
                </div>
              )}

              <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2 border-t border-slate-800/80">
                <span>
                  {t.categoryLabel} <strong className="text-slate-300">{trackResult.category}</strong>
                </span>
                <span>
                  {t.createdLabel}{' '}
                  <strong className="text-slate-300">
                    {trackResult.created_at ? new Date(trackResult.created_at).toLocaleString() : '--'}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
