import { APICallError, AISDKError } from 'ai'
import { AiError } from './types'

/** Map AI SDK / provider failures into the app's typed `AiError`. */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err

  if (err instanceof APICallError) {
    const status = err.statusCode ?? 502
    const code =
      status === 401 || status === 403
        ? 'invalid_key'
        : status === 429
          ? 'rate_limited'
          : 'provider_error'
    const base =
      code === 'invalid_key'
        ? 'The AI provider rejected the API key'
        : code === 'rate_limited'
          ? 'The AI provider rate limit was reached'
          : `The AI provider returned an error (${status})`
    const detail = err.message?.trim()
    return new AiError(detail ? `${base}: ${detail}` : base, {
      code,
      status: code === 'invalid_key' ? 401 : 502,
    })
  }

  if (err instanceof AISDKError) {
    const msg = err.message?.trim() || 'The AI request failed.'
    if (err.name === 'TimeoutError' || /timed out/i.test(msg)) {
      return new AiError('The AI provider took too long to respond.', {
        code: 'timeout',
        status: 504,
      })
    }
    return new AiError(msg, { code: 'provider_error', status: 502 })
  }

  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new AiError('The AI provider took too long to respond.', {
      code: 'timeout',
      status: 504,
    })
  }

  const msg = err instanceof Error ? err.message : String(err)
  return new AiError(`Could not reach the AI provider: ${msg}`, {
    code: 'network_error',
    status: 502,
  })
}
