import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateReply, parseGeneration } from './generate'
import { AiError, type AiConfig } from './types'

const generateWithAiSdk = vi.fn()

vi.mock('./providers/ai-sdk', () => ({
  generateWithAiSdk: (...args: unknown[]) => generateWithAiSdk(...args),
}))

function config(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test',
    systemPrompt: null,
    isActive: true,
    autoReplyEnabled: false,
    autoReplyMaxPerConversation: 3,
    handoffAgentId: null,
    embeddingsApiKey: null,
    ...overrides,
  }
}

beforeEach(() => {
  generateWithAiSdk.mockReset()
})

describe('parseGeneration', () => {
  it('returns text with no handoff', () => {
    expect(parseGeneration('Hello there')).toEqual({
      text: 'Hello there',
      handoff: false,
      usage: null,
    })
  })

  it('detects + strips the handoff sentinel', () => {
    expect(parseGeneration('[[HANDOFF]]')).toEqual({
      text: '',
      handoff: true,
      usage: null,
    })
    expect(parseGeneration('Let me get a human [[HANDOFF]]')).toEqual({
      text: 'Let me get a human',
      handoff: true,
      usage: null,
    })
  })

  it('passes usage straight through', () => {
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    expect(parseGeneration('Hi', usage)).toEqual({
      text: 'Hi',
      handoff: false,
      usage,
    })
  })
})

describe('generateReply', () => {
  it('delegates to the AI SDK adapter and returns the reply', async () => {
    generateWithAiSdk.mockResolvedValue({
      text: 'Sure — happy to help!',
      usage: { promptTokens: 42, completionTokens: 8, totalTokens: 50 },
      toolCalls: [],
      handoffFromTool: false,
    })

    const res = await generateReply({
      config: config({ provider: 'openai' }),
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'Hi' }],
    })

    expect(res).toEqual({
      text: 'Sure — happy to help!',
      handoff: false,
      usage: { promptTokens: 42, completionTokens: 8, totalTokens: 50 },
      toolCalls: [],
    })
    expect(generateWithAiSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-test',
        mode: 'draft',
      }),
    )
  })

  it('detects handoff from the sentinel in model text', async () => {
    generateWithAiSdk.mockResolvedValue({
      text: '[[HANDOFF]]',
      usage: null,
      toolCalls: [],
      handoffFromTool: false,
    })

    const res = await generateReply({
      config: config({ provider: 'anthropic' }),
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'I want a person' }],
      mode: 'auto_reply',
    })

    expect(res.handoff).toBe(true)
    expect(res.text).toBe('')
  })

  it('detects handoff when the handoff tool was invoked', async () => {
    generateWithAiSdk.mockResolvedValue({
      text: '',
      usage: null,
      toolCalls: [{ toolName: 'handoff_to_human', input: { reason: 'angry customer' } }],
      handoffFromTool: true,
    })

    const res = await generateReply({
      config: config(),
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'Manager now' }],
      mode: 'auto_reply',
    })

    expect(res.handoff).toBe(true)
    expect(res.toolCalls).toHaveLength(1)
  })

  it('propagates AiError from the adapter', async () => {
    generateWithAiSdk.mockRejectedValue(
      new AiError('The AI provider rejected the API key', {
        code: 'invalid_key',
        status: 401,
      }),
    )

    await expect(
      generateReply({
        config: config(),
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toMatchObject({ code: 'invalid_key', status: 401 })
  })
})
