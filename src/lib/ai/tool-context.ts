/** Runtime context for AI agent tools that mutate CRM state. */
export interface AgentToolsContext {
  accountId: string
  contactId: string
  conversationId: string
  /** WhatsApp config owner — sender-of-record for outbound messages. */
  configOwnerUserId: string
}
