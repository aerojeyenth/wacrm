import { supabaseAdmin } from './admin-client'
import { addContactTagIfAbsent } from '@/lib/contacts/tag-write'
import type { AgentToolsContext } from './tool-context'
import {
  lookupPricingFromSheet,
  saveLeadToSheet,
  type PricingLookupInput,
  type LeadSaveInput,
} from './integrations/google-sheets'

const DEFAULT_TAG_COLOR = '#3b82f6'

export async function resolveTagIdByName(
  accountId: string,
  userId: string,
  tagName: string,
): Promise<string | null> {
  const db = supabaseAdmin()
  const key = tagName.trim().toLowerCase()
  if (!key) return null

  const { data: existing } = await db
    .from('tags')
    .select('id, name')
    .eq('account_id', accountId)

  for (const tag of existing ?? []) {
    if (tag.name.trim().toLowerCase() === key) return tag.id as string
  }

  const { data: created, error } = await db
    .from('tags')
    .insert({
      account_id: accountId,
      user_id: userId,
      name: tagName.trim(),
      color: DEFAULT_TAG_COLOR,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[ai tools] create tag failed:', error)
    return null
  }
  return created.id as string
}

export async function aiAddContactTag(
  ctx: AgentToolsContext,
  tagName: string,
): Promise<{ ok: boolean; tagId: string | null; created: boolean }> {
  const tagId = await resolveTagIdByName(
    ctx.accountId,
    ctx.configOwnerUserId,
    tagName,
  )
  if (!tagId) return { ok: false, tagId: null, created: false }

  const created = await addContactTagIfAbsent(supabaseAdmin(), {
    accountId: ctx.accountId,
    contactId: ctx.contactId,
    tagId,
  })
  return { ok: true, tagId, created }
}

export async function aiUpdateContactField(
  ctx: AgentToolsContext,
  field: string,
  value: string,
): Promise<{ ok: boolean; detail: string }> {
  const db = supabaseAdmin()
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, detail: 'value is empty' }

  const builtin = new Set(['name', 'email', 'company'])
  if (builtin.has(field)) {
    const { error } = await db
      .from('contacts')
      .update({ [field]: trimmed, updated_at: new Date().toISOString() })
      .eq('id', ctx.contactId)
      .eq('account_id', ctx.accountId)
    if (error) return { ok: false, detail: error.message }
    return { ok: true, detail: `${field} updated` }
  }

  const { data: customField } = await db
    .from('custom_fields')
    .select('id')
    .eq('account_id', ctx.accountId)
    .ilike('field_name', field)
    .maybeSingle()

  if (!customField) {
    return { ok: false, detail: `unknown field "${field}"` }
  }

  const { error } = await db.from('contact_custom_values').upsert(
    {
      contact_id: ctx.contactId,
      custom_field_id: customField.id,
      value: trimmed,
    },
    { onConflict: 'contact_id,custom_field_id' },
  )
  if (error) return { ok: false, detail: error.message }
  return { ok: true, detail: `custom field ${field} updated` }
}

export async function aiCreateDeal(
  ctx: AgentToolsContext,
  title: string,
  value?: number,
): Promise<{ ok: boolean; dealId: string | null; detail: string }> {
  const db = supabaseAdmin()
  const pipelineId = process.env.AURAVANTARA_PIPELINE_ID
  const stageId = process.env.AURAVANTARA_PIPELINE_STAGE_ID

  let resolvedPipelineId = pipelineId ?? null
  let resolvedStageId = stageId ?? null

  if (!resolvedPipelineId || !resolvedStageId) {
    const { data: pipeline } = await db
      .from('pipelines')
      .select('id')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (pipeline) {
      resolvedPipelineId = pipeline.id as string
      const { data: stage } = await db
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', resolvedPipelineId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      resolvedStageId = (stage?.id as string) ?? null
    }
  }

  if (!resolvedPipelineId || !resolvedStageId) {
    return {
      ok: false,
      dealId: null,
      detail: 'no pipeline/stage configured for this account',
    }
  }

  const { data: acct } = await db
    .from('accounts')
    .select('default_currency')
    .eq('id', ctx.accountId)
    .maybeSingle()

  const { data: deal, error } = await db
    .from('deals')
    .insert({
      account_id: ctx.accountId,
      user_id: ctx.configOwnerUserId,
      pipeline_id: resolvedPipelineId,
      stage_id: resolvedStageId,
      contact_id: ctx.contactId,
      title: title.trim() || 'Auravantara enquiry',
      value: value ?? 0,
      currency: acct?.default_currency ?? 'INR',
      status: 'open',
    })
    .select('id')
    .single()

  if (error || !deal) {
    return { ok: false, dealId: null, detail: error?.message ?? 'insert failed' }
  }
  return { ok: true, dealId: deal.id as string, detail: 'deal created' }
}

export async function aiLookupPricing(
  input: PricingLookupInput,
): Promise<Awaited<ReturnType<typeof lookupPricingFromSheet>>> {
  return lookupPricingFromSheet(input)
}

export async function aiSaveLead(
  ctx: AgentToolsContext,
  input: Omit<LeadSaveInput, 'contactId'>,
): Promise<Awaited<ReturnType<typeof saveLeadToSheet>>> {
  return saveLeadToSheet({ ...input, contactId: ctx.contactId })
}
