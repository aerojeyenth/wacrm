import type { AiProvider } from './types'

export const AI_PROVIDERS = ['openai', 'anthropic', 'openrouter'] as const satisfies readonly AiProvider[]

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && (AI_PROVIDERS as readonly string[]).includes(value)
}

export function aiProviderErrorMessage(): string {
  return `provider must be one of: ${AI_PROVIDERS.map((p) => `"${p}"`).join(', ')}`
}
