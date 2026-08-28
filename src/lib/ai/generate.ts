import {
  type AiConfig,
  type AiReplyMode,
  type AiUsage,
  type ChatMessage,
  type GenerateResult,
} from './types'
import { HANDOFF_SENTINEL, aiRequestTimeoutMs } from './defaults'
import { generateWithAiSdk } from './providers/ai-sdk'
import type { AgentToolsContext } from './tool-context'

export interface GenerateArgs {
  config: AiConfig
  /** Fully-built system prompt (see `buildSystemPrompt`). */
  systemPrompt: string
  /** Recent conversation turns, oldest first. */
  messages: ChatMessage[]
  /** Draft is text-only; auto-reply enables agent tools (e.g. handoff). */
  mode?: AiReplyMode
  /** Live thread context for CRM tools; omitted in draft/playground. */
  toolContext?: AgentToolsContext | null
}

/**
 * Generate the next reply from the account's configured provider via the
 * Vercel AI SDK. Parses the handoff sentinel and tool-based handoffs out
 * of the result. Throws `AiError` on any provider/network failure.
 */
export async function generateReply(args: GenerateArgs): Promise<GenerateResult> {
  const { config, systemPrompt, messages, mode = 'draft', toolContext } = args
  const timeoutMs = aiRequestTimeoutMs()

  const result = await generateWithAiSdk({
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt,
    messages,
    timeoutMs,
    mode,
    toolContext,
  })

  const parsed = parseGeneration(result.text, result.usage)
  return {
    ...parsed,
    handoff: parsed.handoff || result.handoffFromTool,
    toolCalls: result.toolCalls,
  }
}

/**
 * Split the raw model output into `{ text, handoff, usage }`. The
 * sentinel can appear alone or trailing a partial reply; either way we
 * treat the turn as a handoff and strip the marker from any remaining
 * text. `usage` is passed straight through (null when the provider
 * didn't report it).
 */
export function parseGeneration(
  raw: string,
  usage: AiUsage | null = null,
): Omit<GenerateResult, 'toolCalls'> {
  const handoff = raw.includes(HANDOFF_SENTINEL)
  const text = raw.split(HANDOFF_SENTINEL).join('').trim()
  return { text, handoff, usage }
}
