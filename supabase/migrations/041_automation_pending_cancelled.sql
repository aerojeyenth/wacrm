-- Allow cancelling scheduled automation waits when a contact replies.
-- Used by follow-up / nudge chains (e.g. wait 2h → send message) so a
-- customer who engages does not keep receiving reminders.

ALTER TABLE automation_pending_executions
  DROP CONSTRAINT IF EXISTS automation_pending_executions_status_check;

ALTER TABLE automation_pending_executions
  ADD CONSTRAINT automation_pending_executions_status_check
  CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_automation_pending_contact_pending
  ON automation_pending_executions(account_id, contact_id)
  WHERE status = 'pending';
