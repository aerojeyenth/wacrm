import { describe, it, expect } from 'vitest'
import { APICallError } from 'ai'
import { toAiError } from './map-error'
import { AiError } from './types'

describe('toAiError', () => {
  it('passes through AiError unchanged', () => {
    const err = new AiError('nope', { code: 'invalid_key', status: 401 })
    expect(toAiError(err)).toBe(err)
  })

  it('maps APICallError 401 to invalid_key', () => {
    const err = new APICallError({
      message: 'Incorrect API key',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 401,
      responseHeaders: {},
      responseBody: '{}',
      isRetryable: false,
    })
    expect(toAiError(err)).toMatchObject({ code: 'invalid_key', status: 401 })
  })

  it('maps APICallError 429 to rate_limited', () => {
    const err = new APICallError({
      message: 'Rate limit',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: {},
      responseBody: '{}',
      isRetryable: true,
    })
    expect(toAiError(err)).toMatchObject({ code: 'rate_limited', status: 502 })
  })

  it('maps timeout errors', () => {
    const err = new DOMException('Timed out', 'TimeoutError')
    expect(toAiError(err)).toMatchObject({ code: 'timeout', status: 504 })
  })
})
