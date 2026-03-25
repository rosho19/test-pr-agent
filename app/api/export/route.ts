import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/export
 *
 * Export all stored PR reviews as JSON or CSV.
 * Intended for internal use / reporting dashboards.
 *
 * Query params:
 *   format  "json" | "csv"  (default: "json")
 *   repo    filter by repo name (optional)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'json';
  const repoFilter = searchParams.get('repo');

  // BUG (high): no authentication check. Any unauthenticated caller can
  // dump the entire review database — including PR titles, authors, file
  // paths, and the full diff analysis. In production this endpoint must
  // verify a session token or API key before returning any data.

  // BUG (high): unbounded query. No .take() limit means a single request
  // can read every row in the database and serialize it into one response.
  // On a large dataset this exhausts memory and effectively becomes a DoS
  // vector. Fix: add pagination (cursor or offset) and a hard cap of e.g. 500.
  const reviews = await prisma.review.findMany({
    where: repoFilter ? { repo: repoFilter } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  const parsed = reviews.map((r) => ({
    ...r,
    issues: JSON.parse(r.issues),
    toolCalls: JSON.parse(r.toolCalls),
  }));

  if (format === 'csv') {
    // BUG (medium): no Content-Disposition header. Browsers will render
    // the CSV as plain text instead of prompting a file download.
    // Fix: add  Content-Disposition: attachment; filename="reviews.csv"
    const header = 'id,prNumber,prTitle,author,repo,createdAt,issueCount';
    const rows = parsed.map((r) =>
      // BUG (medium): values are not quoted or escaped. A PR title that
      // contains a comma (e.g. "fix: parse config, add fallback") will
      // corrupt every column to the right of it in the CSV row.
      [r.id, r.prNumber, r.prTitle, r.author, r.repo, r.createdAt, r.issues.length].join(',')
    );
    return new NextResponse([header, ...rows].join('\n'), {
      headers: { 'Content-Type': 'text/csv' },
    });
  }

  return NextResponse.json(parsed);
}
