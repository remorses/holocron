/**
 * AI agent detection for raw markdown serving.
 *
 * Used by the agent redirect middleware in app-factory.tsx to
 * 302-redirect AI agents to `.md` URLs.
 */

/** UA substrings that identify known AI agents (case-insensitive). */
const AGENT_UA_PATTERNS = [
  /claudebot/i,
  /claude-user/i,
  /claude-searchbot/i,
  /claude-code/i,
  /claude-cli/i,
  /claude\/\d/i,
  /anthropic/i,
  /chatgpt-user/i,
  /gpt-?bot/i,
  /oai-searchbot/i,
  /opencode/i,
  /cohere-ai/i,
  /perplexitybot/i,
]

/** Check if the request comes from an AI agent or explicitly asks for markdown. */
export function isAgentRequest(request: Request): boolean {
  // Accept header contains text/markdown (case-insensitive per HTTP spec)
  const accept = (request.headers.get('accept') ?? '').toLowerCase()
  if (accept.includes('text/markdown')) return true

  // ChatGPT's RFC 9421 Signature-Agent header
  if (request.headers.has('signature-agent')) return true

  // User-Agent matches known AI agent patterns
  const ua = request.headers.get('user-agent') || ''
  return AGENT_UA_PATTERNS.some((pattern) => pattern.test(ua))
}
