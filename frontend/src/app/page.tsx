"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, BarChart3, Inbox, BookOpen, Eye, LogOut } from 'lucide-react';
import Header from '@/components/Header';
import CustomerPortal from '@/components/CustomerPortal';
import TeamDashboard from '@/components/TeamDashboard';
import TicketLedger from '@/components/TicketLedger';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import TicketInspectorModal from '@/components/TicketInspectorModal';
import PasscodeModal from '@/components/PasscodeModal';
import { Language, TRANSLATIONS } from '@/lib/translations';
import { DashboardStats, TicketListItem, TicketDetailModalData } from '@/types/support';
import {
  resolveApiBase,
  isJsonResponse,
  DEMO_PREVIEW_STATS,
  DEMO_PREVIEW_TICKETS,
  buildDemoTicketDetail,
} from '@/lib/api';

const TICKET_PAGE_SIZE = 20;
const STATIC_TEAM_CONSOLE_PASSCODE = 'zenivixon-2026';

export default function App() {
  const [apiBase, setApiBase] = useState<string>(() => process.env.NEXT_PUBLIC_API_URL?.trim() || '');
  const [lang, setLang] = useState<Language>('en');
  const [viewMode, setViewMode] = useState<'customer' | 'team'>('customer');

  // Team Console Auth & Explicit Demo Preview State
  const [isTeamAuthenticated, setIsTeamAuthenticated] = useState(false);
  const [isDemoPreview, setIsDemoPreview] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Team Console Data & Pagination State
  const [activeTeamTab, setActiveTeamTab] = useState<'dashboard' | 'tickets' | 'kb'>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [totalTicketCount, setTotalTicketCount] = useState(0);
  const [ticketPage, setTicketPage] = useState(0);
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('all');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('all');
  const [refreshingTickets, setRefreshingTickets] = useState(false);

  // Ticket Inspector Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetailModalData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const t = TRANSLATIONS[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem('zenivixon_lang', newLang);
    } catch {
      // ignore restricted storage
    }
  };

  const fetchStats = useCallback(async (pass?: string) => {
    const code = pass ?? adminPasscode;
    if (!code) return;
    try {
      const res = await fetch(`${apiBase}/api/dashboard/stats`, {
        headers: { 'X-Admin-Passcode': code },
      });
      if (res.ok && isJsonResponse(res)) {
        const data: DashboardStats = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  }, [adminPasscode, apiBase]);

  const fetchTickets = useCallback(
    async (
      opts?: {
        pass?: string;
        page?: number;
        status?: string;
        category?: string;
      }
    ) => {
      const code = opts?.pass ?? adminPasscode;
      if (!code) return;
      const targetPage = opts?.page ?? ticketPage;
      const targetStatus = opts?.status ?? ledgerStatusFilter;
      const targetCategory = opts?.category ?? ledgerCategoryFilter;

      const params = new URLSearchParams({
        limit: String(TICKET_PAGE_SIZE),
        offset: String(targetPage * TICKET_PAGE_SIZE),
      });
      if (targetStatus !== 'all') {
        params.set('status', targetStatus);
      }
      if (targetCategory !== 'all') {
        params.set('category', targetCategory);
      }

      setRefreshingTickets(true);
      try {
        const res = await fetch(`${apiBase}/api/tickets?${params.toString()}`, {
          headers: { 'X-Admin-Passcode': code },
        });
        if (res.ok && isJsonResponse(res)) {
          const data = await res.json();
          setTickets(data.tickets || []);
          setTotalTicketCount(typeof data.total === 'number' ? data.total : (data.tickets || []).length);
        }
      } catch (e) {
        console.error('Failed to fetch tickets', e);
      } finally {
        setRefreshingTickets(false);
      }
    },
    [adminPasscode, apiBase, ticketPage, ledgerStatusFilter, ledgerCategoryFilter]
  );

  // Restore saved language, resolve runtime API base, and verify saved admin session on mount
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const resolvedBase = resolveApiBase();
      setApiBase(resolvedBase);
      try {
        const savedLang = localStorage.getItem('zenivixon_lang') as Language | null;
        if (savedLang === 'en' || savedLang === 'bn') {
          setLang(savedLang);
        }
        const savedPass = sessionStorage.getItem('zenivixon_admin_passcode');
        if (savedPass) {
          setAdminPasscode(savedPass);
          setIsTeamAuthenticated(true);
        }
      } catch {
        // ignore storage errors
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync live team data whenever adminPasscode or pagination/filter state changes
  useEffect(() => {
    if (!adminPasscode || isDemoPreview) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          limit: String(TICKET_PAGE_SIZE),
          offset: String(ticketPage * TICKET_PAGE_SIZE),
        });
        if (ledgerStatusFilter !== 'all') params.set('status', ledgerStatusFilter);
        if (ledgerCategoryFilter !== 'all') params.set('category', ledgerCategoryFilter);

        const [statsRes, ticketsRes] = await Promise.all([
          fetch(`${apiBase}/api/dashboard/stats`, {
            headers: { 'X-Admin-Passcode': adminPasscode },
          }),
          fetch(`${apiBase}/api/tickets?${params.toString()}`, {
            headers: { 'X-Admin-Passcode': adminPasscode },
          }),
        ]);
        if (cancelled) return;
        if (statsRes.ok && isJsonResponse(statsRes)) {
          const statsData: DashboardStats = await statsRes.json();
          setStats(statsData);
        }
        if (ticketsRes.ok && isJsonResponse(ticketsRes)) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData.tickets || []);
          setTotalTicketCount(
            typeof ticketsData.total === 'number' ? ticketsData.total : (ticketsData.tickets || []).length
          );
        }
      } catch (e) {
        console.error('Failed to sync team data', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminPasscode, apiBase, isDemoPreview, ticketPage, ledgerStatusFilter, ledgerCategoryFilter]);

  const handleTeamAccessClick = () => {
    if (isTeamAuthenticated || isDemoPreview) {
      setViewMode('team');
    } else {
      setShowPasscodeModal(true);
      setPasscodeInput('');
      setPasscodeError(false);
    }
  };

  const handleEnterDemoPreview = () => {
    setIsDemoPreview(true);
    setIsTeamAuthenticated(false);
    setAdminPasscode('');
    setStats(DEMO_PREVIEW_STATS);
    setTickets(DEMO_PREVIEW_TICKETS);
    setTotalTicketCount(DEMO_PREVIEW_TICKETS.length);
    setTicketPage(0);
    setShowPasscodeModal(false);
    setPasscodeError(false);
    setViewMode('team');
  };

  const handleLogoutTeam = () => {
    setIsTeamAuthenticated(false);
    setIsDemoPreview(false);
    setAdminPasscode('');
    setStats(null);
    setTickets([]);
    setTotalTicketCount(0);
    setTicketPage(0);
    setSelectedTicketId(null);
    setTicketDetail(null);
    try {
      sessionStorage.removeItem('zenivixon_admin_passcode');
    } catch {
      // ignore
    }
    setViewMode('customer');
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = passcodeInput.trim();
    if (!cleanPass) {
      setPasscodeError(true);
      return;
    }
    const isStaticPass = isStaticTeamConsolePasscode(cleanPass);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${apiBase}/api/dashboard/stats`, {
        headers: { 'X-Admin-Passcode': isStaticPass ? STATIC_TEAM_CONSOLE_PASSCODE : cleanPass },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok && isJsonResponse(res)) {
        const authPass = isStaticPass ? STATIC_TEAM_CONSOLE_PASSCODE : cleanPass;
        const data: DashboardStats = await res.json();
        setStats(data);
        setIsDemoPreview(false);
        setIsTeamAuthenticated(true);
        setAdminPasscode(authPass);
        setTicketPage(0);
        try {
          sessionStorage.setItem('zenivixon_admin_passcode', authPass);
        } catch {
          // ignore
        }
        setShowPasscodeModal(false);
        setViewMode('team');
        return;
      }
    } catch {
      // Backend unreachable / timed out (e.g. static Netlify deploy without API)
    }
    if (isStaticPass) {
      // No backend accepted it, but this is the static Team Console passcode → open with preview data
      handleEnterDemoPreview();
    } else {
      setPasscodeError(true);
    }
  };

  // NOTE: Client-side passcode for static (backend-less) deploys only.
  // This is visible in the JS bundle and is NOT a security boundary.
  // Tolerant of case, spaces and mobile-keyboard dash variants (– — −).
  const isStaticTeamConsolePasscode = (raw: string): boolean =>
    raw
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\s+/g, '') === STATIC_TEAM_CONSOLE_PASSCODE;

  const openTicketDetail = async (id: number) => {
    if (isDemoPreview) {
      const found = DEMO_PREVIEW_TICKETS.find(item => item.id === id);
      if (found) {
        setSelectedTicketId(id);
        setTicketDetail(buildDemoTicketDetail(found));
      }
      return;
    }
    if (!adminPasscode) return;
    setSelectedTicketId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${apiBase}/api/tickets/${id}`, {
        headers: { 'X-Admin-Passcode': adminPasscode },
      });
      if (res.ok && isJsonResponse(res)) {
        const data: TicketDetailModalData = await res.json();
        setTicketDetail(data);
      }
    } catch (e) {
      console.error('Error fetching ticket detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    if (isDemoPreview || !adminPasscode) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${apiBase}/api/tickets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': adminPasscode,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok && isJsonResponse(res)) {
        fetchTickets();
        fetchStats();
        if (ticketDetail) {
          setTicketDetail({ ...ticketDetail, status: newStatus });
        }
      }
    } catch (e) {
      console.error('Error updating ticket status:', e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const refreshTeamData = () => {
    if (isDemoPreview) return;
    fetchStats();
    fetchTickets();
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      {/* Ambient Lighting */}
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none opacity-25 z-0" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/15 via-indigo-600/8 to-transparent blur-3xl pointer-events-none z-0" />
      <div className="fixed -bottom-40 right-10 w-[500px] h-[350px] bg-purple-600/10 blur-3xl pointer-events-none z-0" />

      <Header
        lang={lang}
        viewMode={viewMode}
        isTeamAuthenticated={isTeamAuthenticated}
        isDemoPreview={isDemoPreview}
        onLanguageChange={handleLanguageChange}
        onSelectCustomer={() => setViewMode('customer')}
        onSelectTeam={handleTeamAccessClick}
        onLogoutTeam={handleLogoutTeam}
      />

      {viewMode === 'customer' && (
        <CustomerPortal
          lang={lang}
          apiBase={apiBase}
          onTicketSubmitted={isTeamAuthenticated ? refreshTeamData : undefined}
        />
      )}

      {viewMode === 'team' && (
        <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          {isDemoPreview && (
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-cyan-200 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong className="font-extrabold uppercase tracking-wider mr-2">{t.demoPreviewBadge}:</strong>
                  {t.demoPreviewDesc}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasscodeModal(true);
                  setPasscodeInput('');
                  setPasscodeError(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-cyan-300 border border-cyan-500/30 font-bold transition-all"
              >
                {t.passcodeSubmit}
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  {t.internalOps}
                </span>
                <span className="text-xs text-slate-400">
                  {isDemoPreview ? t.demoPreviewBadge : t.authorizedSession}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">{t.telemetryTitle}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setViewMode('customer')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.backCustomer}</span>
              </button>

              {!isDemoPreview && (
                <button
                  type="button"
                  onClick={refreshTeamData}
                  disabled={refreshingTickets}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all shadow-sm"
                  title="Sync database records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingTickets ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>{t.syncDb}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogoutTeam}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.logoutConsole}</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTeamTab('dashboard')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTeamTab === 'dashboard'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t.opsConsole}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTeamTab('tickets');
                if (!isDemoPreview) {
                  fetchTickets();
                }
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTeamTab === 'tickets'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>
                {t.inboundLedger} ({totalTicketCount})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTeamTab('kb')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTeamTab === 'kb'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.kbManager}</span>
            </button>
          </div>

          {activeTeamTab === 'dashboard' && (
            <TeamDashboard
              lang={lang}
              apiBase={apiBase}
              adminPasscode={adminPasscode}
              isDemoPreview={isDemoPreview}
              stats={stats}
              tickets={tickets}
              onRefresh={refreshTeamData}
            />
          )}

          {activeTeamTab === 'tickets' && (
            <TicketLedger
              lang={lang}
              tickets={tickets}
              totalCount={totalTicketCount}
              page={ticketPage}
              pageSize={TICKET_PAGE_SIZE}
              statusFilter={ledgerStatusFilter}
              categoryFilter={ledgerCategoryFilter}
              onStatusFilterChange={val => {
                setLedgerStatusFilter(val);
                setTicketPage(0);
              }}
              onCategoryFilterChange={val => {
                setLedgerCategoryFilter(val);
                setTicketPage(0);
              }}
              onPageChange={newPage => setTicketPage(newPage)}
              onInspectTicket={openTicketDetail}
            />
          )}

          {activeTeamTab === 'kb' && (
            <KnowledgeBaseManager
              apiBase={apiBase}
              adminPasscode={adminPasscode}
              isDemoPreview={isDemoPreview}
            />
          )}
        </div>
      )}

      <PasscodeModal
        lang={lang}
        isOpen={showPasscodeModal}
        passcodeInput={passcodeInput}
        passcodeError={passcodeError}
        onPasscodeChange={val => {
          setPasscodeInput(val);
          setPasscodeError(false);
        }}
        onSubmit={handleVerifyPasscode}
        onEnterDemoPreview={handleEnterDemoPreview}
        onClose={() => setShowPasscodeModal(false)}
      />

      <TicketInspectorModal
        lang={lang}
        selectedTicketId={selectedTicketId}
        ticketDetail={ticketDetail}
        loadingDetail={loadingDetail}
        updatingStatus={updatingStatus}
        isDemoPreview={isDemoPreview}
        onClose={() => {
          setSelectedTicketId(null);
          setTicketDetail(null);
        }}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
