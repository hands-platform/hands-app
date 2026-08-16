# Health And Readiness

The API exposes two public operational checks and one Admin-only external service contract:

- `GET /api/health` confirms the Nest app is running.
- `GET /api/health/ready` checks database, Redis, and storage configuration readiness.
- `GET /api/health/external` requires an authenticated `ADMIN` role and returns configuration readiness and safe runtime evidence without exposing secret values.

## Readiness Checks

- `database`: runs `SELECT 1` through Prisma.
- `redis`: sends `PING` through the Redis state service.
- `storage`: verifies S3-compatible environment variables are configured for MinIO, Cloudflare R2, or Supabase Storage S3.

Storage can be in `placeholder` mode for local MVP flows. Readiness only fails for database or Redis failures because placeholder storage is intentionally supported for development.

## External Service Status

`GET /api/health/external` is an additive, secret-safe contract. Legacy setup fields remain available for smoke-script compatibility. The `services` array is the operator-facing source of truth and keeps two independent status axes:

- Configuration: `CONFIGURED`, `INCOMPLETE`, `DISABLED`, `DEFERRED`, or `UNKNOWN`.
- Runtime: `HEALTHY`, `DEGRADED`, `DOWN`, `UNKNOWN`, or `NOT_MONITORED`.

Configured credentials never imply runtime health. `HEALTHY` requires a recent successful, side-effect-free probe. When no safe probe exists, runtime is `NOT_MONITORED` and runtime timestamps remain null.

- `UNKNOWN` means a configured runtime check ran but could not establish a trustworthy state, for example after a bounded timeout.
- `NOT_MONITORED` means no safe automated runtime probe is configured. It is an evidence-coverage gap, not a confirmed outage.
- `DOWN` and `DEGRADED` are runtime findings and must provide a service-specific impact and safe operator action.

The current launch profile is `CASH_ONLY`. MoMo, VNPay, and referral links are `DEFERRED`; they are visible but do not count as current launch blockers. Core data access, phone authentication, SMS, FCM push, storage, and maps remain current-launch capabilities. Only required incomplete configuration or an enabled service with confirmed degraded/down runtime needs current action. Legacy `checks[].scope`, `services[].requiredForCurrentLaunch`, blocker categories, and counts use this same launch policy.

### Launch manifest and deferred work

`externalServicePolicy` is the launch manifest used by both the legacy checks and the operator-facing service list. It derives `launchScope`, enablement, current-stage requirement, configuration status, blocker membership, and the `total`, `active`, `deferred`, and current-stage counts from the same service collection. A deferred capability is future work, not an outage and not a current cash-only launch blocker.

Deferred service records add a separate re-entry contract:

- `deferredReason`: why the capability is outside the current launch.
- `futureReadiness`: `NOT_STARTED`, `PARTIAL`, or `READY_FOR_REENTRY`.
- `reentryChecks`: secret-safe operational prerequisites. A configured value alone does not prove functional readiness.
- `reviewTrigger`: the product or infrastructure event that should bring the capability back into review.
- `reviewedAt`: the latest persisted review time, or null when no review record exists.
- `platformScope`: the release profile used for platform-specific requirements.

MoMo and VNPay remain deferred until online payments are approved and their sandbox, callback, signed-flow, recovery, reconciliation, and refund evidence is complete. Payment workspaces are related destinations only; they are not treated as readiness evidence.

Referral links currently use the `ANDROID_MVP` release profile. The current referral prerequisites are the public base URL, customer Android destination, Partner Android destination, and Android device-routing smoke. Customer and Partner iOS destinations remain `FUTURE` and do not fail Android readiness. An `IOS_RELEASE` profile adds both iOS destinations as required checks.

Admin Setup canonicalizes `/setup?mode=runtime&view=deferred` to `/setup?mode=readiness&view=deferred`. Runtime views contain active evidence; the Deferred view is a future-work ledger. Operator dates and times in this workspace use Vietnam local time, `Asia/Ho_Chi_Minh` (`UTC+7`).

The endpoint reuses a bounded database `SELECT 1` connectivity check for Supabase core evidence. It does not automatically send OTP, SMS, push notifications, create payments or refunds, or upload files. Provider errors are reduced to secret-safe evidence summaries.

Each service can include:

- `configurationCheckedAt`: when configuration was evaluated.
- `evidenceLevel`: `CONFIGURATION_ONLY`, `CONNECTIVITY`, or `FUNCTIONAL`.
- `lastVerifiedAt` and `verificationMethod`: the latest event and method supporting the stated evidence level.
- `lastProbeAt`, `lastSuccessAt`, `failureSince`, `latencyMs`, and `isStale`: only when runtime evidence exists.
- `probeType`: configuration, connectivity, functional E2E, or none.
- `evidenceGap`: true only for a required, enabled service whose runtime state is `UNKNOWN` or `NOT_MONITORED`.
- `ownerTeam`, `impactSummary`, and `safeOperatorAction`: ownership, service-specific impact, and a safe next step.
- `evidenceHref`: a stable, filtered Admin destination that contains relevant evidence.
- `relatedWorkspaceHref`: a broader operational workspace. It must not be labelled as evidence.
- `runbookHref`: an operator runbook when a stable Admin-accessible runbook exists.
- `launchScope`, `deferredReason`, `futureReadiness`, `reentryChecks`, `reviewTrigger`, `reviewedAt`, and `platformScope`: the current launch and future re-entry contract for deferred capabilities.

The summary counts keep `unknown` and `notMonitored` separate and include `evidenceGaps`. `total`, `active`, and `deferred` describe the same manifest-derived service collection. `required`, `configurationReady`, and `runtimeVerified` support a dynamic cash-only launch conclusion without claiming unprobed services are healthy.

The admin `/setup` workspace uses `adminGetResult` so authentication, permission, rate-limit, network, and server failures are not rendered as an empty or healthy service list.

## Legacy Readiness Scope

Legacy readiness fields remain for existing scripts and setup helpers during the additive migration.

- `CURRENT_STAGE`: blocks current launch E2E when not ready. It covers core data access, phone authentication, SMS, FCM push, storage, and maps.
- `DEFERRED`: tracked for a later launch phase. It covers MoMo, VNPay, referral links, and non-operator mobile release checks.

Each legacy external check can include:

- `operatorAction`: what the operator should do next without exposing secret values.
- `commands`: repository commands to verify that specific setup area.
- `secretSafe`: confirms the response does not print actual secrets.

## Usage

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/health/ready
Invoke-RestMethod http://localhost:3000/api/health/external -Headers @{ Authorization = 'Bearer <admin-access-token>' }
```

The E2E smoke script calls both checks before exercising product flows. Admin Setup uses the typed `services` contract to separate runtime health from launch readiness; raw verification commands and secret values are not shown in its primary operator workspace.
