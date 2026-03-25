import { NextRequest, NextResponse } from 'next/server';
import { reviewPR } from '@/lib/agent';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prNumber, prTitle, prUrl, author } = body;

  if (!prNumber) {
    return NextResponse.json({ error: 'prNumber is required' }, { status: 400 });
  }

  const repo = process.env.GITHUB_REPO!;
  const slackChannel = process.env.SLACK_CHANNEL ?? '#pr-reviews';

  try {
    const result = await reviewPR(prNumber, repo, slackChannel);

    const saved = await prisma.review.create({
      data: {
        prNumber,
        prTitle: prTitle ?? `PR #${prNumber}`,
        prUrl: prUrl ?? '',
        author: author ?? 'unknown',
        repo,
        summary: result.summary,
        issues: JSON.stringify(result.issues),
        suggestion: result.suggestion,
        toolCalls: JSON.stringify(result.toolCalls),
      },
    });

    return NextResponse.json({
      ...saved,
      issues: result.issues,
      toolCalls: result.toolCalls,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
