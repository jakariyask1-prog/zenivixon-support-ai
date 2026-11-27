"use client";

import React from 'react';
import { Layers, Globe, HelpCircle, Lock, Unlock, Eye, LogOut } from 'lucide-react';
import { Language, TRANSLATIONS } from '@/lib/translations';

interface HeaderProps {
  lang: Language;
  viewMode: 'customer' | 'team';
  isTeamAuthenticated: boolean;
  isDemoPreview?: boolean;
  onLanguageChange: (lang: Language) => void;
  onSelectCustomer: () => void;
  onSelectTeam: () => void;
  onLogoutTeam?: () => void;
}

export default function Header({
  lang,
  viewMode,
  isTeamAuthenticated,
  isDemoPreview = false,
  onLanguageChange,
  onSelectCustomer,
  onSelectTeam,
  onLogoutTeam,
}: HeaderProps) {
  const t = TRANSLATIONS[lang];

  return (
    <header className="border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl px-4 sm:px-8 py-3 sticky top-0 z-40 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-2xl blur-sm opacity-60 group-hover:opacity-90 transition duration-300" />
            <div className="relative h-10 w-10 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
              <Layers className="text-cyan-400 w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-300 bg-clip-text text-transparent">
                ZENIVIXON
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-cyan-300 border border-blue-500/30 tracking-wide uppercase shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {t.supportAi}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {viewMode === 'customer' ? t.brandSubCustomer : t.brandSubTeam}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-slate-900/90 border border-white/10 rounded-xl p-0.5 shadow-inner backdrop-blur-md">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                lang === 'en'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="English (Default)"
            >
              <Globe className="w-3 h-3" />
              <span>EN</span>
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('bn')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                lang === 'bn'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="বাংলা (Bengali)"
            >
              বাংলা
            </button>
          </div>

          <div className="flex items-center bg-slate-900/80 border border-white/10 rounded-xl p-0.5 shadow-inner backdrop-blur-md">
            <button
              type="button"
              onClick={onSelectCustomer}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                viewMode === 'customer'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{t.customerPortal}</span>
            </button>

            <button
              type="button"
              onClick={onSelectTeam}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                viewMode === 'team'
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {isTeamAuthenticated ? (
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              ) : isDemoPreview ? (
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{t.teamConsole}</span>
            </button>
          </div>

          {(isTeamAuthenticated || isDemoPreview) && onLogoutTeam && (
            <button
              type="button"
              onClick={onLogoutTeam}
              title={t.logoutConsole}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

