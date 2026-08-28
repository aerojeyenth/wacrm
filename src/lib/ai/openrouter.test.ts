import { describe, it, expect } from 'vitest'
import { OPENROUTER_BASE_URL, createOpenRouterModel } from './providers/openrouter'
import { isAiProvider } from './provider-guard'

describe('createOpenRouterModel', () => {
  it('returns a language model for OpenRouter slugs', () => {
    expect(createOpenRouterModel('sk-or-test', 'openai/gpt-4o-mini')).toBeDefined()
    expect(OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })
})

describe('isAiProvider', () => {
  it('accepts openrouter', () => {
    expect(isAiProvider('openrouter')).toBe(true)
    expect(isAiProvider('openai')).toBe(true)
    expect(isAiProvider('other')).toBe(false)
  })
})
