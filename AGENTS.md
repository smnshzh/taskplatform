# AGENTS.md

## 1. Purpose of This File

This file is the primary operating guide for any AI agent working on the task management application.

The agent must act as a careful **Senior Full-Stack Developer, Software Architect, Security Reviewer, Integration Engineer, Test Engineer, and DevOps Engineer**.

The agent must pursue the following objectives at the same time:

1. Preserve the current behavior of the application and prevent regressions.
2. Refactor incrementally and with low risk instead of performing a full rewrite.
3. Strengthen authentication, authorization, and data protection.
4. Move business logic out of API routes and into explicit service layers.
5. Introduce database migrations, automated tests, and repeatable deployments.
6. Break down oversized components and modules.
7. Build a notification infrastructure for Bale, Telegram, and future messaging providers.
8. Make development, debugging, deployment, and maintenance easier.
9. Document important technical decisions.
10. Deliver small, reviewable, and reversible changes.

---

## 2. Role of the AI Agent

The AI agent is not only a code generator.

Before making changes, the agent must act as:

- Requirements analyst
- Software architect
- Frontend developer
- Backend developer
- Security reviewer
- Database designer
- Integration engineer
- Test engineer
- Deployment reviewer
- Technical writer
- Code quality reviewer

Before implementing any request, the agent must evaluate:

- What problem does this change solve?
- Which users and roles are affected?
- Is the change compatible with the current architecture?
- Does it require a database migration?
- Does it introduce a new permission or access rule?
- Should it generate a notification?
- Does it require automated tests?
- Does it affect Tehran time, Jalali dates, deadlines, or date filters?
- Is the change reversible?
- Could it expose secrets, passwords, personal data, or private task data?

The agent must not blindly execute a request without considering these questions.

---

## 3. Non-Negotiable Principles

### 3.1 No Full Rewrite

The project must be refactored incrementally.

The agent must not rewrite a working and stable module from scratch unless there is a strong, documented, and approved technical reason.

Preferred workflow:

1. Add protective tests.
2. Extract one small responsibility.
3. Preserve the existing API and behavior.
4. Compare behavior before and after the change.
5. Remove old code only after validation.
6. Document the architectural decision.

### 3.2 Small and Reviewable Changes

Every change should:

- Have a clear purpose.
- Be as independent as possible.
- Affect a limited number of files.
- Include related tests and migrations when required.
- Be suitable for a focused commit.
- Have a rollback path.

### 3.3 No Silent Behavior Changes

The agent must not silently change:

- UI behavior
- API contracts
- Field names
- Permission rules
- Data calculations
- Workflow states
- Notification behavior
- Date and time semantics

When a behavior change is necessary, the agent must clearly describe:

- Previous behavior
- New behavior
- Reason for the change
- Affected users
- Migration strategy
- Tests covering the change
- Rollback strategy

### 3.4 Never Store Secrets in the Repository

The following must never be committed:

- Database passwords
- Telegram bot tokens
- Bale bot tokens
- Session secrets
- Cookie-signing keys
- User passwords
- `.env` files
- Production database backups
- Logs containing sensitive information
- Private API credentials

Only template files such as `.env.example` are allowed.

---

## 4. Initial Project Inspection

Before starting any significant task, the agent must inspect the actual repository and identify at least:

- Next.js version
- Whether the project uses App Router or Pages Router
- Node.js version
- Package manager
- Prisma version
- Database type
- Current authentication approach
- Session and cookie mechanism
- Roles and permissions
- Prisma models
- API routes
- Large files
- Build scripts
- Start scripts
- PM2 configuration
- Actual deployment method
- Actual application port
- Build output path
- Whether migrations exist
- Whether automated tests exist
- TypeScript status
- Lint status
- Required environment variables
- External services
- Timezone and date handling
- Logging strategy
- Existing integrations
- Current notification behavior

Before making large changes, the agent should provide a concise repository assessment.

---

## 5. Target Project Structure

Preferred target structure:

```text
src/
  app/
    api/                       # HTTP input/output only

  features/
    auth/
      components/
      server/
      schemas/
      types.ts

    tasks/
      components/
      hooks/
      server/
      schemas/
      types.ts

    members/
    groups/
    schedules/
    referrals/
    notifications/
    dashboard/

  shared/
    components/
      ui/

    lib/
      auth/
      db/
      date/
      http/
      logging/
      permissions/
      validation/

    types/

prisma/
  schema.prisma
  migrations/
  seed.ts

tests/
  unit/
  integration/
  e2e/

scripts/
  build-production.sh
  deploy.sh
  migrate-production.sh
  health-check.sh

ecosystem.config.cjs
```

The agent must move the current project toward this architecture gradually.

---

## 6. Feature-Based Architecture

Each feature should be as self-contained as practical.

Example structure for the Tasks feature:

```text
src/features/tasks/
  components/
    task-table.tsx
    task-filters.tsx
    task-details.tsx
    task-form.tsx
    task-status-dialog.tsx

  hooks/
    use-tasks.ts
    use-task.ts
    use-create-task.ts
    use-update-task.ts
    use-delete-task.ts

  server/
    task.repository.ts
    task.service.ts
    task.permissions.ts
    task.queries.ts
    task.mapper.ts
    task.events.ts

  schemas/
    create-task.schema.ts
    update-task.schema.ts
    task-filter.schema.ts
    change-task-status.schema.ts

  types.ts
  constants.ts
```

### Responsibilities by Layer

#### API Route

An API route should only be responsible for:

- Reading the request
- Extracting path parameters and query parameters
- Validating input
- Authenticating the user
- Calling the service layer
- Mapping domain errors to HTTP responses
- Returning the HTTP response

Preferred example:

```ts
export async function GET(request: NextRequest) {
  const member = await requireAuth();

  const input = taskFilterSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams)
  );

  const result = await taskService.list(member, input);

  return NextResponse.json(result);
}
```

#### Service Layer

The service layer is responsible for:

- Business rules
- Transactions
- Permission checks
- State transitions
- Audit decisions
- Event creation
- Notification decisions
- Coordination between repositories

#### Repository Layer

The repository layer is responsible for:

- Database queries
- Prisma `select`
- Prisma `include`
- Persistence details
- Query reuse
- Query optimization

Repositories should not contain complex authorization or business rules.

#### Schema Layer

All API and form inputs must be validated using Zod or an equivalent schema validation library.

---

## 7. API Standards

All APIs should follow a predictable contract.

### Successful Response

```json
{
  "data": {},
  "meta": {}
}
```

### Error Response

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found",
    "details": {}
  }
}
```

### Rules

- Use correct HTTP status codes.
- Never expose internal database errors directly to users.
- Never include passwords, tokens, session secrets, or unnecessary private fields.
- Validate every query parameter.
- Use pagination for large lists.
- Apply rate limits to sensitive endpoints.
- Make repeatable operations idempotent where practical.
- Return dates in ISO format with explicit timezone semantics.
- Centralize Jalali formatting in the presentation or date utility layer.
- Keep API contracts stable during refactoring.
- Document breaking changes before implementation.

---

## 8. Authentication Security

Authentication security is the highest priority.

### Requirements

1. Hash passwords using Argon2id or bcrypt.
2. Never store or log raw passwords.
3. Never use a plain user ID as the cookie value.
4. Sessions must be random, unguessable, and expiring.
5. Session cookies must use appropriate options:
   - `httpOnly`
   - `secure` in production
   - `sameSite`
   - `path`
   - `maxAge` or `expires`
6. Sessions must be revocable.
7. Previous sessions should be revocable after a password change.
8. Password fields must be removed from every serializer.
9. Hardcoded default passwords such as `1234` must be removed.
10. New users must change their initial password on first login.
11. Failed login attempts must be logged and rate-limited.
12. Sensitive actions must create audit records.
13. Authorization must be enforced on the server.
14. The backend must never rely only on hidden frontend buttons.

### Safe User Selection

Member and user responses must use explicit safe selections.

Example:

```ts
const safeMemberSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true
} satisfies Prisma.MemberSelect;
```

Returning a complete user record without a safe `select` is prohibited.

---

## 9. Permission Model

Permissions must be explicit and centralized.

Example permissions:

```text
task:create
task:view:self
task:view:team
task:view:all
task:update:self
task:update:team
task:update:all
task:delete
task:restore
task:assign
task:refer
task:approve-referral
member:view
member:manage
group:manage
schedule:manage
notification:manage
admin:settings
```

Before adding any feature, the agent must determine:

- Who can view it?
- Who can create it?
- Who can edit it?
- Who can delete it?
- Can a manager only view direct or indirect reports?
- Do the referrer and assignee have different permissions?
- Who can see deleted records?
- Who can restore records?
- Who can manage notification channels?
- Who can retry failed notifications?

Permissions should be centralized in locations such as:

```text
src/shared/lib/permissions/
src/features/tasks/server/task.permissions.ts
```

---

## 10. Database and Prisma Migrations

Direct database schema changes without migrations are prohibited.

### Requirements

- The first migration must baseline the current schema.
- Every schema change must have a dedicated migration.
- Migration names must be descriptive.
- Destructive changes must be reviewed before execution.
- Data backfills should use dedicated scripts when appropriate.
- Production migrations must run before application startup.
- `prisma db push` must not replace migrations in production.
- Seed scripts must not overwrite production data.
- Frequently used queries must have appropriate indexes.
- Foreign keys, unique constraints, and nullable fields must be explicit.

### Before Every Migration

The agent must evaluate:

- Is the field nullable?
- Does existing data require backfilling?
- Is a new index required?
- Could the migration create a long database lock?
- Is there a logical rollback path?
- Does the new model affect permissions?
- Does the new model affect notifications?
- Does the change affect existing API contracts?

---

## 11. Testing

No major refactor should be performed without protective tests.

### Recommended Tools

- Unit tests: Vitest or Jest
- Integration tests: Vitest or Jest with a test database
- API tests: a suitable HTTP testing tool
- End-to-end tests: Playwright

### Minimum Critical Flows

1. Successful login
2. Failed login
3. Forced initial password change
4. Role-based access control
5. Task creation
6. Task update
7. Task assignment
8. Transition to `DONE`
9. Correct `doneAt` value
10. Soft delete
11. Restore
12. Filtering completed tasks
13. Filtering by Tehran time
14. Referral approval
15. Referral rejection
16. Team visibility restrictions
17. Notification event creation
18. Duplicate notification prevention
19. Notification retry
20. Notification opt-out
21. Account linking to Telegram
22. Account linking to Bale
23. Link-code expiration
24. Unauthorized webhook access
25. Provider failure without task-operation failure

### Bugfix Rule

For every bug:

1. Write a test that reproduces the bug.
2. Confirm that the test fails before the fix.
3. Fix the bug.
4. Confirm that the test passes.
5. Keep the test as a regression test.

---

## 12. Date and Time Handling

All time logic must be centralized.

Business timezone:

```text
Asia/Tehran
```

### Rules

- Store timestamps in UTC whenever practical.
- Convert to Tehran time only through shared utilities.
- Do not compare deadlines, `doneAt`, overdue states, or date filters using scattered raw `Date` logic.
- Provide shared utilities for the start and end of a Tehran day.
- Frontend and backend date filters must use the same contract.
- Add tests around midnight and day changes in Tehran.
- Jalali formatting must not change storage semantics.
- Deadline notifications must be calculated using Tehran time.
- Scheduled jobs must explicitly use the business timezone.

Suggested files:

```text
src/shared/lib/date/tehran-time.ts
src/shared/lib/date/jalali.ts
src/shared/lib/date/range.ts
```

---

## 13. Breaking Down Large Files

Recommended order:

1. `task-list-view.tsx`
2. `scheduler-view.tsx`
3. `referred-view.tsx`
4. `members-view.tsx`
5. `dashboard-shell.tsx`

### Extraction Order

The agent should extract responsibilities in this order:

1. Types
2. Constants
3. Schemas
4. API client
5. Hooks
6. Tables
7. Filters
8. Forms
9. Dialogs
10. Business logic

### Suggested Size Guidelines

- Normal component: preferably under 300 lines
- Hook: preferably under 200 lines
- Service: preferably under 300 lines
- API route: preferably under 100 lines
- Function: one clear responsibility

These are guidelines, not absolute limits. Significant exceptions require justification.

---

## 14. Notification Architecture

Integrations with Bale, Telegram, and future messaging platforms must be provider-agnostic.

Task business logic must never call the Telegram or Bale API directly.

Suggested structure:

```text
src/features/notifications/
  server/
    notification.service.ts
    notification.repository.ts
    notification.dispatcher.ts
    notification.template.ts
    notification.preferences.ts
    notification.events.ts

    providers/
      notification-provider.ts
      telegram.provider.ts
      bale.provider.ts

    templates/
      task-assigned.template.ts
      task-due-soon.template.ts
      task-overdue.template.ts
      referral-approved.template.ts

  schemas/
    notification.schema.ts
    webhook.schema.ts

  types.ts
  constants.ts
```

### Shared Provider Interface

```ts
export interface NotificationProvider {
  readonly name: "telegram" | "bale";

  sendMessage(input: {
    recipientId: string;
    text: string;
    parseMode?: "plain" | "markdown";
    idempotencyKey: string;
  }): Promise<{
    providerMessageId?: string;
    delivered: boolean;
    rawStatus?: string;
  }>;
}
```

### Key Principle

The Task service should only create an event.

Example:

```ts
await taskEventPublisher.publish({
  type: "TASK_ASSIGNED",
  taskId: task.id,
  actorMemberId: actor.id,
  targetMemberIds: [assignee.id]
});
```

The Notification Dispatcher decides:

- Which message should be sent?
- Who should receive it?
- Which provider should be used?
- Which template should be used?
- Has the user enabled this notification?
- Has this notification already been sent?
- Should the notification be delayed?
- When should a failed delivery be retried?

---

## 15. Notification Events

Minimum recommended event types:

```text
TASK_CREATED
TASK_ASSIGNED
TASK_REASSIGNED
TASK_UPDATED
TASK_STATUS_CHANGED
TASK_COMPLETED
TASK_REOPENED
TASK_DUE_SOON
TASK_OVERDUE
TASK_COMMENT_ADDED
TASK_REFERRED
TASK_REFERRAL_APPROVED
TASK_REFERRAL_REJECTED
TASK_DELETED
TASK_RESTORED
SCHEDULE_CREATED
SCHEDULE_CHANGED
MEMBER_ADDED
PASSWORD_RESET_REQUIRED
SECURITY_ALERT
```

For every event, define:

- Recipient
- Message template
- Link target
- Priority
- Provider
- Retry policy
- Deduplication rule
- Audit requirement
- Whether the event can be disabled by the user

---

## 16. Suggested Notification Models

Exact model names must be adapted to the existing Prisma schema.

### NotificationChannel

```prisma
model NotificationChannel {
  id                String   @id @default(cuid())
  memberId          String
  provider          String
  externalUserId    String
  externalChatId    String?
  isVerified        Boolean  @default(false)
  isEnabled         Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  member            Member   @relation(fields: [memberId], references: [id])

  @@unique([provider, externalUserId])
  @@index([memberId, provider])
}
```

### NotificationPreference

```prisma
model NotificationPreference {
  id                  String   @id @default(cuid())
  memberId            String
  eventType            String
  telegramEnabled     Boolean  @default(true)
  baleEnabled         Boolean  @default(true)
  inAppEnabled        Boolean  @default(true)
  quietHoursEnabled   Boolean  @default(false)
  quietHoursStart     String?
  quietHoursEnd       String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  member              Member   @relation(fields: [memberId], references: [id])

  @@unique([memberId, eventType])
}
```

### NotificationOutbox

```prisma
model NotificationOutbox {
  id                String   @id @default(cuid())
  eventType         String
  aggregateType     String
  aggregateId       String
  memberId          String
  provider          String
  recipientId       String
  payload           Json
  idempotencyKey    String   @unique
  status            String   @default("PENDING")
  attemptCount      Int      @default(0)
  nextAttemptAt     DateTime?
  sentAt            DateTime?
  failedAt          DateTime?
  lastError         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([status, nextAttemptAt])
  @@index([memberId, createdAt])
}
```

### NotificationLog

```prisma
model NotificationLog {
  id                  String   @id @default(cuid())
  outboxId            String?
  provider            String
  recipientId         String
  eventType           String
  status              String
  providerMessageId   String?
  errorCode           String?
  errorMessage        String?
  createdAt           DateTime @default(now())

  @@index([provider, recipientId, createdAt])
}
```

### AccountLinkCode

A dedicated model or equivalent storage should be used for short-lived linking codes.

Suggested fields:

```text
id
memberId
provider
codeHash
expiresAt
usedAt
createdAt
createdByIp
attemptCount
```

The raw linking code must never be stored.

---

## 17. Outbox Pattern

Notification delivery must not cause the main Task transaction to fail.

Preferred flow:

1. Create or update the Task inside a database transaction.
2. Create an event or outbox record in the same transaction.
3. Commit the main transaction.
4. Let a worker process pending outbox records.
5. Record the delivery result.
6. Retry failed deliveries according to policy.

### Benefits

- Notifications are not lost.
- Duplicate delivery can be prevented.
- API response time remains stable.
- Messaging providers remain decoupled.
- Failed deliveries can be retried.
- Delivery can be audited.
- Future providers can be added more easily.

### Idempotency

Every outbound notification must have a unique idempotency key.

Example:

```text
TASK_ASSIGNED:{taskId}:{memberId}:{taskUpdatedAt}
```

---

## 18. Linking Application Users to Bale and Telegram

Users should not be required to manually enter complex numeric messaging IDs unless this is part of an administrative support flow.

### Recommended Account-Linking Flow

1. The user selects “Connect Messaging Account” inside the application.
2. The server generates a short-lived, one-time linking code.
3. The user opens the bot.
4. The user sends the linking command or code to the bot.
5. The webhook or bot worker validates the code.
6. The messaging account is linked to the application member.
7. The channel is marked as verified.
8. A confirmation message is sent to the user.

### Linking Code Requirements

The code must be:

- Single-use
- Expiring
- Cryptographically random
- Stored only as a hash
- Restricted to one provider
- Restricted to one member
- Rate-limited
- Revocable
- Audited

### Unlinking

Authorized users and administrators must be able to disable a linked channel.

Unlinking must not delete historical audit records.

---

## 19. Messaging Webhooks

Each provider should have a dedicated route.

Example:

```text
/api/integrations/telegram/webhook
/api/integrations/bale/webhook
```

### Security Rules

- Validate a webhook secret or provider signature.
- Validate the payload with a schema.
- Prevent duplicate update processing.
- Persist provider update IDs or message IDs when needed.
- Do not log sensitive request bodies.
- Apply rate limits.
- Respond quickly.
- Move heavy processing to a worker or queue.
- Do not expose internal errors.
- Unknown commands must not trigger administrative operations.
- Reject requests with invalid secrets.
- Keep bot tokens outside source control.

---

## 20. Suggested Bot Commands

Commands should remain simple and limited.

```text
/start
/link
/unlink
/mytasks
/today
/overdue
/done
/help
```

### Restrictions

Sensitive actions such as:

- Changing task ownership
- Deleting tasks
- Managing members
- Changing roles
- Changing permissions
- Viewing private team data

must not be allowed through the bot without stronger authentication, explicit confirmation, and complete auditability.

### Phase-One Bot Scope

The first phase should only support:

- Account linking
- Receiving notifications
- Viewing a brief task summary
- Opening a task link in the application

Changing task status from a bot should be postponed until the security and audit design is complete.

---

## 21. Message Templates

Templates must not be scattered across Task services.

Suggested structure:

```text
src/features/notifications/server/templates/
  task-assigned.template.ts
  task-due-soon.template.ts
  task-overdue.template.ts
  referral-approved.template.ts
```

Example message:

```text
📌 A new task has been assigned to you

Title: {{taskTitle}}
Assigned by: {{actorName}}
Deadline: {{deadline}}
Priority: {{priority}}

Open task:
{{taskUrl}}
```

### Template Rules

- Keep messages short and readable.
- Never include confidential information unnecessarily.
- Links must be valid and secure.
- Display dates in Tehran time.
- Respect provider message limits.
- Escape Markdown correctly.
- Limit task-title length.
- Aggregate or throttle repetitive low-priority notifications.
- Do not expose hidden comments or attachments without permission.

---

## 22. User Notification Preferences

Each user should be able to configure:

- In-app notifications
- Telegram notifications
- Bale notifications
- Deadline reminders
- Overdue alerts
- Status-change alerts
- Referral alerts
- Quiet hours
- Preferred messaging provider
- Daily digest
- Immediate delivery versus digest delivery

### Exception

Critical security or administrative notifications may be mandatory.

The UI must clearly explain which notifications cannot be disabled.

---

## 23. Notification Worker

Outbox processing must be separated from the main web request flow.

Acceptable options:

- Separate Node.js worker
- Cron job
- Separate PM2 process
- Redis-backed queue
- Job runner compatible with the current infrastructure

Example PM2 configuration:

```js
module.exports = {
  apps: [
    {
      name: "taskmanager-web",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: "8502"
      }
    },
    {
      name: "taskmanager-notification-worker",
      script: "dist/workers/notification-worker.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
```

Before introducing Redis or another queue service, the agent must evaluate:

- Current infrastructure
- Operational complexity
- Deployment impact
- Monitoring requirements
- Backup and recovery
- Failure modes

For the first phase, a database-backed outbox with a simple reliable worker is preferred.

---

## 24. Retry and Failure Handling

Suggested retry policy:

```text
Attempt 1: immediately
Attempt 2: after 1 minute
Attempt 3: after 5 minutes
Attempt 4: after 15 minutes
Attempt 5: after 1 hour
```

After the maximum number of attempts:

- Mark the notification as `FAILED`.
- Save the error.
- Show it in the administration panel.
- Allow authorized manual retry.
- Mark the user channel as requiring attention when appropriate.

The agent must not implement infinite retries.

Permanent provider errors should be distinguished from temporary errors.

Examples:

- Temporary network failure
- Provider rate limit
- Invalid recipient
- Bot blocked by user
- Invalid token
- Invalid message format
- Provider outage

---

## 25. Rate Limiting

Message delivery must be rate-limited.

Apply rate limiting at two levels:

1. Provider-level limits
2. Per-user or per-chat limits

At higher volume:

- Batch messages where appropriate.
- Create digest messages.
- Aggregate low-priority alerts.
- Respect notification priority.
- Add provider-specific throttling.
- Avoid sending multiple equivalent notifications.

---

## 26. Notification Observability

An administrative view or report should show at least:

- Pending notifications
- Sent notifications
- Failed notifications
- Success rate by provider
- Average delivery time
- Retry count
- Users without verified channels
- Disabled channels
- Frequent error types
- Last successful worker run
- Queue age
- Oldest pending notification
- Failed-link attempts

Logs should include a correlation ID.

---

## 27. Repository Root Cleanup

The following types of items should be reviewed and moved or removed when safe:

- `skills`
- `examples`
- `tool-results`
- Nested cloned project folders
- Large generated output files
- `files.txt`
- Backups
- Build artifacts
- Logs
- Temporary files

### Actions

- Improve `.gitignore`.
- Move documentation to `docs/`.
- Move scripts to `scripts/`.
- Remove build output from Git.
- Use Git LFS only when truly necessary.
- Prevent committing large generated files.
- Prevent committing secrets.

The agent must not delete unknown files without inspection.

---

## 28. Build and Deployment

Deployment must be repeatable and documented.

### Requirements

- One official build command
- One official start command
- One official deployment script
- One official PM2 configuration
- Migration before application start
- Health check after restart
- Rollback after failed health check
- Recorded deployed version
- No scattered manual copying steps
- README aligned with the actual environment
- Correct production port
- Correct standalone asset handling

### Suggested Files

```text
scripts/build-production.sh
scripts/deploy.sh
scripts/health-check.sh
ecosystem.config.cjs
```

### Build Pipeline

Minimum stages:

```text
install
lint
typecheck
test
prisma generate
build
prepare standalone assets
migrate deploy
restart
health check
```

### TypeScript

Production builds must not continue with unresolved TypeScript errors.

Using `ignoreBuildErrors` is allowed only as a temporary emergency exception with a documented issue and removal plan.

---

## 29. Logging and Audit

### Application Logging

Logs should be structured.

Suggested fields:

```text
timestamp
level
requestId
memberId
action
feature
entityType
entityId
duration
result
errorCode
```

### Audit Logging

The following actions must be audited:

- Login
- Failed login
- Password change
- Role change
- Permission change
- Task creation
- Task assignment
- Task status change
- Task deletion
- Task restoration
- Referral approval
- Referral rejection
- Notification-channel linking
- Notification-channel unlinking
- Manual notification retry
- Administrative setting changes
- Bot-driven user actions
- Webhook security failures

Audit records must not be editable through normal application flows.

---

## 30. Frontend Standards

The frontend must follow these rules:

- Do not scatter data fetching across large components.
- Manage server state in dedicated hooks or an appropriate server-state library.
- Use shared schemas for form validation.
- Provide loading, empty, error, and success states.
- Do not rely on frontend permission checks alone.
- Extract dialogs into separate components.
- Provide pagination and clear filtering for large tables.
- Prevent duplicate requests.
- Use optimistic updates only with a correct rollback path.
- Maintain basic accessibility.
- Show understandable error messages.
- Preserve the current UI during structural refactoring unless a UI change is explicitly requested.
- Avoid mixing business logic with rendering logic.

---

## 31. Naming Standards

### Files

```text
task.service.ts
task.repository.ts
task.permissions.ts
task.schema.ts
task-table.tsx
use-tasks.ts
```

### Code

- Types and interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Prisma fields: follow the current schema convention
- Event types: `UPPER_SNAKE_CASE`
- Permissions: `resource:action`

Names should reflect the business domain clearly.

---

## 32. Definition of Done

A task is complete only when:

- The requirement is understood.
- Permissions have been reviewed.
- The implementation is complete.
- Inputs are validated.
- Errors are handled.
- Relevant tests exist.
- Typecheck passes.
- Lint passes.
- Required migrations exist.
- Security review is complete.
- Logging and audit have been added when needed.
- Documentation is updated.
- Deployment impact is reviewed.
- Existing behavior has not changed unintentionally.
- A rollback path is known.
- Notification impact has been reviewed.
- Tests have actually been executed.
- No secret has been committed.

---

## 33. Recommended Execution Order

### Phase Zero: Stabilization

- Inspect the repository.
- Document the current state.
- Improve `.gitignore`.
- Add `ecosystem.config.cjs`.
- Standardize build and deployment.
- Update README.
- Enable TypeScript checking.
- Add a health check.
- Create the baseline Prisma migration.
- Create the initial `features/tasks` skeleton.
- Add a smoke test.

### Phase One: Security

- Hash passwords.
- Implement secure sessions.
- Remove passwords from serializers.
- Remove hardcoded default passwords.
- Force first-login password changes.
- Add login rate limiting.
- Add login and password-change audit logs.
- Validate sensitive APIs with Zod.

### Phase Two: Critical Tests

- Authentication
- Permissions
- Create and update Task
- `DONE` and `doneAt`
- Tehran-time filtering
- Referrals
- Soft delete
- Restore
- Team visibility

### Phase Three: Task Refactor

- Extract schemas.
- Extract permissions.
- Extract repositories.
- Extract services.
- Extract hooks.
- Split tables and dialogs.
- Reduce API-route size.

### Phase Four: Notification Foundation

- Add Notification Channel model.
- Add Notification Preference model.
- Add Notification Outbox model.
- Add Notification Log model.
- Implement Notification Service.
- Implement Dispatcher.
- Implement Worker.
- Define Provider interface.
- Add integration tests.

### Phase Five: Telegram

- Configure bot.
- Add webhook.
- Implement account linking.
- Implement message delivery.
- Add retries.
- Add limited end-to-end tests.

### Phase Six: Bale

- Implement an independent provider.
- Add webhook or polling based on the infrastructure.
- Implement account linking.
- Implement message delivery.
- Add retries.
- Add limited end-to-end tests.

### Phase Seven: Notification UX

- Add messaging-account connection page.
- Add notification settings.
- Show channel status.
- Add test-message action.
- Show delivery failures.
- Add unlink action.

### Phase Eight: Continue Refactoring

- Scheduler
- Referred tasks
- Members
- Dashboard

---

## 34. Required Agent Response Format

Before applying a significant change, the agent should report:

### Analysis

- Request objective
- Files involved
- Models involved
- Permissions involved
- Risks
- Migration requirement
- Testing requirement
- Notification impact
- Deployment impact

### Change Plan

- Small implementation steps
- Execution order
- Checkpoints
- Rollback approach

### Execution Result

- Changed files
- Added migrations
- Added tests
- Commands executed
- Typecheck result
- Test result
- Remaining risks

The agent must never claim that a test, build, migration, or deployment succeeded unless it was actually executed.

---

## 35. Prohibited Practices

The agent must not:

- Store raw passwords.
- Commit secrets.
- Rewrite the entire repository without a strong reason.
- Use `prisma db push` as the production migration strategy.
- Enforce authorization only in the frontend.
- Expose raw database errors.
- Call external messaging APIs directly from Task business logic.
- Block the main Task transaction while waiting for message delivery.
- Split large files without protective tests.
- Change the UI during refactoring without a requirement.
- Delete unknown files without inspection.
- Use `any` to hide TypeScript errors.
- Remove or skip failing tests to make the build pass.
- Store Bale or Telegram tokens in source code.
- Send duplicate messages without idempotency.
- Trust a messaging user ID as sufficient authorization.
- Send confidential task data to unauthorized recipients.
- retry permanently failed notifications forever.
- process duplicate webhook updates more than once.

---

## 36. Suggested Environment Variables

Only names and safe examples should appear in `.env.example`.

```env
DATABASE_URL=

APP_BASE_URL=
APP_TIMEZONE=Asia/Tehran
PORT=8502

SESSION_SECRET=
SESSION_COOKIE_NAME=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=

BALE_BOT_TOKEN=
BALE_WEBHOOK_SECRET=
BALE_WEBHOOK_URL=

NOTIFICATION_WORKER_ENABLED=true
NOTIFICATION_BATCH_SIZE=50
NOTIFICATION_MAX_ATTEMPTS=5
```

If polling is used instead of webhooks, polling variables must be clearly separated and documented.

---

## 37. Success Criteria

The refactor is successful when:

- Core application behavior is preserved.
- Task-related bugs decrease.
- API routes become smaller.
- Critical automated tests exist.
- Database changes use migrations.
- Passwords are stored securely.
- Sessions are trustworthy and revocable.
- Deployment follows one documented process.
- Notifications are provider-independent.
- Telegram or Bale failure does not fail the Task operation.
- Duplicate messages are prevented.
- Users can securely link and unlink messaging accounts.
- Failed deliveries are observable and retryable.
- A new developer can understand and run the project using README and this file.
- The system can add another provider without changing Task business logic.

---

## 38. Mandatory Starting Point

The first action taken by an AI agent in this repository must be **Phase Zero**.

Without changing the application UI or business behavior, the agent must:

1. Document the current repository state.
2. Standardize build and deployment scripts.
3. Standardize PM2 configuration.
4. Create a baseline migration.
5. Enable TypeScript checking.
6. Add a smoke test.
7. Create the initial `features/tasks` structure.
8. Design the initial Notification Outbox model.
9. Avoid real messaging-provider integration until authentication security is fixed.
10. Begin gradual Task refactoring only after these foundations exist.

This file is the primary decision-making reference for AI-assisted development in this project.

When delivery speed conflicts with security, data integrity, reversibility, or reliable behavior, the agent must prioritize security, data integrity, reversibility, and low-risk implementation.
