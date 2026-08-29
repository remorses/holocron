// Allowed Holocron AI models. Chat (`gateway.ts`) uses ALLOWED_MODELS for
// fallback. Maintain (`maintain-api.ts`) uses MAINTAIN_MODELS only.
// Friendly name → Vercel AI Gateway id (`provider/model`).
// Order matters for chat: the first entry is the primary model; the rest are fallbacks.

export const DEFAULT_MODEL = 'deepseek-v4-flash'

export const ALLOWED_MODELS: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'glm-5.3-flash': 'zai/glm-5.3-flash',
}

export const MAINTAIN_MODELS: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'glm-5.3-flash': 'zai/glm-5.3-flash',
}

export const MODEL_USD_PER_1M_TOKENS: Record<string, { input: number; output: number; cachedInput?: number }> = {
  'deepseek-v4-flash': { input: 0.2, output: 0.6, cachedInput: 0.05 },
  'glm-5.3-flash': { input: 0.075, output: 0.25, cachedInput: 0.02 },
}

const FORWARDED_CHAT_FIELDS = [
  'messages',
  'temperature',
  'top_p',
  'stop',
  'seed',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'response_format',
  'frequency_penalty',
  'presence_penalty',
  'reasoning_effort',
] as const

export const MAX_OUTPUT_TOKENS = 16_000

function resolveModel(requested: unknown, models: Record<string, string>) {
  if (typeof requested !== 'string') return null
  if (models[requested]) return requested
  const match = Object.entries(models).find(([, gatewayId]) => gatewayId === requested)
  return match?.[0] ?? null
}

export function resolveAllowedModel(requested: unknown): string {
  return resolveModel(requested, ALLOWED_MODELS) ?? DEFAULT_MODEL
}

export function gatewayIdFor(friendly: string): string {
  return ALLOWED_MODELS[friendly] ?? ALLOWED_MODELS[DEFAULT_MODEL]!
}

function buildChatBody(incoming: Record<string, unknown>, friendlyModel: string, models: Record<string, string>) {
  const stream = incoming.stream === true
  const asked = typeof incoming.max_tokens === 'number' && Number.isFinite(incoming.max_tokens)
    ? incoming.max_tokens
    : MAX_OUTPUT_TOKENS
  const body: Record<string, unknown> = {
    model: models[friendlyModel] ?? models[DEFAULT_MODEL]!,
    max_tokens: Math.min(Math.max(1, Math.floor(asked)), MAX_OUTPUT_TOKENS),
    stream,
  }
  for (const field of FORWARDED_CHAT_FIELDS) {
    if (incoming[field] !== undefined) body[field] = incoming[field]
  }
  if (stream) body.stream_options = { include_usage: true }
  return { body, friendlyModel, stream }
}

export function buildUpstreamChatBody(incoming: Record<string, unknown>) {
  return buildChatBody(incoming, resolveAllowedModel(incoming.model), ALLOWED_MODELS)
}

export function buildMaintainChatBody(incoming: Record<string, unknown>) {
  const friendlyModel = resolveModel(incoming.model, MAINTAIN_MODELS)
  if (!friendlyModel) return null
  return buildChatBody(incoming, friendlyModel, MAINTAIN_MODELS)
}
