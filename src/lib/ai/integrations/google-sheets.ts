/**
 * Phase 2 — Google Sheets integration for Auravantara pricing + lead DB.
 * Stub until sheet IDs and service-account credentials are provided.
 */

export interface PricingLookupInput {
  checkIn: string
  checkOut: string
  villa: string
  nights: number
  additionalAdults: number
}

export interface PricingLookupResult {
  configured: boolean
  accommodationTotal?: number
  additionalAdultTotal?: number
  message: string
}

export interface LeadSaveInput {
  contactId: string
  guestName?: string | null
  leadSource?: string | null
  checkIn?: string | null
  checkOut?: string | null
  adults?: number | null
  kids?: number | null
  recommendedVilla?: string | null
  finalQuotation?: number | null
  leadStatus?: string | null
  notes?: string | null
}

export interface LeadSaveResult {
  configured: boolean
  message: string
}

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_PRICING_ID &&
      process.env.GOOGLE_SHEETS_LEADS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  )
}

/** Look up date-wise villa pricing from the Google Sheet master. */
export async function lookupPricingFromSheet(
  _input: PricingLookupInput,
): Promise<PricingLookupResult> {
  if (!isGoogleSheetsConfigured()) {
    return {
      configured: false,
      message:
        'Google Sheets pricing is not configured. Quote from the knowledge base only, or hand off to the team.',
    }
  }
  // Phase 2: implement Google Sheets API read using GOOGLE_SERVICE_ACCOUNT_JSON.
  return {
    configured: true,
    message:
      'Google Sheets pricing integration is not yet implemented. Use knowledge-base rates or hand off.',
  }
}

/** Append or update a lead row in the Google Sheet database. */
export async function saveLeadToSheet(
  _input: LeadSaveInput,
): Promise<LeadSaveResult> {
  if (!isGoogleSheetsConfigured()) {
    return {
      configured: false,
      message: 'Google Sheets lead database is not configured.',
    }
  }
  return {
    configured: true,
    message: 'Google Sheets lead sync is not yet implemented.',
  }
}
