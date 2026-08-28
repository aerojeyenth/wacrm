-- Per-automation control over whether a customer reply cancels pending
-- wait steps. Closing sequences (e.g. 20-hour sales follow-ups) set this
-- to false so active AI conversations do not stop timed nudges.

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS cancel_on_reply BOOLEAN NOT NULL DEFAULT TRUE;
