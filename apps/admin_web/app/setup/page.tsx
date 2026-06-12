import { AdminExternalReadiness, apiGet } from '../../lib/admin-api';
import { SetupMigrationRunwaySection } from './setup-migration-runway-section';
import { SetupOverviewSection } from './setup-overview-section';
import { SetupOperatorActionsSection } from './setup-operator-actions-section';
import { SetupProgressControlSection } from './setup-progress-control-section';
import { SetupRegistrationHandoffSection } from './setup-registration-handoff-section';

const fcmEnvKeys = [
  'PUSH_PROVIDER',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
];

const setupOrder = [
  {
    id: 'mobile',
    title: 'Mobile Firebase scope guard',
    phase: 'Code baseline',
    operatorAction: 'Keep Firebase limited to FCM-only surfaces in both Flutter apps.',
    exitCriteria: 'Firebase scope and Flutter architecture guards pass.',
    purpose: 'Required to keep Firebase DB/Auth/Firestore out while FCM remains the official push path.',
    env: ['customer_app', 'provider_app'],
    notes: [
      'Firebase Messaging is allowed for Android/iOS push only.',
      'Do not add Firebase Realtime Database, Firestore, Firebase Auth, or Firebase Storage.',
      'Keep google-services.json and GoogleService-Info.plist out of Git; use local or CI secret delivery.',
    ],
    commands: [
      'node infra\\scripts\\check-mobile-firebase.mjs',
      'npm.cmd run security:secrets',
      'npm.cmd run verify:local',
    ],
  },
  {
    id: 'mobile-release',
    title: 'Android release signing',
    phase: 'Store release preparation',
    operatorAction:
      'Create separate customer/partner upload keystores, store them outside Git, and fill local key.properties files.',
    exitCriteria: 'Customer and partner release APK builds succeed with local upload signing enabled.',
    purpose: 'Required before Play Console upload and any Android vendor that requires SHA fingerprints.',
    env: ['ANDROID_CUSTOMER_UPLOAD_KEYSTORE', 'ANDROID_PROVIDER_UPLOAD_KEYSTORE'],
    notes: [
      'Local MVP release builds fall back to debug signing when android/key.properties is missing.',
      'Recommended: run the signing helper to create both upload keys and app-local key.properties files.',
      'Manual fallback: copy each key.properties.example file and fill the keystore path and passwords yourself.',
      'Keep .jks/.keystore files under C:\\dev\\massage-vn-workspace\\secrets or another private folder.',
      'Use android-signing-summary.txt for Play Console SHA-1/SHA-256 fingerprint handoff.',
      'Never commit key.properties, keystore files, passwords, or Play Console credentials.',
    ],
    commands: [
      'npm.cmd run android:signing:create',
      'Get-Content C:\\dev\\massage-vn-workspace\\secrets\\android-signing\\android-signing-summary.txt',
      'cd apps\\customer_app; flutter build apk --release; cd ..\\..',
      'cd apps\\provider_app; flutter build apk --release; cd ..\\..',
      'npm.cmd run external:check:production',
    ],
  },
  {
    id: 'supabase',
    title: 'Supabase core database',
    phase: 'Staging foundation',
    operatorAction:
      'Keep Supabase staging URL, anon key, JWT secret, and service-role key in local/server secrets.',
    exitCriteria: 'Supabase SQL applies cleanly and core credential checks pass without exposing secrets.',
    purpose: 'Required before PostgreSQL, Storage, RLS, and future Supabase-backed data access.',
    env: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'],
    notes: [
      'Supabase organization/workspace is HANDS and the staging project is hands-staging.',
      'The generated SQL bundle has been applied successfully.',
      'Use infra/env/hands-staging.env.example as the operator fill-in checklist.',
      'Copy the project URL and anon key from Supabase project settings.',
      'Set the JWT secret on the API so access tokens can be verified server-side.',
      'Keep the service role key server-side only; it is used by admin operations to sync approved partner roles.',
      'Run the secret leak guard before every push after editing any local environment file.',
    ],
    commands: [
      'npm.cmd run setup:doctor',
      'npm.cmd run security:secrets',
      'npm.cmd run external:pack',
      'npm.cmd run external:pack:write',
      'Get-Content .\\infra\\env\\hands-staging.env.example',
      'npm.cmd run supabase:sql:pack',
      'npm.cmd run external:check:supabase',
    ],
  },
  {
    id: 'supabase-auth',
    title: 'Supabase Phone Auth with SMS service',
    phase: 'Deferred OTP migration',
    operatorAction:
      'Keep AUTH_BACKEND=nest and SMS_PROVIDER=dev until a real SMS service and Supabase Phone Auth OTP are ready.',
    exitCriteria: 'SMS OTP delivery works and Supabase access tokens exchange into HANDS API tokens.',
    purpose:
      'Required before replacing local Nest/dev OTP with Supabase Phone Auth in customer and partner apps.',
    env: ['AUTH_BACKEND', 'SMS_PROVIDER', 'SMS_API_URL', 'SMS_API_KEY'],
    notes: [
      'This step is intentionally deferred so product development can continue without breaking login.',
      'Do not fill Supabase Phone Auth SMS fields with placeholder values.',
      'Use dev OTP locally. Vonage is the selected SMS path for the next Phone Auth E2E pass; Viettel/FPT or a custom Vietnam SMS backend remain fallback options if delivery or cost requires it.',
      'Partner role exchange must remain server-verified and must not accept a client-selected role.',
      'After this passes, mobile apps can switch AUTH_BACKEND from nest to supabase.',
    ],
    commands: [
      'npm.cmd run external:check:supabase-auth',
      '$env:SUPABASE_JWT_SECRET="<project-jwt-secret>"; $env:API_BASE_URL="http://localhost:3000/api"; npm.cmd run auth:supabase-smoke',
    ],
  },
  {
    id: 'maps',
    title: 'MapTiler and Geoapify',
    phase: 'Location E2E',
    operatorAction: 'Use the configured low-cost map/geocoding keys and verify address search before E2E.',
    exitCriteria: 'Customer app can search an address, move the pin, and load nearby partners.',
    purpose: 'Required for customer address search, map pin confirmation, and nearby partner display.',
    env: ['MAPTILER_API_KEY', 'GEOAPIFY_API_KEY'],
    notes: [
      'MapTiler and Geoapify keys are configured locally in ignored environment files.',
      'Use MapTiler only for map tiles.',
      'Use Geoapify only for geocoding/search.',
      'No routing, directions, or realtime streaming API is needed for MVP cost control.',
    ],
    commands: [
      'npm.cmd run external:pack',
      'npm.cmd run external:check:maps',
      'powershell -ExecutionPolicy Bypass -File .\\infra\\scripts\\run-hands-emulator.ps1 -App customer',
    ],
  },
  {
    id: 'operations-policy',
    title: 'Runtime operations policy',
    phase: 'Dispatch policy control',
    operatorAction:
      'Review matching, Open Matching Marketplace, wallet settlement gate, cancellation, no-show, and notification policy before live dispatch testing.',
    exitCriteria:
      'Operations Policy page shows the intended first-pick window, marketplace participation, customer final selection, and wallet settlement gate.',
    purpose:
      'Required so operational rules can be changed from admin without hardcoding dispatch, tax, cancellation, or no-show behavior in the apps.',
    env: [
      'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES',
      'MATCHING_BACKUP_PROVIDER_RADIUS_METERS',
      'MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES',
      'MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT',
      'MATCHING_PREFERRED_ACCEPT_MODE',
      'MATCHING_BACKUP_OPEN_MODE',
      'WALLET_NEGATIVE_BALANCE_GATE',
      'CANCELLATION_AFTER_MATCH_POLICY',
      'NO_SHOW_PARTNER_REPORT_POLICY',
      'NOTIFICATION_PARTNER_ALERT_CHANNEL',
    ],
    notes: [
      'Env values are seed/default hints; day-to-day changes should be made from /operations-policy so updates are audited.',
      'MVP rule: selected first partner gets the configured response window, and marketplace participants can still enter the customer shortlist.',
      'Customer final selection is required unless the first-pick partner validly accepts first under API rules.',
      'Partners with negative wallet balance can view marketplace requests, but marketplace alerts, participation, and payout release wait for settlement.',
    ],
    commands: [
      'Open http://localhost:3101/operations-policy',
      'node infra\\scripts\\api-smoke.mjs',
      'npm.cmd run admin:web-smoke',
    ],
  },
  {
    id: 'payments',
    title: 'Vietnam payment gateways',
    phase: 'Commercial E2E',
    operatorAction: 'Add MoMo and VNPay sandbox credentials before real payment testing.',
    exitCriteria: 'Authorization, release, capture, cash fallback, and refund smoke flows pass.',
    purpose: 'Required for real MoMo/VNPay E2E authorization, capture, release, and refund testing.',
    env: ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY', 'VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'],
    notes: [
      'Local smoke tests can run without merchant credentials.',
      'Use gateway sandbox credentials before any production merchant key.',
      'Keep cash payment available as an operational fallback.',
    ],
    commands: ['npm.cmd run external:check:payments', 'node infra\\scripts\\api-smoke.mjs'],
  },
  {
    id: 'notifications',
    title: 'OS push notifications',
    phase: 'Messaging E2E',
    operatorAction:
      'Keep in-app notifications locally; configure FCM only when native push E2E starts.',
    exitCriteria: 'FCM project, Firebase Admin credentials, and mobile device delivery are confirmed.',
    purpose:
      'Required before native OS push notifications. OTP SMS is tracked separately under Supabase Phone Auth.',
    env: fcmEnvKeys,
    notes: [
      'OTP SMS belongs to the deferred Supabase Phone Auth step.',
      'FCM is for push only; Firebase DB/Auth/Firestore are not part of HANDS MVP.',
      'Firebase Admin service account values are server-side only and must not be copied into Flutter or browser code.',
    ],
    commands: ['npm.cmd run external:check:production', 'npm.cmd run verify:local'],
  },
  {
    id: 'storage',
    title: 'File storage and CDN',
    phase: 'Media operations',
    operatorAction: 'Use local MinIO for MVP, then configure production storage/CDN.',
    exitCriteria: 'Private verification files and public partner media can be uploaded and served.',
    purpose: 'Required for partner verification files, public profile media, and moderation evidence.',
    env: [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_PRIVATE_BUCKET',
      'S3_PUBLIC_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_REGION',
      'S3_PUBLIC_BASE_URL',
    ],
    notes: [
      'Local MinIO is enough for development.',
      'Use private reads for verification files.',
      'For Supabase Storage, prefer S3_PRIVATE_BUCKET=hands-private and S3_PUBLIC_BUCKET=hands-public.',
      'Serve approved public partner media through a CDN base URL.',
    ],
    commands: [
      'npm.cmd run external:check:storage',
      'npm.cmd run storage:smoke',
      'powershell -ExecutionPolicy Bypass -File .\\infra\\scripts\\verify-local.ps1 -WithServices',
    ],
  },
];

const externalRegistrationPlan = [
  {
    id: 'github-org',
    groupId: 'mobile',
    title: 'GitHub organization and repository',
    provider: 'GitHub',
    owner: 'hands-platform',
    status: 'Account ready',
    statusClass: 'pill-success',
    detail:
      'Development source control is now centered on hands-platform/hands-app. Keep develop as the active branch.',
    env: ['GITHUB_OWNER=hands-platform', 'GITHUB_REPO=hands-app'],
  },
  {
    id: 'domain-email',
    groupId: 'supabase',
    title: 'Domain, DNS, and operations email',
    provider: 'PA Vietnam',
    owner: 'administration@hands.vn',
    status: 'Manual control',
    statusClass: 'pill-info',
    detail:
      'hands.vn DNS and administration@hands.vn are managed manually. Add verification records only from official external service consoles.',
    env: ['hands.vn', 'administration@hands.vn'],
  },
  {
    id: 'supabase-staging',
    groupId: 'supabase',
    title: 'Supabase staging project',
    provider: 'Supabase',
    owner: 'HANDS / hands-staging',
    detail:
      'Project exists. Keep anon/publishable values client-side only and service-role/JWT secrets server-side only.',
    env: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'maptiler-geoapify',
    groupId: 'maps',
    title: 'Low-cost map and geocoding keys',
    provider: 'MapTiler + Geoapify',
    owner: 'administration@hands.vn',
    detail:
      'Keys are stored in ignored local env files. Use tiles and geocoding only; no routing, directions, or live tracking APIs.',
    env: ['MAPTILER_API_KEY', 'GEOAPIFY_API_KEY'],
  },
  {
    id: 'operations-policy',
    groupId: 'operations-policy',
    title: 'Runtime matching and acceptance policy',
    provider: 'HANDS Admin',
    owner: 'Operations team',
    status: 'Admin controlled',
    statusClass: 'pill-info',
    detail:
      'First-pick response, Open Matching Marketplace behavior, customer final selection, wallet settlement, and payout gates are controlled from Operations Policy.',
    env: [
      'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES',
      'MATCHING_BACKUP_PROVIDER_RADIUS_METERS',
      'WALLET_NEGATIVE_BALANCE_GATE',
    ],
  },
  {
    id: 'sms-phone-provider',
    groupId: 'supabase-auth',
    title: 'Phone OTP service',
    provider: 'Dev OTP / Vonage deferred / Viettel or FPT fallback',
    owner: 'administration@hands.vn',
    status: 'Deferred',
    statusClass: 'pill-neutral',
    detail:
      'Supabase Phone Auth remains deferred. Keep local/dev OTP until Vonage SMS delivery and the API token exchange are tested end to end.',
    env: ['SMS_PROVIDER', 'SMS_API_KEY', 'SMS_API_URL'],
  },
  {
    id: 'fcm',
    groupId: 'notifications',
    title: 'Push notification service',
    provider: 'Firebase Cloud Messaging',
    owner: 'administration@hands.vn',
    status: 'Deferred',
    statusClass: 'pill-neutral',
    detail:
      'Use in-app notifications locally until FCM app config and server-side Firebase Admin credentials are ready.',
    env: fcmEnvKeys,
  },
  {
    id: 'payments-vn',
    groupId: 'payments',
    title: 'Vietnam payment sandbox',
    provider: 'MoMo + VNPay',
    owner: 'administration@hands.vn',
    status: 'Deferred',
    statusClass: 'pill-neutral',
    detail:
      'Cash and local smoke flows can continue. Add gateway sandbox credentials before real payment authorization E2E.',
    env: ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'],
  },
  {
    id: 'storage-cdn',
    groupId: 'storage',
    title: 'Storage and CDN',
    provider: 'Supabase Storage or S3-compatible storage',
    owner: 'administration@hands.vn',
    detail:
      'Local MinIO is enough for development. Production needs private KYC buckets and public partner media delivery.',
    env: ['S3_PRIVATE_BUCKET', 'S3_PUBLIC_BUCKET', 'S3_PUBLIC_BASE_URL'],
  },
  {
    id: 'android-release',
    groupId: 'mobile-release',
    title: 'Android release signing and store setup',
    provider: 'Google Play Console',
    owner: 'administration@hands.vn',
    detail:
      'Create separate customer/partner signing keys outside Git, then use fingerprints for Android external service consoles.',
    env: ['ANDROID_CUSTOMER_UPLOAD_KEYSTORE', 'ANDROID_PROVIDER_UPLOAD_KEYSTORE'],
  },
];

const projectControlSequence = [
  {
    phase: 'Phase A',
    title: 'Admin operating core',
    status: 'Active now',
    detail:
      'Keep customer, partner, booking, payment, wallet, chat archive, service pricing, tax, and operations policy visible from admin.',
  },
  {
    phase: 'Phase B',
    title: 'Backend rule consistency',
    status: 'Next',
    detail:
      'Align admin-configurable rules with first-pick response windows, marketplace participant alerts, wallet gates, payout release, fees, and tax logs.',
  },
  {
    phase: 'Phase C',
    title: 'Mobile E2E hardening',
    status: 'After rules',
    detail:
      'Run customer and partner flows through address selection, direct booking, Open Matching Marketplace, chat, location share, completion, and wallet effects.',
  },
  {
    phase: 'Phase D',
    title: 'Production integrations',
    status: 'Deferred',
    detail:
      'Connect production SMS, FCM, MoMo, VNPay, production storage/CDN, and Android release signing only after local E2E remains stable.',
  },
  {
    phase: 'Phase E',
    title: 'Design and localization',
    status: 'Later',
    detail:
      'Apply the final Figma design and language packs after the operational flow stops changing daily.',
  },
];

const verifiedBaseline = [
  'API typecheck and build pass.',
  'Admin typecheck, build, and 53-page smoke pass.',
  'Customer Flutter analyze/test pass.',
  'Partner Flutter analyze/test pass.',
  'Firebase imports are removed from mobile apps.',
  'MapTiler and Geoapify checks pass.',
  'Supabase schema guard passes.',
  'Secret leak guard passes.',
];

export default async function SetupPage() {
  const readiness = await apiGet<AdminExternalReadiness>('/health/external', {
    ok: false,
    timestamp: new Date(0).toISOString(),
    checks: [],
  });

  const readinessUnavailable = isReadinessUnavailable(readiness);
  const summary = buildSummary(readiness, readinessUnavailable);
  const groupStatuses = buildGroupStatuses(readiness);
  const externalBacklog = buildExternalBacklog(readiness, readinessUnavailable);
  const nextActions = buildNextOperatorActions(readiness, readinessUnavailable);
  const deferredActions = buildDeferredOperatorActions(readiness, readinessUnavailable);
  const currentStage = buildCurrentStageStatus(readiness, readinessUnavailable);
  const registrationPlan = buildExternalRegistrationPlan(readiness, readinessUnavailable);

  return (
    <>
      <SetupOverviewSection
        readinessOk={readiness.ok}
        readinessUnavailable={readinessUnavailable}
        readinessTimestamp={readiness.timestamp}
        currentStage={currentStage}
        summary={summary}
      />

      <SetupProgressControlSection sequence={projectControlSequence} verifiedBaseline={verifiedBaseline} />

      <SetupRegistrationHandoffSection registrationPlan={registrationPlan} />

      <section className="detail-grid admin-mb-16">
        <SetupOperatorActionsSection nextActions={nextActions} deferredActions={deferredActions} />

        <SetupMigrationRunwaySection groupStatuses={groupStatuses} />
      </section>

      <section className="detail-grid">
        <div className="card">
          <h2>Live readiness</h2>
          <p className="muted">
            This panel is backed by the API endpoint, so it reflects the current `.env` and process
            environment.
          </p>
          <div className="stack">
            {readiness.checks.map((check) => (
              <ReadinessRow check={check} key={`${check.category}-${check.name}`} />
            ))}
            {readiness.checks.length === 0 && (
              <div className="ops-row">
                <div>
                  <strong>Readiness API unavailable</strong>
                  <p className="muted">Start the HANDS API and refresh this page.</p>
                </div>
                <span className="pill pill-warn">BLOCKED</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Recommended order</h2>
          <div className="timeline">
            {setupOrder.map((group, index) => (
              <a className="timeline-step" href={`#${group.id}`} key={group.id}>
                <span>Step {index + 1}</span>
                <strong>{group.title}</strong>
                <p className="muted">{group.purpose}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="card admin-mt-16">
        <div className="ops-section-header">
          <div>
            <h2>What still needs external registration</h2>
            <p className="muted">
              This is the human-action backlog. Code checks stay green while these production keys are not
              filled.
            </p>
          </div>
          <span className={`signal ${summary.missing === 0 ? 'signal-ok' : 'signal-warn'}`}>
            {summary.missing === 0 ? 'No missing values' : `${summary.missing} value(s) pending`}
          </span>
        </div>
        <div className="setup-backlog">
          {externalBacklog.map((item) => (
            <a className="setup-backlog-item" href={`#${item.groupId}`} key={`${item.groupId}-${item.name}`}>
              <span>{item.groupTitle}</span>
              <strong>{item.name}</strong>
              <p className="muted">{item.reason}</p>
            </a>
          ))}
          {externalBacklog.length === 0 && (
            <p className="muted">All external readiness values are configured for the current environment.</p>
          )}
        </div>
      </section>

      <section className="stack admin-mt-16">
        {setupOrder.map((group) => {
          const relatedChecks = readiness.checks.filter((check) =>
            setupGroupMatches(group.id, check.category),
          );
          return (
            <div className="card" id={group.id} key={group.id}>
              <div className="ops-section-header">
                <div>
                  <h2>{group.title}</h2>
                  <p className="muted">
                    <strong>{group.phase}:</strong> {group.operatorAction}
                  </p>
                  <p className="muted">{group.purpose}</p>
                </div>
                <span className={setupGroupSignalClass(relatedChecks)}>
                  {setupGroupStatus(relatedChecks)}
                </span>
              </div>
              <div className="detail-grid admin-mt-12">
                <div>
                  <h3>Environment values</h3>
                  <div className="participant-list">
                    {group.env.map((name) => (
                      <span className={envPillClass(name, relatedChecks)} key={name}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Implementation notes</h3>
                  <ul className="muted">
                    {group.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                  <p className="muted">
                    <strong>Exit criteria:</strong> {group.exitCriteria}
                  </p>
                </div>
              </div>
              <div className="setup-command-block">
                <h3>Verification commands</h3>
                <p className="muted">
                  Run from <code>C:\dev\massage-vn-workspace\repo</code>. Values inside angle brackets must be
                  replaced locally.
                </p>
                <div className="setup-command-list">
                  {group.commands.map((command) => (
                    <code key={command}>{command}</code>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function ReadinessRow({ check }: { check: AdminExternalReadiness['checks'][number] }) {
  const configured = check.configured.map(externalReadinessDisplayText);
  const missing = check.missing.map(externalReadinessDisplayText);
  const invalid = (check.invalid ?? []).map(externalReadinessDisplayText);
  const commands = check.commands ?? [];
  const isCurrentStage = check.scope === 'CURRENT_STAGE';

  return (
    <div className="ops-row">
      <div>
        <strong>{externalReadinessDisplayText(check.name)}</strong>
        <p className="muted">{externalReadinessDisplayText(check.detail)}</p>
        <div className="participant-list admin-mb-8">
          <span className={`pill ${isCurrentStage ? 'pill-info' : 'pill-neutral'}`}>
            {isCurrentStage ? 'Current stage' : 'Deferred'}
          </span>
          {check.secretSafe && <span className="pill pill-neutral">Secret-safe</span>}
        </div>
        {check.operatorAction && (
          <p className="muted">
            <strong>Operator action:</strong> {externalReadinessDisplayText(check.operatorAction)}
          </p>
        )}
        {configured.length > 0 && <p className="muted">Configured: {configured.join(', ')}</p>}
        {missing.length > 0 && <p className="muted">Missing: {missing.join(', ')}</p>}
        {invalid.length > 0 && <p className="muted">Invalid: {invalid.join(', ')}</p>}
        {commands.length > 0 && (
          <div className="setup-command-list admin-mt-8">
            {commands.map((command) => (
              <code key={`${check.category}-${command}`}>{command}</code>
            ))}
          </div>
        )}
      </div>
      <span className={`pill ${check.status === 'READY' ? 'pill-success' : 'pill-warn'}`}>
        {check.status}
      </span>
    </div>
  );
}

function externalReadinessDisplayText(value: string) {
  return value
    .replace(/\bCustomer and provider\b/g, 'Customer and partner')
    .replace(/\bcustomer and provider\b/g, 'customer and partner')
    .replace(/\bprovider Android\b/g, 'partner Android')
    .replace(/\bProvider Android\b/g, 'Partner Android')
    .replace(/\bOS push provider\b/g, 'OS push service')
    .replace(/\bSMS provider\b/g, 'SMS service')
    .replace(/\bprovider credentials\b/g, 'SMS backend credentials');
}

function buildSummary(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  if (readinessUnavailable) {
    return { ready: 0, partial: 0, blocked: 1, missing: 1 };
  }

  return readiness.checks.reduce(
    (summary, check) => ({
      ready: summary.ready + (check.status === 'READY' ? 1 : 0),
      partial: summary.partial + (check.status === 'PARTIAL' ? 1 : 0),
      blocked: summary.blocked + (check.status === 'BLOCKED' ? 1 : 0),
      missing: summary.missing + check.missing.length + (check.invalid?.length ?? 0),
    }),
    { ready: 0, partial: 0, blocked: 0, missing: 0 },
  );
}

function buildExternalBacklog(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  if (readinessUnavailable) {
    return [
      {
        groupId: 'live-readiness',
        groupTitle: 'API runtime',
        name: 'API readiness endpoint',
        reason:
          'Start the HANDS API or Docker services, then refresh this page before using setup status.',
        commands: [],
      },
    ];
  }

  return readiness.checks.flatMap((check) => {
    const group = setupOrder.find((setupGroup) => setupGroupMatches(setupGroup.id, check.category));
    const groupId = group?.id ?? 'setup';
    const groupTitle = group?.title ?? check.category;
    const missing = [...check.missing, ...(check.invalid ?? [])];
    return missing.map((name) => ({
      groupId,
      groupTitle,
      name,
      reason: check.operatorAction ?? check.detail,
      commands: check.commands ?? [],
    }));
  });
}

function buildGroupStatuses(readiness: AdminExternalReadiness) {
  return setupOrder.map((group) => {
    const relatedChecks = readiness.checks.filter((check) => setupGroupMatches(group.id, check.category));
    return {
      id: group.id,
      title: group.title,
      phase: group.phase,
      status: setupGroupStatus(relatedChecks),
    };
  });
}

function buildNextOperatorActions(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  const backlog = buildExternalBacklog(readiness, readinessUnavailable);
  return backlog
    .filter((item) => !isDeferredSetupGroup(item.groupId))
    .map((item) => {
      if (item.groupId === 'live-readiness') {
        return {
          ...item,
          phase: 'Runtime check',
          action: 'Start the API/Docker services and rerun setup doctor before external E2E.',
          commands: item.commands ?? [],
          rank: -1,
        };
      }
      const groupIndex = setupOrder.findIndex((group) => group.id === item.groupId);
      const group = setupOrder[groupIndex] ?? setupOrder[0];
      return {
        ...item,
        phase: group.phase,
        action: group.operatorAction,
        commands: item.commands ?? [],
        rank: groupIndex === -1 ? setupOrder.length : groupIndex,
      };
    })
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}

function buildDeferredOperatorActions(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  const backlog = buildExternalBacklog(readiness, readinessUnavailable);
  if (readinessUnavailable) {
    return [];
  }

  return backlog
    .filter((item) => isDeferredSetupGroup(item.groupId))
    .map((item) => {
      const groupIndex = setupOrder.findIndex((group) => group.id === item.groupId);
      const group = setupOrder[groupIndex] ?? setupOrder[0];
      return {
        ...item,
        phase: group.phase,
        action: group.operatorAction,
        commands: item.commands ?? [],
        rank: groupIndex === -1 ? setupOrder.length : groupIndex,
      };
    })
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}

function buildCurrentStageStatus(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  if (readinessUnavailable) {
    return {
      ok: false,
      blockers: 1,
      label: 'API unavailable',
      helper: 'Start local API/Docker services before using setup status.',
    };
  }

  const blockers = buildNextOperatorActions(readiness, false).length;
  const apiBlockingCount = readiness.blockingCategories?.length;
  const effectiveBlockers = typeof apiBlockingCount === 'number' ? apiBlockingCount : blockers;
  const currentStageOk = readiness.currentStageOk ?? effectiveBlockers === 0;
  return {
    ok: currentStageOk,
    blockers: effectiveBlockers,
    label: currentStageOk ? 'Current stage clear' : 'Current stage blocked',
    helper:
      currentStageOk
        ? 'Local MVP work can continue; deferred production integrations remain tracked separately.'
        : 'These are non-deferred setup gaps that can block current local/staging E2E work.',
  };
}

function buildExternalRegistrationPlan(readiness: AdminExternalReadiness, readinessUnavailable = false) {
  return externalRegistrationPlan.map((item) => {
    if (item.status && item.statusClass) {
      return item;
    }

    if (readinessUnavailable) {
      return {
        ...item,
        status: 'Not checked',
        statusClass: 'pill-warn',
      };
    }

    const checks = readiness.checks.filter((check) => setupGroupMatches(item.groupId, check.category));
    if (checks.length === 0) {
      return {
        ...item,
        status: 'Not checked',
        statusClass: 'pill-neutral',
      };
    }
    if (checks.some((check) => check.status === 'BLOCKED')) {
      return {
        ...item,
        status: 'Needs credential',
        statusClass: 'pill-warn',
      };
    }
    if (checks.some((check) => check.status === 'PARTIAL')) {
      return {
        ...item,
        status: 'Partial',
        statusClass: 'pill-info',
      };
    }
    return {
      ...item,
      status: 'Ready',
      statusClass: 'pill-success',
    };
  });
}

function isDeferredSetupGroup(groupId: string) {
  return ['supabase-auth', 'notifications', 'payments', 'storage', 'mobile-release'].includes(groupId);
}

function isReadinessUnavailable(readiness: AdminExternalReadiness) {
  return !readiness.ok && readiness.checks.length === 0;
}

function setupGroupMatches(groupId: string, category: string) {
  if (groupId === 'supabase') {
    return category === 'supabase';
  }
  if (groupId === 'supabase-auth') {
    return category === 'supabase-auth' || category === 'sms';
  }
  if (groupId === 'mobile') {
    return category === 'mobile';
  }
  if (groupId === 'mobile-release') {
    return category === 'mobile-release';
  }
  if (groupId === 'notifications') {
    return category === 'push';
  }
  if (groupId === 'payments') {
    return category === 'payments';
  }
  return groupId === category;
}

function setupGroupStatus(checks: AdminExternalReadiness['checks']) {
  if (checks.length === 0) {
    return 'Not checked';
  }
  if (checks.some((check) => check.status === 'BLOCKED')) {
    return 'Blocked';
  }
  if (checks.some((check) => check.status === 'PARTIAL')) {
    return 'Partial';
  }
  return 'Ready';
}

function setupGroupSignalClass(checks: AdminExternalReadiness['checks']) {
  const status = setupGroupStatus(checks);
  return `signal ${status === 'Ready' ? 'signal-ok' : status === 'Partial' ? 'signal-info' : 'signal-warn'}`;
}

function envPillClass(name: string, checks: AdminExternalReadiness['checks']) {
  const configured = checks.some((check) => check.configured.includes(name));
  const missing = checks.some(
    (check) => check.missing.includes(name) || (check.invalid ?? []).includes(name),
  );
  if (configured) {
    return 'pill pill-success';
  }
  if (missing) {
    return 'pill pill-warn';
  }
  return 'pill pill-neutral';
}
