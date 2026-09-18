"use client";

import React, { useState, useEffect } from 'react';
import { Layers, Inbox, BarChart3, Settings, AlertTriangle, CheckCircle2 } from 'lucide-react';
import HandoffPackage from '@/components/HandoffPackage';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [latestTicket, setLatestTicket] = useState<any>(null);
  const [simEmail, setSimEmail] = useState("angry@customer.com");
  const [simMessage, setSimMessage] = useState("This is the third time this month inventory sync has silently died. Absolutely unacceptable. I have a demo with a competitor on Friday and I'm seriously considering cancelling.");

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  useEffect(() => {
    fetchStats();
    // In a real app we would poll or use websockets here
  }, []);

  const simulateTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: simEmail,
          message: simMessage
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLatestTicket(data);
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FCFDFE] dark:bg-[#020817] text-slate-900 dark:text-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col p-6 hidden md:flex">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
            <Layers className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-wider bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">ZENIVIXON</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Support AI</p>
          </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-medium">
            <BarChart3 className="w-5 h-5" /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors">
            <Inbox className="w-5 h-5" /> Live Tickets
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold font-heading mb-2">Operations Dashboard</h2>
            <p className="text-slate-500">Real-time autonomous agent telemetry & metrics.</p>
          </div>
          <form onSubmit={simulateTicket} className="flex flex-col gap-2 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full max-w-lg">
            <input 
              type="email" 
              value={simEmail} 
              onChange={e => setSimEmail(e.target.value)} 
              className="px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="Customer Email" 
              required
            />
            <div className="flex gap-2">
              <input 
                type="text" 
                value={simMessage} 
                onChange={e => setSimMessage(e.target.value)} 
                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-transparent border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="Type customer message..." 
                required
              />
              <button 
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-medium rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap text-sm"
              >
                {loading ? "Sending..." : "Send Ticket"}
              </button>
            </div>
          </form>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <p className="text-sm font-semibold text-slate-500 mb-1">Tickets Today</p>
            <h3 className="text-3xl font-bold">{stats ? stats['Tickets Today'] : '--'}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI Resolved
            </p>
            <h3 className="text-3xl font-bold">{stats ? stats['AI Resolved'] : '--'}</h3>
            <p className="text-xs text-emerald-500 mt-2 font-medium">{stats ? stats['Resolution Rate'] : '--'} Resolution Rate</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <p className="text-sm font-semibold text-slate-500 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Human Escalated
            </p>
            <h3 className="text-3xl font-bold">{stats ? stats['Human Escalated'] : '--'}</h3>
            <p className="text-xs text-amber-500 mt-2 font-medium">{stats ? stats['Escalation Rate'] : '--'} Escalation Rate</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-violet-600 p-6 rounded-2xl shadow-lg text-white">
            <p className="text-sm font-medium text-blue-100 mb-1">Avg AI Response</p>
            <h3 className="text-3xl font-bold">~ 4 sec</h3>
            <p className="text-xs text-blue-200 mt-2">LangGraph processing time</p>
          </div>
        </div>

        {/* Live Trace */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Recent Agent Trace</h3>
          
          {!latestTicket ? (
            <div className="text-center py-10 text-slate-500">
              Click "+ New Simulation" to run a ticket through the LangGraph AI.
            </div>
          ) : (
            <>
              {latestTicket.status === 'escalated' ? (
                <HandoffPackage ticket={{
                  customer: { email: simEmail, isVerified: latestTicket.is_verified, tier: latestTicket.is_verified ? "standard" : "none" },
                  rawMessage: simMessage,
                  category: latestTicket.category || "Unknown",
                  intent: latestTicket.intent || "Unknown",
                  priority: latestTicket.priority || "Medium",
                  aiFindings: latestTicket.ai_findings || "",
                  toolsExecuted: latestTicket.tools_executed || [],
                  escalationReason: latestTicket.escalation_reason || "Unknown"
                }} />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1">Ticket #{latestTicket.ticket_id} Processed</p>
                      <div className="text-xs text-slate-500 space-y-1 mt-2">
                        {latestTicket.trace?.map((t: string, i: number) => (
                          <p key={i}>→ {t}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
