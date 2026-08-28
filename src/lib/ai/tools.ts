import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type { AgentToolsContext } from './tool-context'
import {
  aiAddContactTag,
  aiCreateDeal,
  aiLookupPricing,
  aiSaveLead,
  aiUpdateContactField,
} from './tool-actions'
import { isGoogleSheetsConfigured } from './integrations/google-sheets'

export type AgentToolsMode = 'draft' | 'auto_reply'

/**
 * Tools exposed to the LLM. Auto-reply gets CRM + handoff tools when
 * `toolContext` is provided (live WhatsApp thread). Draft mode and
 * playground runs without contact context stay text-only aside from handoff
 * in auto_reply mode without context.
 */
export function buildAgentTools(
  mode: AgentToolsMode,
  toolContext?: AgentToolsContext | null,
): ToolSet {
  if (mode !== 'auto_reply') return {}

  const tools: ToolSet = {
    handoff_to_human: tool({
      description:
        'Transfer this WhatsApp conversation to a human agent when you cannot confidently help — the customer asks for a person, is upset, payment/QR is needed, special discount beyond 10%, or you lack required information. Do NOT use for greetings or simple chitchat.',
      inputSchema: z.object({
        reason: z
          .string()
          .optional()
          .describe('Brief internal note on why a human should take over'),
      }),
      execute: async ({ reason }) => ({
        handedOff: true as const,
        reason: reason ?? null,
      }),
    }),
  }

  if (!toolContext) return tools

  const ctx = toolContext

  tools.add_contact_tag = tool({
    description:
      'Add a CRM tag to this contact for lead tracking. Use tags like lead-qualified, lead-quoted, lead-hot, lead-payment-pending, booking-confirmed, or lost.',
    inputSchema: z.object({
      tag_name: z
        .string()
        .min(1)
        .describe('Tag name (created automatically if it does not exist)'),
    }),
    execute: async ({ tag_name }) => aiAddContactTag(ctx, tag_name),
  })

  tools.update_contact_field = tool({
    description:
      'Save collected guest details on the contact. Built-in fields: name, email, company. Custom fields by name: check_in, check_out, adults, kids, kids_ages, recommended_villa, quotation_total, lead_source.',
    inputSchema: z.object({
      field: z.string().min(1).describe('Field name'),
      value: z.string().min(1).describe('Value to store'),
    }),
    execute: async ({ field, value }) => aiUpdateContactField(ctx, field, value),
  })

  tools.create_deal = tool({
    description:
      'Create an open deal in the sales pipeline when the lead is qualified or hot.',
    inputSchema: z.object({
      title: z.string().min(1).describe('Deal title, e.g. "Auravantara — Imperial Villa"'),
      value: z
        .number()
        .nonnegative()
        .optional()
        .describe('Estimated deal value in account currency'),
    }),
    execute: async ({ title, value }) => aiCreateDeal(ctx, title, value),
  })

  // Phase 2 sheet tools stay hidden until credentials exist. Exposing the
  // stubs made the model say "please hold on" while calling lookup_pricing,
  // then never send the quotation (WhatsApp delivers one reply per inbound).
  if (isGoogleSheetsConfigured()) {
    tools.lookup_pricing = tool({
      description:
        'Look up date-wise villa pricing from Google Sheets. Call this instead of using static knowledge-base rates when sheets are connected.',
      inputSchema: z.object({
        check_in: z.string().describe('Check-in date YYYY-MM-DD'),
        check_out: z.string().describe('Check-out date YYYY-MM-DD'),
        villa: z
          .string()
          .describe('Villa name, e.g. Alpine, Signature, Imperial, or combo'),
        nights: z.number().int().positive(),
        additional_adults: z.number().int().nonnegative().default(0),
      }),
      execute: async (input) =>
        aiLookupPricing({
          checkIn: input.check_in,
          checkOut: input.check_out,
          villa: input.villa,
          nights: input.nights,
          additionalAdults: input.additional_adults,
        }),
    })

    tools.save_lead_to_sheet = tool({
      description:
        'Save or update lead details in the Google Sheets lead database. Call after collecting key enquiry fields.',
      inputSchema: z.object({
        guest_name: z.string().optional(),
        lead_source: z.string().optional(),
        check_in: z.string().optional(),
        check_out: z.string().optional(),
        adults: z.number().int().nonnegative().optional(),
        kids: z.number().int().nonnegative().optional(),
        recommended_villa: z.string().optional(),
        final_quotation: z.number().nonnegative().optional(),
        lead_status: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) =>
        aiSaveLead(ctx, {
          guestName: input.guest_name,
          leadSource: input.lead_source,
          checkIn: input.check_in,
          checkOut: input.check_out,
          adults: input.adults,
          kids: input.kids,
          recommendedVilla: input.recommended_villa,
          finalQuotation: input.final_quotation,
          leadStatus: input.lead_status,
          notes: input.notes,
        }),
    })
  }

  return tools
}
