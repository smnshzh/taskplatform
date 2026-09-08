# ADR 0001: Database-backed notification outbox

Status: accepted for implementation after authentication hardening.

## Context

Task operations must not wait for Telegram or Bale. Delivery must be
provider-independent, retryable, observable, and idempotent.

## Decision

Task services will persist a domain event or outbox row in the same PostgreSQL
transaction as the task change. A separate PM2 worker will claim pending rows,
evaluate user preferences, render a template, and call a provider through
`NotificationProvider`.

The initial persistence design contains:

- `NotificationChannel`: verified provider identity for a member.
- `NotificationPreference`: per-event provider and quiet-hours settings.
- `NotificationOutbox`: payload, recipient, state, attempts, next attempt, and
  globally unique idempotency key.
- `NotificationLog`: immutable delivery outcome.
- `AccountLinkCode`: provider-bound, expiring, one-time code stored as a hash.
- `ProcessedProviderUpdate`: unique provider update ID for webhook
  deduplication.

Retries are finite: immediately, 1 minute, 5 minutes, 15 minutes, and 1 hour.
Permanent recipient/authentication errors fail without further retry.

## Security constraints

- Provider tokens and webhook secrets remain outside source control.
- Linking codes are generated cryptographically and never stored raw.
- Webhooks validate a provider secret before parsing commands.
- Task content is rendered only after recipient authorization is resolved.
- Provider failure never rolls back the task transaction.
- Bot commands do not mutate tasks in phase one.

## Rollback

The worker can be disabled independently. Additive notification tables can
remain unused without affecting task behavior.
