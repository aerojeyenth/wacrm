import { describe, it, expect } from 'vitest'
import { buildAuravantara20hSteps } from './automation-steps'

describe('buildAuravantara20hSteps', () => {
  const tags = {
    bookingConfirmed: 'tag-booked',
    lost: 'tag-lost',
    followUpCompleted: 'tag-done',
  }

  it('builds wait/condition/send blocks for each follow-up window', () => {
    const steps = buildAuravantara20hSteps(tags)
    const waits = steps.filter((s) => s.step_type === 'wait')
    const sends = steps.filter((s) => s.step_type === 'send_message')
    expect(waits.length).toBe(5)
    expect(sends.length).toBe(4)
    expect(steps.some((s) => s.step_type === 'add_tag')).toBe(true)
  })
})
