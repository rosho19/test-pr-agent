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

export interface ReviewResult {
  summary: string;
  issues: Array<{ file: string; line: number; description: string }>;
  suggestion: string;
  toolCalls: string[];
}

export async function reviewPR(
  prNumber: number,
  repo: string,
  slackChannel: string
): Promise<ReviewResult> {
  const [owner, repoName] = repo.split('/');

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

Follow these steps in order:
1. Call GITHUB_GET_A_PULL_REQUEST to read the PR title, description, and metadata
2. Call GITHUB_LIST_PULL_REQUESTS_FILES to get all changed files and their diffs (patches)
3. Analyze the diffs carefully for: bugs, security issues, performance problems, code style, and missing edge cases
4. Call GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST with:
   - A comprehensive body summarizing your overall assessment
   - event: "COMMENT" for neutral reviews, "REQUEST_CHANGES" if there are blocking issues, "APPROVE" if everything looks great
   - Specific inline comments array targeting exact file paths and line numbers from the diff
5. Call SLACK_SEND_MESSAGE to send a concise summary to the team

Always use owner="${owner}" and repo="${repoName}" in GitHub tool calls.
Be specific, constructive, and professional.

After completing all tool calls, output a final JSON block in this exact format:
<review_json>
{
  "summary": "One paragraph summary of the overall review",
  "issues": [{"file": "path/to/file.ts", "line": 42, "description": "Specific issue description"}],
  "suggestion": "Most important single improvement to make"
}
</review_json>`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Review PR #${prNumber} in the ${repo} repository. Post your findings directly to GitHub and send a summary to Slack channel "${slackChannel}".`,
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
