import Anthropic from '@anthropic-ai/sdk';
import { Composio } from '@composio/core';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// Composio returns OpenAI-format tools. Convert to Anthropic format.
function toAnthropicTools(openaiTools: any[]): Anthropic.Tool[] {
  return openaiTools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
  }));
}

export type IssueSeverity = 'low' | 'medium' | 'high';

export interface ReviewIssue {
  file: string;
  line: number;
  description: string;
  severity: IssueSeverity;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  suggestion: string;
  toolCalls: string[];
}

async function sendSlackFallback(channel: string, text: string) {
  try {
    await composio.tools.execute('SLACK_SEND_MESSAGE', {
      userId: 'default',
      dangerouslySkipVersionCheck: true,
      arguments: { channel, markdown_text: text },
    });
  } catch (err) {
    console.error('Slack fallback failed:', err);
  }
}

export async function reviewPR(
  prNumber: number,
  repo: string,
  slackChannel: string
): Promise<ReviewResult> {
  const [owner, repoName] = repo.split('/');
  // Strip leading # — Slack tool says it auto-strips, but be explicit
  const channel = slackChannel.replace(/^#/, '');

  // Fetch tools from Composio (OpenAI format) then convert for Anthropic
  const openaiTools = await composio.tools.get('default', {
    tools: [
      'GITHUB_GET_A_PULL_REQUEST',
      'GITHUB_LIST_PULL_REQUESTS_FILES',
      'GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST',
      'SLACK_SEND_MESSAGE',
    ],
  });

  const tools = toAnthropicTools(openaiTools as any[]);
  const toolCallLog: string[] = [];

  const systemPrompt = `You are a senior software engineer performing a thorough code review.

You MUST complete ALL of the following steps. Do not stop early.

Step 1: Call GITHUB_GET_A_PULL_REQUEST (owner="${owner}", repo="${repoName}", pull_number=${prNumber})
Step 2: Call GITHUB_LIST_PULL_REQUESTS_FILES (owner="${owner}", repo="${repoName}", pull_number=${prNumber})
Step 3: Analyze the diffs carefully for bugs, security issues, performance problems, and missing edge cases
Step 4: Call GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST with a comprehensive body, the correct event ("COMMENT", "REQUEST_CHANGES", or "APPROVE"), and inline comments on specific lines
Step 5: Call SLACK_SEND_MESSAGE with channel="${channel}" and a markdown_text summary of your findings. This step is REQUIRED — do not skip it.

Be specific, constructive, and professional.

After completing all tool calls, output a final JSON block in this exact format:
<review_json>
{
  "summary": "One paragraph summary of the overall review",
  "issues": [{"file": "path/to/file.ts", "line": 42, "description": "Specific issue description", "severity": "low | medium | high"}],
  "suggestion": "Most important single improvement to make"
}
</review_json>

Severity guide:
- high: security vulnerabilities, data loss risk, crashes, broken logic
- medium: performance problems, missing error handling, incorrect types
- low: style, naming, minor improvements, missing comments`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Review PR #${prNumber} in the ${repo} repository. Complete all 5 steps including the Slack notification to channel "${channel}".`,
    },
  ];

  // Agentic loop — runs until Claude stops requesting tools
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        toolCallLog.push(block.name);

        let resultContent: string;
        try {
          const result = await composio.tools.execute(block.name, {
            userId: 'default',
            dangerouslySkipVersionCheck: true,
            arguments: block.input as Record<string, unknown>,
          });
          resultContent = JSON.stringify(result.data ?? result);
        } catch (err) {
          resultContent = JSON.stringify({ error: String(err) });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: resultContent,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Guarantee Slack notification — fire directly if Claude didn't call it
  if (!toolCallLog.includes('SLACK_SEND_MESSAGE')) {
    const fallbackText = `*PR #${prNumber} reviewed* in \`${repo}\`\n\nReview posted to GitHub. Check the PR for inline comments.`;
    await sendSlackFallback(channel, fallbackText);
    toolCallLog.push('SLACK_SEND_MESSAGE');
  }

  // Extract structured JSON from the final assistant message
  const allText = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => (b as Anthropic.TextBlock).text)
    .join('');

  const jsonMatch = allText.match(/<review_json>([\s\S]*?)<\/review_json>/);
  let parsed: Omit<ReviewResult, 'toolCalls'> = {
    summary: 'Review completed successfully.',
    issues: [],
    suggestion: '',
  };

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      // fallback to defaults above
    }
  }

  return { ...parsed, toolCalls: toolCallLog };
}
