import type { ExternalRegistrationPlanItem, SetupOrderItem } from './setup-page-model';
import {
  FCM_CREDENTIALS_CHECK_COMMAND,
  FCM_CREDENTIALS_INSTALL_CHECK_COMMAND,
  FCM_CREDENTIALS_INSTALL_UPDATE_COMMAND,
  FCM_DOCKER_CONTRACT_COMMAND,
  FCM_ENV_CONTRACT_COMMAND,
  FCM_EXTERNAL_CHECK_COMMAND,
  FCM_PUSH_DATA_CONTRACT_COMMAND,
  FCM_PUSH_SMOKE_DRY_RUN_COMMAND,
  FCM_PUSH_SMOKE_PREFLIGHT_COMMAND,
  FCM_SECURITY_SECRETS_COMMAND,
  FCM_TOKEN_RECOVERY_SMOKE_COMMAND,
  FCM_TOKEN_SMOKE_COMMAND,
  FCM_TOKEN_SMOKE_DRY_RUN_COMMAND,
} from '../notifications/fcm-smoke-commands';

type ProjectControlStep = {
  readonly phase: string;
  readonly title: string;
  readonly status: string;
  readonly detail: string;
};

const fcmEnvKeys = [
  'PUSH_PROVIDER',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_ADMIN_CREDENTIALS_HOST_PATH',
  'FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH',
] as const;

export const setupOrder = [
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
      'Keep .jks/.keystore files under C:\\dev\\hands-secrets\\android-signing or another private folder.',
      'Use android-signing-summary.txt for Play Console SHA-1/SHA-256 fingerprint handoff.',
      'Never commit key.properties, keystore files, passwords, or Play Console credentials.',
    ],
    commands: [
      'npm.cmd run android:signing:create',
      'Get-Content C:\\dev\\hands-secrets\\android-signing\\android-signing-summary.txt',
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
    title: 'FCM push notifications',
    phase: 'Messaging E2E',
    operatorAction:
      'Keep in-app notifications as fallback, then verify FCM with current app tokens before broad FCM push.',
    exitCriteria: 'FCM project, Firebase Admin credentials, and mobile device delivery are confirmed.',
    purpose:
      'Required before native FCM push notifications. OTP SMS is tracked separately under Supabase Phone Auth.',
    env: fcmEnvKeys,
    notes: [
      'OTP SMS belongs to the deferred Supabase Phone Auth step.',
      'FCM is for push only; Firebase DB/Auth/Firestore are not part of HANDS MVP.',
      'FIREBASE_SERVICE_ACCOUNT_JSON must be raw or base64 service account JSON with project_id, client_email, and private_key.',
      'google-services.json is mobile client config only; it does not replace server-side Firebase Admin credentials.',
      'Firebase Admin credentials must come from the same Firebase project as the customer and Partner google-services.json files.',
      'Firebase Admin service account values are server-side only and must not be copied into Flutter or browser code.',
      'For Docker, the host JSON path is mounted into the API container at /run/secrets/firebase-admin.json.',
      'Run fcm:token-smoke -- --dry-run first; it lists customer/Partner actors and config without contacting the API or FCM.',
      'Run fcm:token-smoke before live push smoke; it verifies customer/Partner token registration without contacting FCM.',
      'Run fcm:token-recovery-smoke after token registration changes; it verifies disabled-token re-enable and replacement-token behavior without contacting FCM.',
      'Run fcm:push-smoke -- --dry-run for merged config/readiness only; it does not contact the API or FCM.',
      'Run fcm:push-smoke -- --preflight to check API readiness, Firebase project alignment, notification availability, and registered device readiness without sending FCM.',
      'After a live fcm:push-smoke, rerun fcm:push-smoke -- --preflight and confirm retryAuditPreflight.evidence is HAS_PUSH_DEVICE_LAST_SEEN_AT before relying on stale-token decisions.',
      'If the latest Partner alert is blocked by notification.partner_alert_channel, FCM smoke auto-selects or suggests a standard-notification id instead of changing policy just for testing.',
      'Live push smoke needs either a real app FCM token or FCM_SMOKE_USE_REGISTERED_DEVICE=true after that same app session registers an enabled device.',
      'Use the notification board to separate credential or delivery failures, disabled tokens, stale tokens, and pending worker queue issues before retry.',
      'After fcm:push-smoke, review the FCM route, failed sends, disabled device, stale device, pending queue, operations handoff, and Notification audit evidence before enabling FCM push broadly.',
    ],
    commands: [
      FCM_EXTERNAL_CHECK_COMMAND,
      FCM_ENV_CONTRACT_COMMAND,
      FCM_PUSH_DATA_CONTRACT_COMMAND,
      FCM_CREDENTIALS_INSTALL_CHECK_COMMAND,
      FCM_CREDENTIALS_INSTALL_UPDATE_COMMAND,
      FCM_SECURITY_SECRETS_COMMAND,
      FCM_CREDENTIALS_CHECK_COMMAND,
      FCM_DOCKER_CONTRACT_COMMAND,
      FCM_TOKEN_SMOKE_DRY_RUN_COMMAND,
      FCM_TOKEN_RECOVERY_SMOKE_COMMAND,
      FCM_PUSH_SMOKE_DRY_RUN_COMMAND,
      FCM_PUSH_SMOKE_PREFLIGHT_COMMAND,
      '$env:FCM_SMOKE_ROLE="PROVIDER"; $env:FCM_SMOKE_PHONE="+84900000002"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; $env:FCM_SMOKE_NOTIFICATION_ID="<preflight suggested standard notification id>"; npm.cmd run fcm:push-smoke -- --preflight',
      FCM_TOKEN_SMOKE_COMMAND,
      '$env:FCM_SMOKE_ROLE="CUSTOMER"; $env:FCM_SMOKE_PHONE="+84900000001"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_DEVICE_TOKEN="<real app FCM token>"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; npm.cmd run fcm:push-smoke',
      '$env:FCM_SMOKE_ROLE="CUSTOMER"; $env:FCM_SMOKE_PHONE="+84900000001"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; npm.cmd run fcm:push-smoke',
      'Open http://localhost:3101/notifications?review=fcm',
      'Open http://localhost:3101/notifications?review=failed',
      'Open http://localhost:3101/notifications?review=disabled-device',
      'Open http://localhost:3101/notifications?review=stale-device',
      'Open http://localhost:3101/notifications?review=pending',
      'Open http://localhost:3101/operations-handoff',
      'Open http://localhost:3101/audit-log?bucket=Notification',
    ],
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
] satisfies readonly SetupOrderItem[];

export const externalRegistrationPlan = [
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
    detail:
      'Track FCM app config, server-side Firebase Admin credentials, token registration, and real-device delivery without exposing secrets.',
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
] satisfies readonly ExternalRegistrationPlanItem[];

export const projectControlSequence = [
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
] satisfies readonly ProjectControlStep[];

export const verifiedBaseline = [
  'API typecheck and build pass.',
  'Admin typecheck, build, and 53-page smoke pass.',
  'Customer Flutter analyze/test pass.',
  'Partner Flutter analyze/test pass.',
  'Firebase mobile scope guard passes with FCM-only usage.',
  'MapTiler and Geoapify checks pass.',
  'Supabase schema guard passes.',
  'Secret leak guard passes.',
] as const;
