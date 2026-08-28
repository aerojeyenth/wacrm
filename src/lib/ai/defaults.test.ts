import { afterEach, describe, expect, it } from 'vitest'
import {
  aiTimeZone,
  buildSystemPrompt,
  DEFAULT_AI_TIMEZONE,
  formatAiClock,
} from './defaults'

describe('aiTimeZone', () => {
  const original = process.env.AI_TIMEZONE

  afterEach(() => {
    if (original === undefined) delete process.env.AI_TIMEZONE
    else process.env.AI_TIMEZONE = original
  })

  it('defaults to Asia/Kolkata', () => {
    delete process.env.AI_TIMEZONE
    expect(aiTimeZone()).toBe(DEFAULT_AI_TIMEZONE)
  })

  it('reads AI_TIMEZONE when set', () => {
    process.env.AI_TIMEZONE = 'Europe/London'
    expect(aiTimeZone()).toBe('Europe/London')
  })
})

describe('formatAiClock', () => {
  // 28 Aug 2026 10:00 UTC = Friday afternoon IST; 18:30 UTC = Saturday 00:00 IST.
  const fridayUtc = new Date('2026-08-28T10:00:00.000Z')
  const saturdayIst = new Date('2026-08-28T18:30:00.000Z')

  it('formats weekday, calendar date, ISO date, and timezone', () => {
    const clock = formatAiClock(fridayUtc, 'Asia/Kolkata')
    expect(clock).toContain('Friday, 28 August 2026')
    expect(clock).toContain('(2026-08-28)')
    expect(clock).toContain('Asia/Kolkata')
    expect(clock).toContain('next Monday')
  })

  it('uses the given timezone, not UTC, near midnight', () => {
    expect(formatAiClock(saturdayIst, 'Asia/Kolkata')).toContain(
      'Saturday, 29 August 2026',
    )
    expect(formatAiClock(saturdayIst, 'UTC')).toContain('Friday, 28 August 2026')
  })

  it('falls back to UTC on an invalid timezone', () => {
    const clock = formatAiClock(fridayUtc, 'Not/AZone')
    expect(clock).toContain('Friday, 28 August 2026')
    expect(clock).toContain('UTC')
  })
})

describe('buildSystemPrompt — clock', () => {
  it('injects the pinned calendar so relative dates can be resolved', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      now: new Date('2026-08-28T10:00:00.000Z'),
      timeZone: 'Asia/Kolkata',
    })
    expect(prompt).toContain('Today is Friday, 28 August 2026 (2026-08-28)')
    expect(prompt).toContain('Asia/Kolkata')
  })

  it('forbids filler wait messages in auto-reply', () => {
    const prompt = buildSystemPrompt({
      userPrompt: null,
      mode: 'auto_reply',
      now: new Date('2026-08-28T10:00:00.000Z'),
      timeZone: 'UTC',
    })
    expect(prompt).toContain('single message')
    expect(prompt).toContain('hold on')
  })
})
