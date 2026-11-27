"use client";

import React from 'react';
import { Lock, X, AlertCircle, Eye } from 'lucide-react';
import { Language, TRANSLATIONS } from '@/lib/translations';

interface PasscodeModalProps {
  lang: Language;
  isOpen: boolean;
  passcodeInput: string;
  passcodeError: boolean;
  onPasscodeChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onEnterDemoPreview: () => void;
  onClose: () => void;
}

export default function PasscodeModal({
  lang,
  isOpen,
  passcodeInput,
  passcodeError,
  onPasscodeChange,
  onSubmit,
  onEnterDemoPreview,
  onClose,
}: PasscodeModalProps) {
  if (!isOpen) return null;
  const t = TRANSLATIONS[lang];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/95 w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{t.passcodeTitle}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t.passcodeDesc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              autoFocus
              value={passcodeInput}
              onChange={e => onPasscodeChange(e.target.value)}
              placeholder={t.passcodePlaceholder}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 shadow-inner"
            />
            {passcodeError && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {t.passcodeInvalid}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25 transition-all"
            >
              {t.passcodeSubmit}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
          <p className="text-[11px] text-slate-400 text-center">{t.demoPreviewDesc}</p>
          <button
            type="button"
            onClick={onEnterDemoPreview}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.demoPreviewBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

