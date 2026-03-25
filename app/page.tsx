'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatPrDate } from '@/lib/format-pr-date';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PR {
  number: number;
  title: string;
  url: string;
  author: string;
  createdAt: string;
  draft: boolean;
}

type IssueSeverity = 'low' | 'medium' | 'high';

interface Issue {
  file: string;
  line: number;
  description: string;
  severity?: IssueSeverity;
}

interface Review {
  id: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  author: string;
  summary: string;
  issues: Issue[];
  suggestion: string;
  toolCalls: string[];
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_DOT: Record<IssueSeverity, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-slate-500',
};

const SEV_TEXT: Record<IssueSeverity, string> = {
  high:   'text-red-400',
  medium: 'text-amber-400',
  low:    'text-slate-400',
};

const TOOL_LABELS: Record<string, string> = {
  GITHUB_GET_A_PULL_REQUEST:                 'Fetched PR metadata',
  GITHUB_LIST_PULL_REQUESTS_FILES:           'Read changed files & diffs',
  GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST: 'Posted inline review to GitHub',
  SLACK_SEND_MESSAGE:                        'Sent Slack notification',
};

const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? '';

const MISSING_CONFIG: string[] = [];
if (!GITHUB_REPO) MISSING_CONFIG.push('NEXT_PUBLIC_GITHUB_REPO');

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [prs, setPrs]               = useState<PR[]>([]);
  const [prsLoading, setPrsLoading] = useState(true);
  const [prsError, setPrsError]     = useState<string | null>(null);
  const [history, setHistory]       = useState<Review[]>([]);
  const [selectedPr, setSelectedPr] = useState<number | null>(null);
  const [reviewing, setReviewing]   = useState<number | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const fetchPRs = useCallback(async () => {
    setPrsLoading(true);
    setPrsError(null);
    try {
      const res = await fetch('/api/prs');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch PRs');
      setPrs(await res.json());
    } catch (err: any) {
      setPrsError(err.message);
    } finally {
      setPrsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/reviews');
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => { fetchPRs(); fetchHistory(); }, [fetchPRs, fetchHistory]);

  function handleSelectPr(n: number) {
    setSelectedPr((prev) => (prev === n ? null : n));
    setReviewError(null);
    setToolsExpanded(false);
  }

  async function triggerReview(pr: PR) {
    if (history.some((r) => r.prNumber === pr.number)) return;
    setReviewing(pr.number);
    setReviewError(null);
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prNumber: pr.number, prTitle: pr.title, prUrl: pr.url, author: pr.author }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Review failed');
      await fetchHistory();
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setReviewing(null);
    }
  }

  const activePr       = prs.find((p) => p.number === selectedPr) ?? null;
  const existingReview = history.find((r) => r.prNumber === selectedPr) ?? null;
  const isReviewing    = reviewing === selectedPr;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{ background: '#141414', color: 'var(--foreground)', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
    >
      {/* ── Config banner ── */}
      {MISSING_CONFIG.length > 0 && (
        <div
          className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs"
          style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span style={{ fontFamily: 'var(--font-geist-mono)' }}>
            Missing env vars: {MISSING_CONFIG.join(', ')} — copy <strong>.env.example</strong> to <strong>.env.local</strong> and restart
          </span>
        </div>
      )}
      {/* ── Header ── */}
      <header
        className="shrink-0 flex items-center justify-between px-5"
        style={{ height: 44, borderBottom: '1px solid #2a2a2a', background: '#141414' }}
      >
        <div className="flex items-center gap-3">
          {/* Composio-style logo mark */}
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect width="18" height="18" rx="3" fill="#4f6ef7"/>
              <path d="M5 9h8M9 5v8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-semibold text-white tracking-tight">PR Review Agent</span>
          </div>
          <span style={{ color: 'var(--text-faint)' }}>/</span>
          <span className="text-xs" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}>
            {GITHUB_REPO || 'not configured'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}>
            claude-sonnet · composio
          </span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside
          className="shrink-0 flex flex-col"
          style={{ width: 252, borderRight: '1px solid #2a2a2a', background: '#141414' }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-4"
            style={{ height: 36, borderBottom: '1px solid #2a2a2a' }}
          >
            <span
              className="text-[10px] font-semibold tracking-widest"
              style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)', letterSpacing: '0.1em' }}
            >
              PULL_REQUESTS
            </span>
            <button
              onClick={fetchPRs}
              disabled={prsLoading}
              className="transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-label)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-body-soft)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-label)')}
            >
              <RefreshCw className={`w-3 h-3 ${prsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* PR list */}
          <div className="flex-1 overflow-y-auto py-1">
            {prsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--text-label)' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs" style={{ fontFamily: 'var(--font-geist-mono)' }}>loading...</span>
              </div>
            ) : prsError ? (
              <div className="mx-3 my-2 px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 4 }}>
                <p className="text-xs text-red-400">{prsError}</p>
              </div>
            ) : prs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-faint)' }}>
                <span className="text-[10px]" style={{ fontFamily: 'var(--font-geist-mono)' }}>// no open pull requests</span>
              </div>
            ) : (
              <div className="px-2 pt-1 space-y-px">
                {prs.map((pr) => {
                  const isReviewed = history.some((r) => r.prNumber === pr.number);
                  const isSelected = selectedPr === pr.number;
                  const isRunning  = reviewing === pr.number;
                  return (
                    <PRRow
                      key={pr.number}
                      pr={pr}
                      isSelected={isSelected}
                      isReviewed={isReviewed}
                      isRunning={isRunning}
                      onClick={() => handleSelectPr(pr.number)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#141414' }}>
          {selectedPr === null ? (
            <EmptyState />
          ) : isReviewing ? (
            <div className="p-8 max-w-2xl">
              <AgentRunning prNumber={selectedPr} />
            </div>
          ) : reviewError ? (
            <div className="p-8 max-w-2xl">
              <ErrorPanel message={reviewError} onDismiss={() => setReviewError(null)} />
            </div>
          ) : existingReview ? (
            <div className="p-8 max-w-2xl">
              <ReviewPanel
                review={existingReview}
                toolsExpanded={toolsExpanded}
                onToggleTools={() => setToolsExpanded((v) => !v)}
              />
            </div>
          ) : activePr ? (
            <div className="p-8 max-w-2xl">
              <ReadyToReview pr={activePr} onReview={() => triggerReview(activePr)} />
            </div>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Sidebar row ──────────────────────────────────────────────────────────────

function PRRow({ pr, isSelected, isReviewed, isRunning, onClick }: {
  pr: PR; isSelected: boolean; isReviewed: boolean; isRunning: boolean; onClick: () => void;
}) {
  const bg     = isSelected ? 'rgba(79,110,247,0.1)' : 'transparent';
  const border = isSelected ? '1px solid rgba(79,110,247,0.25)' : '1px solid transparent';

  return (
    <button
      onClick={onClick}
      className="w-full text-left relative transition-all"
      style={{ background: bg, border, borderRadius: 4, padding: '8px 10px' }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.border = '1px solid #2a2a2a'; } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; } }}
    >
      {isSelected && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
          style={{ width: 2, height: 20, background: '#4f6ef7' }}
        />
      )}
      <div className="flex items-start gap-2 pl-1">
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium leading-snug line-clamp-2"
            style={{ color: isSelected ? 'var(--foreground)' : 'var(--text-body-soft)' }}
          >
            {pr.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-semibold" style={{ fontFamily: 'var(--font-geist-mono)', color: '#4f6ef7' }}>
              #{pr.number}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-label)' }}>
              {pr.author}
            </span>
            {pr.draft && (
              <span className="text-[10px] italic" style={{ color: 'var(--muted-foreground)' }}>draft</span>
            )}
          </div>
        </div>
        {isRunning
          ? <Loader2 className="w-3 h-3 animate-spin shrink-0 mt-0.5" style={{ color: '#4f6ef7' }} />
          : isReviewed
          ? <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5 text-emerald-500" />
          : null
        }
      </div>
    </button>
  );
}

// ─── Ready to review ──────────────────────────────────────────────────────────

function ReadyToReview({ pr, onReview }: { pr: PR; onReview: () => void }) {
  return (
    <div className="space-y-6">
      {/* Terminal-style panel header */}
      <div
        className="rounded"
        style={{ border: '1px solid #2a2a2a', background: '#1c1c1c' }}
      >
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: '1px solid #2a2a2a' }}
        >
          <span
            className="text-[10px] font-semibold tracking-widest"
            style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}
          >
            PR_DETAILS
          </span>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors text-[10px]"
            style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#4f6ef7')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-label)')}
          >
            <ExternalLink className="w-3 h-3" />
            VIEW_ON_GITHUB
          </a>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold"
              style={{ fontFamily: 'var(--font-geist-mono)', color: '#4f6ef7' }}
            >
              #{pr.number}
            </span>
            {pr.draft && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ border: '1px solid #2a2a2a', color: 'var(--text-label)', fontFamily: 'var(--font-geist-mono)' }}
              >
                DRAFT
              </span>
            )}
          </div>
          <h1 className="text-base font-semibold text-white leading-snug">{pr.title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-[11px]" style={{ color: 'var(--text-meta)' }}>
              <span style={{ color: 'var(--text-label)' }}>author:</span> {pr.author}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-label)' }}>
              {formatPrDate(pr.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Agent execute block */}
      <div
        className="rounded"
        style={{ border: '1px solid #2a2a2a', background: '#1c1c1c' }}
      >
        <div
          className="flex items-center px-4 py-2"
          style={{ borderBottom: '1px solid #2a2a2a' }}
        >
          <span
            className="text-[10px] font-semibold tracking-widest"
            style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}
          >
            AGENT_EXECUTE
          </span>
        </div>
        <div className="px-4 py-4">
          <div
            className="rounded px-3 py-2.5 mb-4 space-y-1"
            style={{ background: '#161616', border: '1px solid #222' }}
          >
            {['GITHUB_GET_A_PULL_REQUEST', 'GITHUB_LIST_PULL_REQUESTS_FILES', 'GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST', 'SLACK_SEND_MESSAGE'].map((tool) => (
              <div key={tool} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--text-faint)' }} />
                <span
                  className="text-[10px]"
                  style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-meta)' }}
                >
                  {tool}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--text-meta)' }}>
              Claude reads the diff · posts inline comments · sends Slack summary
            </p>
            <Button
              onClick={onReview}
              className="shrink-0 text-white text-xs px-4 h-8 rounded gap-1.5 font-medium transition-colors"
              style={{ background: '#4f6ef7', border: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#6278f8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#4f6ef7')}
            >
              <Sparkles className="w-3 h-3" />
              RUN_REVIEW
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent running ────────────────────────────────────────────────────────────

function AgentRunning({ prNumber }: { prNumber: number }) {
  const steps = [
    'GITHUB_GET_A_PULL_REQUEST',
    'GITHUB_LIST_PULL_REQUESTS_FILES',
    'Analyzing diff with claude-sonnet-4-6',
    'GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST',
    'SLACK_SEND_MESSAGE',
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 4500);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="rounded" style={{ border: '1px solid rgba(79,110,247,0.3)', background: '#1a1d2e' }}>
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid rgba(79,110,247,0.2)' }}
      >
        <span
          className="text-[10px] font-semibold tracking-widest"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#4f6ef7' }}
        >
          AGENT_RUNNING
        </span>
        <span
          className="text-[10px]"
          style={{ fontFamily: 'var(--font-geist-mono)', color: '#4f6ef7', opacity: 0.6 }}
        >
          PR_{prNumber}
        </span>
      </div>
      <div className="px-4 py-4 space-y-2.5">
        {steps.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-3 transition-opacity duration-500"
            style={{ opacity: i <= step ? 1 : 0.2 }}
          >
            <div className="w-4 h-4 shrink-0 flex items-center justify-center">
              {i < step
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                : i === step
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#4f6ef7' }} />
                : <span className="w-1 h-1 rounded-full" style={{ background: '#2a2a2a' }} />
              }
            </div>
            <span
              className="text-[11px]"
              style={{
                fontFamily: 'var(--font-geist-mono)',
                color: i === step ? 'var(--foreground)' : i < step ? 'var(--text-label)' : 'var(--text-faint)',
              }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Error panel ──────────────────────────────────────────────────────────────

function ErrorPanel({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="rounded" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: '1px solid rgba(239,68,68,0.15)' }}
      >
        <AlertCircle className="w-3 h-3 text-red-400" />
        <span
          className="text-[10px] font-semibold tracking-widest text-red-400"
          style={{ fontFamily: 'var(--font-geist-mono)' }}
        >
          REVIEW_FAILED
        </span>
      </div>
      <div className="px-4 py-4">
        <p className="text-xs mb-4" style={{ color: 'var(--text-body-soft)', lineHeight: 1.6 }}>{message}</p>
        <button
          onClick={onDismiss}
          className="text-[10px] transition-colors"
          style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-body-soft)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-label)')}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}

// ─── Review panel ─────────────────────────────────────────────────────────────

function ReviewPanel({ review, toolsExpanded, onToggleTools }: {
  review: Review; toolsExpanded: boolean; onToggleTools: () => void;
}) {
  const highCount   = review.issues.filter(i => i.severity === 'high').length;
  const mediumCount = review.issues.filter(i => i.severity === 'medium').length;
  const lowCount    = review.issues.filter(i => (i.severity ?? 'low') === 'low').length;

  return (
    <div className="space-y-4">

      {/* Status bar */}
      <div
        className="rounded px-4 py-3 flex items-center justify-between flex-wrap gap-3"
        style={{ border: '1px solid #2a2a2a', background: '#1c1c1c' }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">PR #{review.prNumber}</span>
          <span className="text-xs" style={{ color: 'var(--text-meta)' }}>{review.prTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip color="emerald" label="GITHUB_REVIEW_POSTED" />
          <StatusChip color="blue"    label="SLACK_NOTIFIED" />
        </div>
      </div>

      {/* Severity counts */}
      {review.issues.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}>
            ISSUES:
          </span>
          {highCount > 0 && (
            <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-red-400">{highCount}_high</span>
            </span>
          )}
          {mediumCount > 0 && (
            <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-amber-400">{mediumCount}_medium</span>
            </span>
          )}
          {lowCount > 0 && (
            <span className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span className="text-slate-400">{lowCount}_low</span>
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      <Section label="REVIEW_SUMMARY">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body-soft)' }}>{review.summary}</p>
      </Section>

      {/* Issues */}
      {review.issues.length > 0 && (
        <Section label={`FINDINGS  // ${review.issues.length} total`}>
          <div className="space-y-2">
            {review.issues.map((issue, i) => {
              const sev = issue.severity ?? 'low';
              return (
                <div
                  key={i}
                  className="rounded px-3 py-3"
                  style={{ border: '1px solid #242424', background: '#181818' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[sev]}`} />
                    <code
                      className="text-[11px]"
                      style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-meta)' }}
                    >
                      {issue.file}
                      {issue.line > 0 && <span style={{ color: 'var(--text-label)' }}>:{issue.line}</span>}
                    </code>
                    <span
                      className={`ml-auto text-[10px] uppercase font-semibold ${SEV_TEXT[sev]}`}
                      style={{ fontFamily: 'var(--font-geist-mono)' }}
                    >
                      {sev}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed pl-3.5" style={{ color: 'var(--text-body-soft)' }}>
                    {issue.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Top suggestion */}
      {review.suggestion && (
        <Section label="TOP_SUGGESTION">
          <div
            className="rounded px-3 py-3"
            style={{ border: '1px solid rgba(79,110,247,0.2)', background: 'rgba(79,110,247,0.06)' }}
          >
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-body-soft)' }}>{review.suggestion}</p>
          </div>
        </Section>
      )}

      {/* Agent trace */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 12 }}>
        <button
          onClick={onToggleTools}
          className="w-full flex items-center justify-between py-1 group transition-colors"
        >
          <span
            className="flex items-center gap-2 text-[10px] font-semibold tracking-widest"
            style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}
          >
            AGENT_TRACE
            <span className="font-normal normal-case" style={{ color: 'var(--text-faint)' }}>
              // {review.toolCalls.length} calls
            </span>
          </span>
          {toolsExpanded
            ? <ChevronUp className="w-3 h-3" style={{ color: 'var(--text-label)' }} />
            : <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-label)' }} />
          }
        </button>
        {toolsExpanded && (
          <div
            className="mt-2 rounded"
            style={{ border: '1px solid #242424', background: '#181818' }}
          >
            {review.toolCalls.map((call, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3.5 py-2.5"
                style={{ borderBottom: i < review.toolCalls.length - 1 ? '1px solid #222' : 'none' }}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="text-xs" style={{ color: 'var(--text-meta)' }}>
                  {TOOL_LABELS[call] ?? call}
                </span>
                <code
                  className="ml-auto text-[10px] hidden sm:block"
                  style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-faint)' }}
                >
                  {call}
                </code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded" style={{ border: '1px solid #2a2a2a', background: '#1c1c1c' }}>
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid #252525' }}
      >
        <span
          className="text-[10px] font-semibold tracking-widest"
          style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-label)' }}
        >
          {label}
        </span>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function StatusChip({ color, label }: { color: 'emerald' | 'blue'; label: string }) {
  const styles = {
    emerald: { border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.07)', color: '#34d399' },
    blue:    { border: '1px solid rgba(79,110,247,0.25)', background: 'rgba(79,110,247,0.08)', color: '#4f6ef7' },
  }[color];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded"
      style={{ fontFamily: 'var(--font-geist-mono)', ...styles }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: styles.color }} />
      {label}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ border: '1px solid #2a2a2a', background: '#1c1c1c' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3C6.13 3 3 6.13 3 10s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 2c1.2 0 2.32.38 3.24 1.02L5.02 13.24A4.96 4.96 0 015 10c0-2.76 2.24-5 5-5zm0 10c-1.2 0-2.32-.38-3.24-1.02l8.22-8.22A4.96 4.96 0 0115 10c0 2.76-2.24 5-5 5z" fill="var(--text-faint)"/>
        </svg>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm" style={{ color: 'var(--text-meta)' }}>No pull request selected</p>
        <p className="text-xs" style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--text-faint)' }}>
          // select a PR from the sidebar
        </p>
      </div>
    </div>
  );
}
