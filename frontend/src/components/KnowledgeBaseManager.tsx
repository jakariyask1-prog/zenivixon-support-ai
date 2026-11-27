"use client";

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, CheckCircle2, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { KBDocument } from '@/types/support';
import { DEMO_PREVIEW_KB_DOCS, isJsonResponse } from '@/lib/api';

interface KnowledgeBaseManagerProps {
  apiBase: string;
  adminPasscode: string;
  isDemoPreview?: boolean;
}

export default function KnowledgeBaseManager({
  apiBase,
  adminPasscode,
  isDemoPreview = false,
}: KnowledgeBaseManagerProps) {
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(Boolean(adminPasscode && !isDemoPreview));
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Services');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isDemoPreview || !adminPasscode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/kb`, {
          headers: { 'X-Admin-Passcode': adminPasscode },
        });
        if (!cancelled && res.ok && isJsonResponse(res)) {
          const data = await res.json();
          setDocs(data.documents || []);
        } else if (!cancelled) {
          setFeedback({ type: 'error', message: 'Failed to load knowledge base documents from API.' });
        }
      } catch {
        if (!cancelled) {
          setFeedback({ type: 'error', message: 'Failed to load knowledge base documents.' });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, adminPasscode, isDemoPreview]);

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoPreview) {
      setFeedback({
        type: 'error',
        message: 'Read-Only Demo Preview Mode: Connect with an Admin Passphrase to ingest live Knowledge Base articles.',
      });
      return;
    }
    if (!title.trim() || !text.trim() || !adminPasscode) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiBase}/api/kb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': adminPasscode,
        },
        body: JSON.stringify({ title, category, text }),
      });
      if (res.ok && isJsonResponse(res)) {
        const created: KBDocument = await res.json();
        setDocs(prev => [created, ...prev]);
        setTitle('');
        setText('');
        setFeedback({
          type: 'success',
          message: created.synced_to_qdrant
            ? `Added "${created.title}" to persistent DB and synced vector embedding to Qdrant.`
            : `Added "${created.title}" to persistent relational Knowledge Base.`,
        });
      } else {
        const err = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        setFeedback({ type: 'error', message: typeof err.detail === 'string' ? err.detail : 'Failed to add document.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error while adding knowledge base document.' });
    } finally {
      setSubmitting(false);
    }
  };

  const activeDocs = isDemoPreview ? DEMO_PREVIEW_KB_DOCS : docs;
  const isLoading = !isDemoPreview && loading;

  const filtered = activeDocs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase()) ||
    d.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Add New Knowledge Chunk */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xl">
        <div className="mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" /> Add Knowledge Base Article (Live RAG Ingestion)
          </h3>
          <p className="text-xs text-slate-400">
            New documents are immediately searchable by the Support AI agent and synced to Qdrant when online.
          </p>
        </div>

        <form onSubmit={handleAddDoc} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Document Title *</label>
              <input
                type="text"
                required
                minLength={3}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Enterprise SLA & Priority Response Policy"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Services">Services</option>
                <option value="Pricing">Pricing</option>
                <option value="Support">Support</option>
                <option value="Technical">Technical</option>
                <option value="Security">Security</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Knowledge Content *</label>
            <textarea
              required
              minLength={10}
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Write verified policy, FAQ, or technical documentation..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {feedback && (
            <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {isDemoPreview ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                Read-Only in Demo Preview Mode
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={submitting || isDemoPreview}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Ingesting...' : 'Ingest to Knowledge Base'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Indexed Knowledge List */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> Indexed Knowledge Chunks ({filtered.length})
            </h3>
            <p className="text-xs text-slate-400">Active RAG documents used to ground autonomous support responses.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search knowledge base..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-xs">Loading knowledge base...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
            {filtered.map(doc => (
              <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-cyan-300 border border-blue-500/20 text-[10px] font-bold uppercase">
                    {doc.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">#{doc.id} &bull; {doc.source}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">{doc.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{doc.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
