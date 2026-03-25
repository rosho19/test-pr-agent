'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  GitPullRequest,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
} from 'lucide-react';

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

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  high:   'bg-red-900/40 text-red-400 border-red-800/40',
  medium: 'bg-amber-900/40 text-amber-400 border-amber-800/40',
  low:    'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',
};

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

type ReviewState =
  | { status: 'idle' }
  | { status: 'loading'; prNumber: number }
  | { status: 'done'; review: Review }
  | { status: 'error'; message: string };

const TOOL_LABELS: Record<string, string> = {
  GITHUB_GET_A_PULL_REQUEST: 'Fetched PR metadata',
  GITHUB_LIST_PULL_REQUESTS_FILES: 'Read changed files & diffs',
  GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST: 'Posted review to GitHub',
  SLACK_SEND_MESSAGE: 'Sent summary to Slack',
};

export default function Dashboard() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [prsLoading, setPrsLoading] = useState(true);
  const [prsError, setPrsError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>({ status: 'idle' });
  const [history, setHistory] = useState<Review[]>([]);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const fetchPRs = useCallback(async () => {
    setPrsLoading(true);
    setPrsError(null);
    try {
      const res = await fetch('/api/prs');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to fetch PRs');
      }
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

  useEffect(() => {
    fetchPRs();
    fetchHistory();
  }, [fetchPRs, fetchHistory]);

  async function triggerReview(pr: PR) {
    setReviewState({ status: 'loading', prNumber: pr.number });
    setToolsExpanded(false);
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.url,
          author: pr.author,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Review failed');
      setReviewState({ status: 'done', review: data });
      fetchHistory();
    } catch (err: any) {
      setReviewState({ status: 'error', message: err.message });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitPullRequest className="w-6 h-6 text-violet-400" />
          <h1 className="text-lg font-semibold tracking-tight">PR Review Agent</h1>
          <Badge variant="outline" className="text-zinc-400 border-zinc-700 font-mono text-xs">
            rosho19/test-pr-agent
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Claude Sonnet · Composio
        </div>
      </header>

      <div className="flex h-[calc(100vh-61px)]">
        {/* Left panel — PR list */}
        <aside className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800">
            <span className="text-sm font-medium text-zinc-300">Open Pull Requests</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPRs}
              disabled={prsLoading}
              className="h-7 px-2 text-zinc-400 hover:text-zinc-100"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${prsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {prsLoading ? (
              <div className="flex items-center justify-center py-12 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading PRs…</span>
              </div>
            ) : prsError ? (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50">
                <p className="text-xs text-red-400">{prsError}</p>
              </div>
            ) : prs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
                <GitPullRequest className="w-8 h-8 opacity-30" />
                <p className="text-sm">No open PRs</p>
                <p className="text-xs text-center text-zinc-600">
                  Create a pull request in<br />
                  <span className="font-mono text-zinc-500">rosho19/test-pr-agent</span>
                </p>
              </div>
            ) : (
              prs.map((pr) => (
                <PRCard
                  key={pr.number}
                  pr={pr}
                  isReviewing={
                    reviewState.status === 'loading' && reviewState.prNumber === pr.number
                  }
                  onReview={() => triggerReview(pr)}
                  disabled={reviewState.status === 'loading'}
                />
              ))
            )}
          </div>
        </aside>

        {/* Right panel — review output */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {reviewState.status === 'idle' && history.length === 0 && <EmptyState />}

          {reviewState.status === 'loading' && (
            <AgentRunning prNumber={reviewState.prNumber} />
          )}

          {reviewState.status === 'error' && (
            <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-5">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Review failed</span>
              </div>
              <p className="text-sm text-red-300/80">{reviewState.message}</p>
            </div>
          )}

          {reviewState.status === 'done' && (
            <ReviewPanel
              review={reviewState.review}
              toolsExpanded={toolsExpanded}
              onToggleTools={() => setToolsExpanded((v) => !v)}
            />
          )}

          {/* Review history */}
          {history.length > 0 && reviewState.status !== 'loading' && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">
                Review History
              </p>
              <div className="space-y-2">
                {history.map((r) => (
                  <HistoryCard
                    key={r.id}
                    review={r}
                    onClick={() => {
                      setReviewState({ status: 'done', review: r });
                      setToolsExpanded(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PRCard({
  pr,
  isReviewing,
  onReview,
  disabled,
}: {
  pr: PR;
  isReviewing: boolean;
  onReview: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug truncate text-zinc-100">{pr.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-violet-400">#{pr.number}</span>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <User className="w-3 h-3" />
              {pr.author}
            </span>
          </div>
        </div>
        {pr.draft && (
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500 shrink-0">
            Draft
          </Badge>
        )}
      </div>
      <Button
        size="sm"
        onClick={onReview}
        disabled={disabled}
        className="w-full h-7 text-xs bg-violet-600 hover:bg-violet-500 text-white"
      >
        {isReviewing ? (
          <>
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            Reviewing…
          </>
        ) : (
          'Review with AI'
        )}
      </Button>
    </div>
  );
}

function AgentRunning({ prNumber }: { prNumber: number }) {
  const steps = [
    'Fetching PR metadata…',
    'Reading changed files and diffs…',
    'Analyzing code with Claude…',
    'Posting review comments to GitHub…',
    'Sending summary to Slack…',
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 4500);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="rounded-xl border border-violet-800/50 bg-violet-950/20 p-6">
      <div className="flex items-center gap-3 mb-5">
        <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        <div>
          <p className="font-medium text-violet-300">Agent running on PR #{prNumber}</p>
          <p className="text-xs text-violet-400/70 mt-0.5">
            Claude is reviewing the code via Composio tools
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 text-sm transition-all duration-500 ${
              i <= step ? 'opacity-100' : 'opacity-20'
            }`}
          >
            {i < step ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : i === step ? (
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
            )}
            <span
              className={
                i === step
                  ? 'text-violet-200'
                  : i < step
                  ? 'text-zinc-400'
                  : 'text-zinc-600'
              }
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel({
  review,
  toolsExpanded,
  onToggleTools,
}: {
  review: Review;
  toolsExpanded: boolean;
  onToggleTools: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="font-semibold text-zinc-100">
              Review complete — PR #{review.prNumber}
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 ml-7">{review.prTitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-emerald-900/50 text-emerald-400 border-emerald-800/50 text-xs border">
            Posted to GitHub
          </Badge>
          <Badge className="bg-blue-900/50 text-blue-400 border-blue-800/50 text-xs border">
            Sent to Slack
          </Badge>
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Summary */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-400" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-sm text-zinc-300 leading-relaxed">{review.summary}</p>
        </CardContent>
      </Card>

      {/* Issues */}
      {review.issues.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Issues Found
              <Badge className="bg-amber-900/40 text-amber-400 border-amber-800/40 border text-xs ml-auto">
                {review.issues.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {review.issues.map((issue, i) => {
              const sev = issue.severity ?? 'low';
              return (
                <div key={i} className="rounded-lg bg-zinc-800/60 p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <code className="text-xs text-violet-300 font-mono">{issue.file}</code>
                    {issue.line > 0 && (
                      <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500 px-1.5 py-0">
                        line {issue.line}
                      </Badge>
                    )}
                    <Badge className={`text-xs border px-1.5 py-0 ml-auto capitalize ${SEVERITY_STYLES[sev]}`}>
                      {sev}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">{issue.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Top suggestion */}
      {review.suggestion && (
        <div className="rounded-lg border border-blue-800/40 bg-blue-950/20 p-4">
          <p className="text-xs font-medium text-blue-400 mb-1">Top suggestion</p>
          <p className="text-sm text-blue-200/80">{review.suggestion}</p>
        </div>
      )}

      {/* Tool call log */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <button
          onClick={onToggleTools}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-400 hover:bg-zinc-800/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-zinc-500" />
            Agent tool calls
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500 px-1.5 py-0">
              {review.toolCalls.length}
            </Badge>
          </span>
          {toolsExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {toolsExpanded && (
          <div className="border-t border-zinc-800 px-4 py-3 space-y-2.5 bg-zinc-900/50">
            {review.toolCalls.map((call, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs text-zinc-300">
                  {TOOL_LABELS[call] ?? call}
                </span>
                <code className="text-xs text-zinc-600 font-mono ml-auto hidden sm:block">
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

function HistoryCard({ review, onClick }: { review: Review; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-sm text-zinc-300 truncate">{review.prTitle}</span>
          <span className="text-xs font-mono text-violet-400 shrink-0">#{review.prNumber}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-600 shrink-0">
          <Clock className="w-3 h-3" />
          {new Date(review.createdAt).toLocaleDateString()}
        </div>
      </div>
      {review.issues.length > 0 && (
        <p className="text-xs text-zinc-500 mt-1 ml-5">
          {review.issues.length} issue{review.issues.length !== 1 ? 's' : ''} found
        </p>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-zinc-600">
      <GitPullRequest className="w-12 h-12 opacity-20" />
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-500">No reviews yet</p>
        <p className="text-xs mt-1 text-zinc-600">
          Select a pull request and click &quot;Review with AI&quot;
        </p>
      </div>
    </div>
  );
}
