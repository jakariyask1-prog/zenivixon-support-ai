"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, BarChart3, Inbox, BookOpen } from 'lucide-react';
import Header from '@/components/Header';
import CustomerPortal from '@/components/CustomerPortal';
import TeamDashboard from '@/components/TeamDashboard';
import TicketLedger from '@/components/TicketLedger';
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager';
import TicketInspectorModal from '@/components/TicketInspectorModal';
import PasscodeModal from '@/components/PasscodeModal';
import { Language, TRANSLATIONS } from '@/lib/translations';
import { DashboardStats, TicketListItem, TicketDetailModalData } from '@/types/support';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [viewMode, setViewMode] = useState<'customer' | 'team'>('customer');

  // Team Console Auth State
  const [isTeamAuthenticated, setIsTeamAuthenticated] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Team Console Data State
  const [activeTeamTab, setActiveTeamTab] = useState<'dashboard' | 'tickets' | 'kb'>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
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
      const res = await fetch(`${API_BASE}/api/dashboard/stats`, {
        headers: { 'X-Admin-Passcode': code },
      });
      if (res.ok) {
        const data: DashboardStats = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  }, [adminPasscode]);

  const fetchTickets = useCallback(async (pass?: string) => {
    const code = pass ?? adminPasscode;
    if (!code) return;
    setRefreshingTickets(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets?limit=50`, {
        headers: { 'X-Admin-Passcode': code },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (e) {
      console.error('Failed to fetch tickets', e);
    } finally {
      setRefreshingTickets(false);
    }
  }, [adminPasscode]);

  // Restore saved language & admin session on mount without synchronous setState in effect body
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
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

  // Fetch team data whenever adminPasscode is set
  useEffect(() => {
    if (!adminPasscode) return;
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, ticketsRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/stats`, {
            headers: { 'X-Admin-Passcode': adminPasscode },
          }),
          fetch(`${API_BASE}/api/tickets?limit=50`, {
            headers: { 'X-Admin-Passcode': adminPasscode },
          }),
        ]);
        if (cancelled) return;
        if (statsRes.ok) {
          const statsData: DashboardStats = await statsRes.json();
          setStats(statsData);
        }
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          setTickets(ticketsData.tickets || []);
        }
      } catch (e) {
        console.error('Failed to sync team data', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminPasscode]);

  const handleTeamAccessClick = () => {
    if (isTeamAuthenticated) {
      setViewMode('team');
    } else {
      setShowPasscodeModal(true);
      setPasscodeInput('');
      setPasscodeError(false);
    }
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = passcodeInput.trim();
    if (!cleanPass) {
      setPasscodeError(true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`, {
        headers: { 'X-Admin-Passcode': cleanPass },
      });
      if (res.ok) {
        const data: DashboardStats = await res.json();
        setStats(data);
        setIsTeamAuthenticated(true);
        setAdminPasscode(cleanPass);
        try {
          sessionStorage.setItem('zenivixon_admin_passcode', cleanPass);
        } catch {
          // ignore
        }
        setShowPasscodeModal(false);
        setViewMode('team');
      } else {
        setPasscodeError(true);
      }
    } catch {
      setPasscodeError(true);
    }
  };

  const openTicketDetail = async (id: number) => {
    if (!adminPasscode) return;
    setSelectedTicketId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id}`, {
        headers: { 'X-Admin-Passcode': adminPasscode },
      });
      if (res.ok) {
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
    if (!adminPasscode) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': adminPasscode,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
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
        onLanguageChange={handleLanguageChange}
        onSelectCustomer={() => setViewMode('customer')}
        onSelectTeam={handleTeamAccessClick}
      />

      {viewMode === 'customer' && (
        <CustomerPortal
          lang={lang}
          apiBase={API_BASE}
          onTicketSubmitted={isTeamAuthenticated ? refreshTeamData : undefined}
        />
      )}

      {viewMode === 'team' && (
        <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  {t.internalOps}
                </span>
                <span className="text-xs text-slate-400">{t.authorizedSession}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">{t.telemetryTitle}</h2>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setViewMode('customer')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.backCustomer}</span>
              </button>

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
                fetchTickets();
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTeamTab === 'tickets'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>
                {t.inboundLedger} ({tickets.length})
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
              apiBase={API_BASE}
              stats={stats}
              tickets={tickets}
              onRefresh={refreshTeamData}
            />
          )}

          {activeTeamTab === 'tickets' && (
            <TicketLedger
              lang={lang}
              tickets={tickets}
              onInspectTicket={openTicketDetail}
            />
          )}

          {activeTeamTab === 'kb' && (
            <KnowledgeBaseManager apiBase={API_BASE} adminPasscode={adminPasscode} />
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
        onClose={() => setShowPasscodeModal(false)}
      />

      <TicketInspectorModal
        lang={lang}
        selectedTicketId={selectedTicketId}
        ticketDetail={ticketDetail}
        loadingDetail={loadingDetail}
        updatingStatus={updatingStatus}
        onClose={() => {
          setSelectedTicketId(null);
          setTicketDetail(null);
        }}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
