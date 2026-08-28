import type { TemplateStepSeed } from '@/lib/automations/templates'

export interface AuravantaraTagIds {
  bookingConfirmed: string
  lost: string
  followUpCompleted: string
}

function nudgeBlock(
  baseIndex: number,
  wait: { amount: number; unit: 'hours' },
  message: string,
  tags: AuravantaraTagIds,
): TemplateStepSeed[] {
  const waitIdx = baseIndex
  const bookedIdx = baseIndex + 1
  const lostIdx = baseIndex + 2
  const sendIdx = baseIndex + 3
  return [
    { step_type: 'wait', step_config: wait },
    {
      step_type: 'condition',
      step_config: { subject: 'tag_presence', operand: tags.bookingConfirmed },
    },
    {
      step_type: 'condition',
      step_config: { subject: 'tag_presence', operand: tags.lost },
      parent_index: bookedIdx,
      branch: 'no',
    },
    {
      step_type: 'send_message',
      step_config: { text: message },
      parent_index: lostIdx,
      branch: 'no',
    },
  ]
}

/**
 * 20-hour sales closing sequence (T+2 / +6 / +12 / +18).
 * Skips each message when booking-confirmed or lost tags are present.
 */
export function buildAuravantara20hSteps(
  tags: AuravantaraTagIds,
): TemplateStepSeed[] {
  const blocks = [
    nudgeBlock(
      0,
      { amount: 2, unit: 'hours' },
      "👋 Hi! Just checking in regarding your Auravantara Retreats quotation. 🌿\n\nWould you like us to help you finalize your stay?",
      tags,
    ),
    nudgeBlock(
      4,
      { amount: 4, unit: 'hours' },
      "🌿 Hi! We'd be happy to host you at Auravantara Retreats.\n\nIf your dates are confirmed, we can help you complete the booking with the 50% advance.",
      tags,
    ),
    nudgeBlock(
      8,
      { amount: 6, unit: 'hours' },
      "👋 Your Auravantara Retreats enquiry is still open.\n\nIf you'd like to proceed, I can help you complete the booking now.\n💳 Only 50% advance is required to confirm the booking.",
      tags,
    ),
    nudgeBlock(
      12,
      { amount: 6, unit: 'hours' },
      "🌿 This is a final follow-up regarding your Auravantara Retreats enquiry.\n\nIf you're still planning your Ooty stay, we're happy to help you complete the booking. Would you like to confirm your stay now?",
      tags,
    ),
  ]

  const finisherStart = 16
  return [
    ...blocks.flat(),
    { step_type: 'wait', step_config: { amount: 2, unit: 'hours' } },
    {
      step_type: 'condition',
      step_config: { subject: 'tag_presence', operand: tags.bookingConfirmed },
    },
    {
      step_type: 'add_tag',
      step_config: { tag_id: tags.followUpCompleted },
      parent_index: finisherStart + 1,
      branch: 'no',
    },
  ]
}
