export const FCM_EXTERNAL_CHECK_COMMAND = 'npm.cmd run external:check:push';
export const FCM_ENV_CONTRACT_COMMAND = 'npm.cmd run fcm:env-contract';
export const FCM_PUSH_DATA_CONTRACT_COMMAND = 'npm.cmd run notifications:push-data-contract';
export const FCM_RETRY_AUDIT_CONTRACT_COMMAND = 'npm.cmd run notifications:retry-audit-contract';
export const FCM_CREDENTIALS_INSTALL_CHECK_COMMAND =
  'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -CheckOnly';
export const FCM_CREDENTIALS_INSTALL_UPDATE_COMMAND =
  'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -UpdateEnv';
export const FCM_SECURITY_SECRETS_COMMAND = 'npm.cmd run security:secrets';
export const FCM_CREDENTIALS_CHECK_COMMAND = 'npm.cmd run fcm:credentials-check';
export const FCM_DOCKER_CONTRACT_COMMAND = 'npm.cmd run docker:contract';
export const FCM_TOKEN_SMOKE_DRY_RUN_COMMAND = 'npm.cmd run fcm:token-smoke -- --dry-run';
export const FCM_TOKEN_RECOVERY_SMOKE_DRY_RUN_COMMAND =
  'npm.cmd run fcm:token-recovery-smoke -- --dry-run';
export const FCM_TOKEN_RECOVERY_SMOKE_COMMAND = 'npm.cmd run fcm:token-recovery-smoke';
export const FCM_PUSH_SMOKE_COMMAND = 'npm.cmd run fcm:push-smoke';
export const FCM_PUSH_SMOKE_DRY_RUN_COMMAND = 'npm.cmd run fcm:push-smoke -- --dry-run';
export const FCM_PUSH_SMOKE_PREFLIGHT_COMMAND = 'npm.cmd run fcm:push-smoke -- --preflight';
export const FCM_PUSH_SMOKE_PREFLIGHT_REUSE_COMMAND =
  'npm.cmd run fcm:push-smoke -- --preflight --use-registered-device';
export const FCM_TOKEN_SMOKE_COMMAND = 'npm.cmd run fcm:token-smoke';

type FcmSmokeRole = 'CUSTOMER' | 'PROVIDER';

type BuildFcmPushSmokeCommandOptions = {
  readonly deviceToken?: string;
  readonly expectedProvider?: string;
  readonly expectedStatus?: string;
  readonly notificationId?: string;
  readonly phone?: string;
  readonly platform?: string;
  readonly preflight?: boolean;
  readonly role?: FcmSmokeRole;
  readonly useRegisteredDevice?: boolean;
};

export function buildFcmPushSmokeCommand({
  deviceToken,
  expectedProvider = 'FCM',
  expectedStatus = 'SENT',
  notificationId,
  phone,
  platform,
  preflight = false,
  role,
  useRegisteredDevice = false,
}: BuildFcmPushSmokeCommandOptions) {
  return [
    role ? `$env:FCM_SMOKE_ROLE="${role}"` : null,
    phone ? `$env:FCM_SMOKE_PHONE="${phone}"` : null,
    platform ? `$env:FCM_SMOKE_PLATFORM="${platform}"` : null,
    useRegisteredDevice ? '$env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"' : null,
    deviceToken ? `$env:FCM_SMOKE_DEVICE_TOKEN="${deviceToken}"` : null,
    expectedProvider ? `$env:FCM_SMOKE_EXPECT_PROVIDER="${expectedProvider}"` : null,
    expectedStatus ? `$env:FCM_SMOKE_EXPECT_STATUS="${expectedStatus}"` : null,
    notificationId ? `$env:FCM_SMOKE_NOTIFICATION_ID="${notificationId}"` : null,
    preflight ? FCM_PUSH_SMOKE_PREFLIGHT_COMMAND : FCM_PUSH_SMOKE_COMMAND,
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

export const FCM_PROVIDER_SUGGESTED_NOTIFICATION_PREFLIGHT_COMMAND = buildFcmPushSmokeCommand({
  notificationId: '<preflight suggested standard notification id>',
  phone: '+84900000002',
  platform: 'android',
  preflight: true,
  role: 'PROVIDER',
  useRegisteredDevice: true,
});

export const FCM_CUSTOMER_LIVE_TOKEN_SMOKE_COMMAND = buildFcmPushSmokeCommand({
  deviceToken: '<real app FCM token>',
  phone: '+84900000001',
  platform: 'android',
  role: 'CUSTOMER',
});

export const FCM_CUSTOMER_LIVE_REGISTERED_DEVICE_SMOKE_COMMAND = buildFcmPushSmokeCommand({
  phone: '+84900000001',
  platform: 'android',
  role: 'CUSTOMER',
  useRegisteredDevice: true,
});

export const FCM_NOTIFICATION_REVIEW_COMMANDS = [
  'Open http://localhost:3101/notifications?review=fcm',
  'Open http://localhost:3101/notifications?review=failed',
  'Open http://localhost:3101/notifications?review=disabled-device',
  'Open http://localhost:3101/notifications?review=stale-device',
  'Open http://localhost:3101/notifications?review=unattempted',
] as const;

export const FCM_OPERATIONS_HANDOFF_COMMAND = 'Open http://localhost:3101/operations-handoff';
export const FCM_NOTIFICATION_AUDIT_COMMAND =
  'Open http://localhost:3101/audit-log?bucket=Notification';

export const FCM_SETUP_REVIEW_COMMANDS = [
  ...FCM_NOTIFICATION_REVIEW_COMMANDS,
  FCM_OPERATIONS_HANDOFF_COMMAND,
  FCM_NOTIFICATION_AUDIT_COMMAND,
] as const;

export function isFcmSetupReviewCommand(command: string) {
  return (FCM_SETUP_REVIEW_COMMANDS as readonly string[]).includes(command);
}

export const FCM_SETUP_READINESS_COMMANDS = [
  FCM_EXTERNAL_CHECK_COMMAND,
  FCM_ENV_CONTRACT_COMMAND,
  FCM_PUSH_DATA_CONTRACT_COMMAND,
  FCM_RETRY_AUDIT_CONTRACT_COMMAND,
  FCM_CREDENTIALS_INSTALL_CHECK_COMMAND,
  FCM_SECURITY_SECRETS_COMMAND,
  FCM_CREDENTIALS_CHECK_COMMAND,
  FCM_DOCKER_CONTRACT_COMMAND,
  FCM_TOKEN_SMOKE_DRY_RUN_COMMAND,
  FCM_TOKEN_RECOVERY_SMOKE_DRY_RUN_COMMAND,
  FCM_TOKEN_RECOVERY_SMOKE_COMMAND,
  FCM_PUSH_SMOKE_DRY_RUN_COMMAND,
  FCM_PUSH_SMOKE_PREFLIGHT_COMMAND,
  FCM_PUSH_SMOKE_PREFLIGHT_REUSE_COMMAND,
] as const;
