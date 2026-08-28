import { describe, it, expect } from 'vitest'
import { buildAgentTools } from './tools'

const CTX = {
  accountId: 'acct-1',
  contactId: 'contact-1',
  conversationId: 'conv-1',
  configOwnerUserId: 'user-1',
}

describe('buildAgentTools', () => {
  it('returns no tools in draft mode', () => {
    expect(buildAgentTools('draft')).toEqual({})
  })

  it('exposes handoff only in auto-reply without thread context', () => {
    const tools = buildAgentTools('auto_reply')
    expect(Object.keys(tools)).toEqual(['handoff_to_human'])
  })

  it('exposes CRM tools in auto-reply with thread context', () => {
    delete process.env.GOOGLE_SHEETS_PRICING_ID
    delete process.env.GOOGLE_SHEETS_LEADS_ID
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const tools = buildAgentTools('auto_reply', CTX)
    expect(Object.keys(tools)).toEqual([
      'handoff_to_human',
      'add_contact_tag',
      'update_contact_field',
      'create_deal',
    ])
  })

  it('adds sheet tools only when Google Sheets env is set', () => {
    process.env.GOOGLE_SHEETS_PRICING_ID = 'sheet-p'
    process.env.GOOGLE_SHEETS_LEADS_ID = 'sheet-l'
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{}'
    try {
      const tools = buildAgentTools('auto_reply', CTX)
      expect(Object.keys(tools)).toEqual([
        'handoff_to_human',
        'add_contact_tag',
        'update_contact_field',
        'create_deal',
        'lookup_pricing',
        'save_lead_to_sheet',
      ])
    } finally {
      delete process.env.GOOGLE_SHEETS_PRICING_ID
      delete process.env.GOOGLE_SHEETS_LEADS_ID
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    }
  })
})
