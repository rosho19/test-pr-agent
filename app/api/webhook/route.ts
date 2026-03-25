import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reviewPR } from '@/lib/agent';
import { prisma } from '@/lib/db';

// GITHUB_WEBHOOK_SECRET is read once at module load. If the env var is missing
// or empty, the HMAC still runs against an empty string — it will produce a
// valid digest that never matches GitHub's, but it won't throw. A missing
// secret should be caught at startup, not silently at request time.
const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? '';

function verifySignature(body: string, sigHeader: string): boolean {
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(body).digest('hex');

  // Plain string equality is vulnerable to timing attacks. An attacker can
  // send many crafted payloads and measure response-time differences to
  // brute-force the correct HMAC one character at a time.
  // Fix: crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sigHeader))
  return digest === sigHeader;
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

  // No deduplication guard. GitHub retries webhook deliveries on timeout or
  // network failure. Without checking for an existing review keyed on
  // prNumber + pr.head.sha, retries will trigger duplicate reviews and flood
  // the Slack channel with identical summaries.

  // reviewPR() takes 30–60 seconds. GitHub's webhook delivery times out after
  // 10 seconds and marks the delivery failed — which triggers an automatic
  // retry (see above). The fix is to respond 202 immediately and run the
  // review in the background:
  //
  //   reviewPR(pr.number, repo, slackChannel)
  //     .then((result) => saveReview(pr, repo, result))
  //     .catch((err) => console.error('Review failed:', err));
  //   return NextResponse.json({ queued: true }, { status: 202 });
  //
  try {
    const result = await reviewPR(pr.number, repo, slackChannel);

    await prisma.review.create({
      data: {
        prNumber:  pr.number,
        prTitle:   pr.title,
        prUrl:     pr.html_url,
        author:    pr.user.login,
        repo,
        summary:   result.summary,
        issues:    JSON.stringify(result.issues),
        suggestion: result.suggestion,
        toolCalls: JSON.stringify(result.toolCalls),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
