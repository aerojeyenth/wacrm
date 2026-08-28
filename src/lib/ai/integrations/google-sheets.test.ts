import { describe, it, expect } from 'vitest'
import { lookupPricingFromSheet, saveLeadToSheet } from './google-sheets'

describe('google-sheets integration (Phase 2 stub)', () => {
  it('reports not configured without env vars', async () => {
    const pricing = await lookupPricingFromSheet({
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      villa: 'Alpine',
      nights: 2,
      additionalAdults: 0,
    })
    expect(pricing.configured).toBe(false)

    const lead = await saveLeadToSheet({ contactId: 'c1', guestName: 'Ada' })
    expect(lead.configured).toBe(false)
  })
})
