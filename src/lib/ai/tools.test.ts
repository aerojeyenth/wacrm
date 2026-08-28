import { describe, it, expect } from 'vitest'
import { buildAgentTools } from './tools'

describe('buildAgentTools', () => {
  it('returns no tools in draft mode', () => {
    expect(buildAgentTools('draft')).toEqual({})
  })

  it('exposes handoff_to_human in auto-reply mode', () => {
    const tools = buildAgentTools('auto_reply')
    expect(Object.keys(tools)).toEqual(['handoff_to_human'])
  })
})
