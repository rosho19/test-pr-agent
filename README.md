
# PR Review Agent

An AI-powered pull request reviewer built with [Composio](https://composio.dev) + [Claude](https://anthropic.com). Point it at any GitHub repo and it will automatically read the diff, post inline review comments, and send a Slack summary — all driven by a Claude agentic loop with Composio-managed GitHub and Slack integrations.

## What it does

1. Lists open pull requests from your configured GitHub repo
2. On demand (click **RUN_REVIEW**), Claude runs an agentic loop using Composio tools to:
   - Fetch the PR metadata and changed files
   - Analyze the diff for bugs, security issues, and performance problems
   - Post an inline code review directly to GitHub
   - Send a Slack notification with the summary
3. Stores all reviews in a local SQLite database and displays them in the dashboard

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your keys (see below)
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key — [console.anthropic.com](https://console.anthropic.com) |
| `COMPOSIO_API_KEY` | Composio API key — [app.composio.dev](https://app.composio.dev) |
| `GITHUB_REPO` | Target repo in `owner/repo` format, e.g. `rosho19/test-pr-agent` |
| `NEXT_PUBLIC_GITHUB_REPO` | Same value as `GITHUB_REPO` (exposes the repo name to the browser for the header) |
| `SLACK_CHANNEL` | Slack channel for notifications, e.g. `#pr-reviews` |
| `DATABASE_URL` | SQLite path — `file:./prisma/dev.db` works out of the box |
| `GITHUB_WEBHOOK_SECRET` | *(Optional)* Secret for verifying GitHub webhook payloads |

### Composio account setup

Connect your GitHub and Slack accounts before running:

```bash
pip install composio-core
composio login
composio add github
composio add slack
```

Or connect apps manually at [app.composio.dev](https://app.composio.dev).

## Tech stack

- **Next.js 16** (App Router) — frontend + API routes
- **Anthropic SDK** — Claude `claude-sonnet-4-6` agentic loop
- **Composio SDK** (`@composio/core`) — GitHub + Slack tool execution
- **Prisma 7 + SQLite** — review history storage
- **Tailwind CSS v4 + shadcn/ui** — UI components
