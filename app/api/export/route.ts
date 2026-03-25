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
    const header = 'id,prNumber,prTitle,author,repo,createdAt,issueCount';
    const rows = parsed.map((r) =>
      [r.id, r.prNumber, r.prTitle, r.author, r.repo, r.createdAt, r.issues.length].join(',')
    );
    return new NextResponse([header, ...rows].join('\n'), {
      headers: { 'Content-Type': 'text/csv' },
    });
  }

  return NextResponse.json(parsed);
}
