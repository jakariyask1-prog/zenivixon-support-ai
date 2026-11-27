"use client";

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Inbox,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Language, TRANSLATIONS } from '@/lib/translations';
import { TicketListItem } from '@/types/support';

interface TicketLedgerProps {
  lang: Language;
  tickets: TicketListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  statusFilter: string;
  categoryFilter: string;
  onStatusFilterChange: (val: string) => void;
  onCategoryFilterChange: (val: string) => void;
  onPageChange: (newPage: number) => void;
  onInspectTicket: (id: number) => void;
}

export default function TicketLedger({
  lang,
  tickets,
  totalCount,
  page,
  pageSize,
  statusFilter,
  categoryFilter,
  onStatusFilterChange,
  onCategoryFilterChange,
  onPageChange,
  onInspectTicket,
}: TicketLedgerProps) {
  const t = TRANSLATIONS[lang];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTickets = tickets.filter(item => {
    const matchesSearch =
      item.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.raw_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toString().includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIdx = totalCount === 0 ? 0 : page * pageSize + 1;
  const endIdx = Math.min(totalCount, (page + 1) * pageSize);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl shadow-xl">
      <div className="p-6 border-b border-white/[0.08] space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-base text-white">{t.ledgerTitle}</h3>
            <p className="text-xs text-slate-400">
              {t.ledgerDesc} ({totalCount})
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => onStatusFilterChange(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500 shadow-inner"
            >
              <option value="all">{t.filterAllStatus}</option>
              <option value="resolved">{t.filterResolved}</option>
              <option value="escalated">{t.filterEscalated}</option>
              <option value="open">Open / Processing</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={e => onCategoryFilterChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-blue-500 shadow-inner"
            >
              <option value="all">{t.filterAllCats}</option>
              <option value="Order">Order</option>
              <option value="Billing">Billing</option>
              <option value="Refund">Refund</option>
              <option value="Technical">Technical</option>
              <option value="Account">Account</option>
              <option value="Security">Security</option>
              <option value="Subscription">Subscription</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t.noTicketsFound}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">{t.colId}</th>
                <th className="py-3.5 px-4">{t.colCustomer}</th>
                <th className="py-3.5 px-4 max-w-sm">Message Snippet</th>
                <th className="py-3.5 px-4">{t.colCategory}</th>
                <th className="py-3.5 px-4">{t.colPriority}</th>
                <th className="py-3.5 px-4">{t.colChurnRisk}</th>
                <th className="py-3.5 px-4">{t.colStatus}</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTickets.map(item => {
                const score = item.churn_risk_score ?? 20;
                const isHigh = score >= 60;
                const isMid = score >= 35 && score < 60;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => onInspectTicket(item.id)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">#{item.id}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-200">{item.customer_email}</p>
                      <span className="text-[10px] text-slate-500 capitalize">{item.customer_tier} tier</span>
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <p className="truncate text-slate-300" title={item.raw_message}>
                        {item.raw_message}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.priority === 'Critical'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : item.priority === 'High'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isHigh
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : isMid
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        <ShieldAlert className="w-3 h-3" />
                        {score}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          item.status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'escalated'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.status === 'resolved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : item.status === 'escalated' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '--'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onInspectTicket(item.id);
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 hover:border-blue-500 text-[11px] font-bold transition-all"
                      >
                        {t.inspectBtn}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalCount > 0 && (
        <div className="px-6 py-4 border-t border-white/[0.08] bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span className="font-mono">
            {startIdx}&ndash;{endIdx} / {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => onPageChange(page - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 transition-all font-bold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{t.pagePrev}</span>
            </button>
            <span className="px-2 font-mono text-[11px]">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 disabled:opacity-40 transition-all font-bold"
            >
              <span>{t.pageNext}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

