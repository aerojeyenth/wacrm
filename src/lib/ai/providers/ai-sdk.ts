import { generateText, stepCountIs, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenRouterModel } from './openrouter'
import {
  AiError,
  type AiProvider,
  type AiUsage,
  type ChatMessage,
} from '../types'
import { AI_MAX_TOOL_STEPS, MAX_OUTPUT_TOKENS } from '../defaults'
import { buildAgentTools, type AgentToolsMode } from '../tools'
import { toAiError } from '../map-error'
import { mergeConsecutive } from './shared'

export interface AiSdkGenerateArgs {
  provider: AiProvider
  apiKey: string
  model: string
  systemPrompt: string
  messages: ChatMessage[]
  timeoutMs: number
  mode: AgentToolsMode
}

export interface AiSdkGenerateResult {
  text: string
  usage: AiUsage | null
  toolCalls: Array<{ toolName: string; input: unknown }>
  handoffFromTool: boolean
}

function createLanguageModel(
  provider: AiProvider,
  apiKey: string,
  model: string,
): LanguageModel {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
    case 'openrouter':
      return createOpenRouterModel(apiKey, model)
    default:
      throw new AiError(`Unsupported AI provider: ${provider}`, {
        code: 'unsupported_provider',
        status: 400,
      })
  }
}

/**
 * Anthropic requires strictly alternating roles that begin with `user`.
 * Drop any leading assistant turns (a bot greeting before the customer
 * spoke) so the payload is valid.
 */
function normalizeForAnthropic(messages: ChatMessage[]): ChatMessage[] {
  const merged = mergeConsecutive(messages)
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  if (merged.length === 0) {
    return [{ role: 'user', content: '(The customer has not sent a message yet.)' }]
  }
  return merged
}

function toProviderMessages(
  messages: ChatMessage[],
  provider: AiProvider,
): ChatMessage[] {
  return provider === 'anthropic' ? normalizeForAnthropic(messages) : mergeConsecutive(messages)
}

function normalizeUsage(raw: {
  prompt?: unknown
  completion?: unknown
  total?: unknown
}): AiUsage | null {
  const num = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
  const promptTokens = num(raw.prompt)
  const completionTokens = num(raw.completion)
  const total = num(raw.total)
  const totalTokens = total > 0 ? total : promptTokens + completionTokens
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null
  }
  return { promptTokens, completionTokens, totalTokens }
}

/**
 * Generate a reply via the Vercel AI SDK. Supports optional tool calling
 * (auto-reply mode) with a bounded multi-step loop.
 */
export async function generateWithAiSdk(
  args: AiSdkGenerateArgs,
): Promise<AiSdkGenerateResult> {
  const { provider, apiKey, model, systemPrompt, messages, timeoutMs, mode } = args
  const tools = buildAgentTools(mode)
  const hasTools = Object.keys(tools).length > 0

  try {
    const result = await generateText({
      model: createLanguageModel(provider, apiKey, model),
      system: systemPrompt,
      messages: toProviderMessages(messages, provider),
      tools: hasTools ? tools : undefined,
      stopWhen: hasTools ? stepCountIs(AI_MAX_TOOL_STEPS) : undefined,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeout: timeoutMs,
    })

    const text = result.text.trim()
    const toolCalls = result.toolCalls.map((tc) => ({
      toolName: tc.toolName,
      input: 'input' in tc ? tc.input : {},
    }))
    const handoffFromTool = toolCalls.some((tc) => tc.toolName === 'handoff_to_human')

    if (!text && !handoffFromTool && toolCalls.length === 0) {
      throw new AiError('The AI provider returned an empty response.', {
        code: 'empty_response',
        status: 502,
      })
    }

    return {
      text,
      usage: normalizeUsage({
        prompt: result.usage.inputTokens,
        completion: result.usage.outputTokens,
        total: result.usage.totalTokens,
      }),
      toolCalls,
      handoffFromTool,
    }
  } catch (err) {
    throw toAiError(err)
  }
}
