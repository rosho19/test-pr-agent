import { NextResponse } from 'next/server';
import { Composio } from '@composio/core';

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

export async function GET() {
  const repo = process.env.GITHUB_REPO;
  if (!repo) {
    return NextResponse.json({ error: 'GITHUB_REPO not configured' }, { status: 500 });
  }

  const [owner, repoName] = repo.split('/');

  try {
    const result = await composio.tools.execute('GITHUB_LIST_PULL_REQUESTS', {
      userId: 'default',
      dangerouslySkipVersionCheck: true,
      arguments: { owner, repo: repoName, state: 'open' },
    });

    const prs = Array.isArray(result.data) ? result.data : [];

    const simplified = prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user?.login ?? 'unknown',
      createdAt: pr.created_at,
      draft: pr.draft ?? false,
      additions: pr.additions ?? null,
      deletions: pr.deletions ?? null,
      changedFiles: pr.changed_files ?? null,
    }));

    return NextResponse.json(simplified);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
