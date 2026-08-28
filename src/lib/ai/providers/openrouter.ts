import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/** Optional OpenRouter attribution headers (see openrouter.ai/docs). */
function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  const title = process.env.OPENROUTER_APP_NAME?.trim() || 'wacrm'
  if (referer) headers['HTTP-Referer'] = referer
  if (title) headers['X-Title'] = title
  return headers
}

/** OpenRouter exposes many models through an OpenAI-compatible API. */
export function createOpenRouterModel(apiKey: string, model: string): LanguageModel {
  const openrouter = createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: openRouterHeaders(),
  })
  // OpenRouter is chat-completions-first; the default OpenAI provider
  // callable hits /responses, which many OpenRouter models handle poorly.
  return openrouter.chat(model)
}
