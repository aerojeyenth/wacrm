/**
 * Seed Auravantara Retreats AI config, knowledge base, tags, custom fields,
 * welcome flow, and 20-hour closing automation for an account.
 *
 * Usage:
 *   AURAVANTARA_ACCOUNT_ID=<uuid> AURAVANTARA_USER_ID=<uuid> npm run seed:auravantara
 *
 * Loads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * when present (same as the Next.js app).
 *
 * Optional: AURAVANTARA_AI_API_KEY, AURAVANTARA_AI_PROVIDER, AURAVANTARA_AI_MODEL
 * Optional: OPENAI_API_KEY for embeddings (semantic KB search)
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  AURAVANTARA_CUSTOM_FIELDS,
  AURAVANTARA_KNOWLEDGE_DOCS,
  AURAVANTARA_LEAD_TAGS,
  AURAVANTARA_SYSTEM_PROMPT,
  buildAuravantara20hSteps,
} from '../src/lib/auravantara'
import { getFlowTemplate } from '../src/lib/flows/templates'
import { insertSteps } from '../src/lib/automations/steps-tree'

const TAG_COLOR = '#16a34a'

/** Load `.env.local` without dotenv — only sets keys not already exported. */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'))

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const accountId = requireEnv('AURAVANTARA_ACCOUNT_ID')
  const userId = requireEnv('AURAVANTARA_USER_ID')

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Seeding tags…')
  const tagIdByName = new Map<string, string>()
  for (const name of AURAVANTARA_LEAD_TAGS) {
    const { data: existing } = await db
      .from('tags')
      .select('id, name')
      .eq('account_id', accountId)
      .ilike('name', name)
      .maybeSingle()
    if (existing) {
      tagIdByName.set(name, existing.id)
      continue
    }
    const { data: created, error } = await db
      .from('tags')
      .insert({ account_id: accountId, user_id: userId, name, color: TAG_COLOR })
      .select('id')
      .single()
    if (error || !created) throw new Error(`tag ${name}: ${error?.message}`)
    tagIdByName.set(name, created.id)
  }

  console.log('Seeding custom fields…')
  for (const fieldName of AURAVANTARA_CUSTOM_FIELDS) {
    const { data: existing } = await db
      .from('custom_fields')
      .select('id')
      .eq('account_id', accountId)
      .eq('field_name', fieldName)
      .maybeSingle()
    if (existing) continue
    const { error } = await db.from('custom_fields').insert({
      account_id: accountId,
      user_id: userId,
      field_name: fieldName,
      field_type: 'text',
    })
    if (error) throw new Error(`custom field ${fieldName}: ${error.message}`)
  }

  console.log('Upserting AI config…')
  const aiRow = {
    account_id: accountId,
    created_by: userId,
    provider: process.env.AURAVANTARA_AI_PROVIDER?.trim() || 'openai',
    model: process.env.AURAVANTARA_AI_MODEL?.trim() || 'gpt-4o-mini',
    system_prompt: AURAVANTARA_SYSTEM_PROMPT,
    is_active: true,
    auto_reply_enabled: true,
    auto_reply_max_per_conversation: 20,
    handoff_agent_id: null,
  }

  const { data: existingAi } = await db
    .from('ai_configs')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle()

  if (existingAi) {
    const update: Record<string, unknown> = {
      system_prompt: AURAVANTARA_SYSTEM_PROMPT,
      is_active: true,
      auto_reply_enabled: true,
      auto_reply_max_per_conversation: 20,
      updated_at: new Date().toISOString(),
    }
  if (process.env.AURAVANTARA_AI_API_KEY) {
      // Encrypt via app if needed — seed stores plaintext only when key provided
      // and existing row will be updated through API in production.
      console.warn(
        'AURAVANTARA_AI_API_KEY set — update API key via Settings UI (encrypted at rest).',
      )
    }
    const { error } = await db
      .from('ai_configs')
      .update(update)
      .eq('account_id', accountId)
    if (error) throw new Error(`ai_configs update: ${error.message}`)
  } else if (process.env.AURAVANTARA_AI_API_KEY) {
    console.warn(
      'No ai_configs row — create one in Settings with your API key first, then re-run to update prompt/KB.',
    )
  } else {
    console.warn(
      'No ai_configs row and no AURAVANTARA_AI_API_KEY — configure AI in Settings, then re-run.',
    )
  }

  console.log('Seeding knowledge documents…')
  for (const doc of AURAVANTARA_KNOWLEDGE_DOCS) {
    const { data: existing } = await db
      .from('ai_knowledge_documents')
      .select('id')
      .eq('account_id', accountId)
      .eq('title', doc.title)
      .maybeSingle()
    if (existing) {
      await db
        .from('ai_knowledge_documents')
        .update({ content: doc.content, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      continue
    }
    const { error } = await db.from('ai_knowledge_documents').insert({
      account_id: accountId,
      created_by: userId,
      title: doc.title,
      content: doc.content,
    })
    if (error) throw new Error(`knowledge ${doc.title}: ${error.message}`)
  }

  console.log('Creating welcome flow (draft)…')
  const flowTemplate = getFlowTemplate('auravantara_welcome')
  if (!flowTemplate) throw new Error('auravantara_welcome template missing')

  const { data: existingFlow } = await db
    .from('flows')
    .select('id')
    .eq('account_id', accountId)
    .eq('name', flowTemplate.name)
    .maybeSingle()

  if (!existingFlow) {
    const { data: flow, error: flowErr } = await db
      .from('flows')
      .insert({
        user_id: userId,
        account_id: accountId,
        name: flowTemplate.name,
        description: flowTemplate.description,
        status: 'draft',
        trigger_type: flowTemplate.trigger_type,
        trigger_config: flowTemplate.trigger_config,
        entry_node_id: flowTemplate.entry_node_id,
      })
      .select('id')
      .single()
    if (flowErr || !flow) throw new Error(flowErr?.message ?? 'flow insert failed')
    const { error: nodesErr } = await db.from('flow_nodes').insert(
      flowTemplate.nodes.map((n) => ({
        flow_id: flow.id,
        node_key: n.node_key,
        node_type: n.node_type,
        config: n.config,
      })),
    )
    if (nodesErr) throw new Error(nodesErr.message)
    console.log(`  Flow created (draft): ${flow.id} — upload villa media URLs, then activate.`)
  } else {
    console.log(`  Flow already exists: ${existingFlow.id}`)
  }

  console.log('Creating 20-hour closing automation (draft)…')
  const bookingConfirmed = tagIdByName.get('booking-confirmed')
  const lost = tagIdByName.get('lost')
  const followUpCompleted = tagIdByName.get('follow-up-completed')
  if (!bookingConfirmed || !lost || !followUpCompleted) {
    throw new Error('required tags missing after seed')
  }

  const steps = buildAuravantara20hSteps({
    bookingConfirmed,
    lost,
    followUpCompleted,
  })

  const autoName = 'Auravantara 20-hour closing'
  const { data: existingAuto } = await db
    .from('automations')
    .select('id')
    .eq('account_id', accountId)
    .eq('name', autoName)
    .maybeSingle()

  if (!existingAuto) {
    const { data: automation, error: autoErr } = await db
      .from('automations')
      .insert({
        user_id: userId,
        account_id: accountId,
        name: autoName,
        description:
          'T+2/6/12/18 follow-ups; skips when booked or lost; survives AI chat (cancel_on_reply=false).',
        trigger_type: 'first_inbound_message',
        trigger_config: {},
        is_active: false,
        cancel_on_reply: false,
      })
      .select('id')
      .single()
    if (autoErr || !automation) throw new Error(autoErr?.message ?? 'automation insert failed')
    const stepErr = await insertSteps(
      automation.id,
      steps as unknown as import('../src/lib/automations/steps-tree').BuilderStepInput[],
    )
    if (stepErr) throw new Error(stepErr)
    console.log(`  Automation created (draft): ${automation.id} — review and activate.`)
  } else {
    console.log(`  Automation already exists: ${existingAuto.id}`)
  }

  console.log('Done.')
  console.log('Next steps:')
  console.log('  1. Settings → Agent setup — add API key if not set')
  console.log('  2. Flows → Auravantara welcome — replace media URLs, activate')
  console.log('  3. Automations → 20-hour closing — activate')
  console.log(
    '  4. Set AUTOMATION_CRON_SECRET in the app env and schedule GET /api/automations/cron and GET /api/flows/cron every 2–5 minutes (header x-cron-secret)',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
