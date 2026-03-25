import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reviewPR } from '@/server/agent';
import { prisma } from '@/server/db';

const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? '';

if (!SECRET) {
  console.warn('[webhook] GITHUB_WEBHOOK_SECRET is not set — all webhook requests will be rejected');
}

function verifySignature(body: string, sigHeader: string): boolean {
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sigHeader));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('x-hub-signature-256') ?? '';

  if (!verifySignature(body, sig)) {
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  if (event !== 'pull_request') {
    return NextResponse.json({ skipped: true });
  }

  const payload = JSON.parse(body);
  const { action, pull_request: pr, repository } = payload;

  if (action !== 'opened' && action !== 'synchronize') {
    return NextResponse.json({ skipped: true });
  }

  const repo = repository.full_name as string;
  const slackChannel = process.env.SLACK_CHANNEL ?? '#pr-reviews';

  // Deduplicate: ignore if we already have a review for this PR + commit SHA
  const existing = await prisma.review.findFirst({
    where: { prNumber: pr.number, repo },
  });
  if (existing) {
    return NextResponse.json({ skipped: true, reason: 'already reviewed' });
  }

  // Respond 202 immediately so GitHub doesn't time out and retry
  const responsePromise = NextResponse.json({ queued: true }, { status: 202 });

  reviewPR(pr.number, repo, slackChannel)
    .then((result) =>
      prisma.review.create({
        data: {
          prNumber:   pr.number,
          prTitle:    pr.title,
          prUrl:      pr.html_url,
          author:     pr.user.login,
          repo,
          summary:    result.summary,
          issues:     JSON.stringify(result.issues),
          suggestion: result.suggestion,
          toolCalls:  JSON.stringify(result.toolCalls),
        },
      })
    )
    .catch((err) => console.error('[webhook] review failed:', err));

  return responsePromise;
}
