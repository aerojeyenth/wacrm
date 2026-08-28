import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

export type AgentToolsMode = 'draft' | 'auto_reply'

/**
 * Tools exposed to the LLM. Auto-reply gets `handoff_to_human`; draft mode
 * stays text-only so agents reviewing suggestions aren't surprised by side
 * effects. Add integration tools (Google Sheets, CRM lookups, etc.) here.
 */
export function buildAgentTools(mode: AgentToolsMode): ToolSet {
  if (mode !== 'auto_reply') return {}

  return {
    handoff_to_human: tool({
      description:
        'Transfer this WhatsApp conversation to a human agent when you cannot confidently and safely help — the customer asks for a person, is upset, or you lack required information.',
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
}
