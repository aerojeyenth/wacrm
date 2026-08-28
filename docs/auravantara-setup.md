# Auravantara Retreats — WAB setup

Phase 1 sales automation: welcome flow + AI agent + 20-hour closing sequence.

## 1. Database migrations

```bash
supabase db push
```

Applies `041_automation_pending_cancelled.sql` and `042_automation_cancel_on_reply.sql`.

If `supabase db push` fails with `failed to parse environment file: .env.local`, quote any values containing `#` or special characters, or temporarily rename `.env.local` while pushing.

## 2. Seed script

```bash
AURAVANTARA_ACCOUNT_ID=<your-account-uuid> \
AURAVANTARA_USER_ID=<your-user-uuid> \
npm run seed:auravantara
```

This seeds:

- Lead tags (`lead-qualified`, `lead-hot`, `booking-confirmed`, etc.)
- Custom fields (`check_in`, `check_out`, `adults`, …)
- AI `system_prompt` + 9 knowledge-base documents (updates existing row)
- Draft **Auravantara welcome** flow (clone from template)
- Draft **Auravantara 20-hour closing** automation (`cancel_on_reply: false`)

Configure your AI API key in **Settings → Agent setup** (encrypted at rest).

The auto-reply prompt includes today's date in `Asia/Kolkata` so the agent can resolve "tomorrow" / "next Monday". Override with `AI_TIMEZONE` if needed. Re-run the seed after pulling prompt changes.

## 3. Activate

1. **Flows** → Auravantara welcome → replace placeholder media URLs with your villa photos → **Activate**
2. **Automations** → Auravantara 20-hour closing → **Activate**
3. Set `AUTOMATION_CRON_SECRET` and schedule `GET /api/automations/cron` every few minutes

The welcome flow runs **once per contact**, then the AI agent takes over. A test number that already chatted still gets the welcome on its next inbound (it is not limited to the contact's very first message ever).

## 4. AI agent tools (auto-reply)

The AI can call:

- `add_contact_tag` — lead status tags
- `update_contact_field` — name, dates, quotation fields
- `create_deal` — pipeline deal on hot leads
- `lookup_pricing` / `save_lead_to_sheet` — only offered once Google Sheets env is set; until then the agent quotes from the knowledge-base rates in the same message

## 5. Phase 2 — Google Sheets

Set when your sheet is ready:

- `GOOGLE_SHEETS_PRICING_ID`
- `GOOGLE_SHEETS_LEADS_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

Implement API reads/writes in `src/lib/ai/integrations/google-sheets.ts`.
