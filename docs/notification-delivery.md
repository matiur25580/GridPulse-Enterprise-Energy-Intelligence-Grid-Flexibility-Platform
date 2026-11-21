# GridPulse incident notification delivery

GridPulse persists incident email notifications in a MongoDB outbox and delivers them through the Resend email API.

## Configure the provider

Set these server environment variables:

- `RESEND_API_KEY`: private Resend API key.
- `ALERT_EMAIL_FROM`: verified sender identity, for example `GridPulse <alerts@example.com>`.
- `ALERT_NOTIFICATION_INTERVAL_SECONDS`: worker polling cadence (default 15 seconds; 0 disables delivery).

The worker is disabled operationally until both provider credentials are configured. Missing configuration moves attempted messages to the dead-letter state with a sanitized error; configure the provider before enabling organization subscriptions.

## Organization recipients

Only organization owners and admins can manage recipients:

- `GET /api/v1/organizations/:organizationId/alerts/notifications`
- `PUT /api/v1/organizations/:organizationId/alerts/notifications`

Example request:

```json
{
  "enabled": true,
  "emails": ["energy-ops@example.com", "facility-lead@example.com"]
}
```

Up to 25 unique email addresses can be configured per organization. Disabling the subscription stops new notification enqueueing; already queued messages remain in the outbox and should be drained or administratively reviewed.

## Delivery guarantees and operations

- New incidents and recovery transitions enqueue one notification per incident event.
- A unique idempotency key prevents duplicate enqueueing for the same incident event.
- The worker atomically claims messages, recovers expired processing locks, and processes bounded batches.
- Transient failures use exponential backoff; permanent provider responses and exhausted retries move to the dead-letter state.
- Resend idempotency keys reduce duplicate sends if a worker crashes after provider acceptance but before recording success.
- Outbox records are retained for 90 days.
- Delivery is at-least-once at the application boundary; provider idempotency is relied on to make retries safe.

This is an email notification adapter, not a general workflow engine. SMS, Slack, Teams, push delivery, escalation schedules, quiet hours, and user-level preferences remain future work.
