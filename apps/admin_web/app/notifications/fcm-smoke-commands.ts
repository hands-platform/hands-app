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
export const FCM_TOKEN_RECOVERY_SMOKE_COMMAND = 'npm.cmd run fcm:token-recovery-smoke';
export const FCM_PUSH_SMOKE_DRY_RUN_COMMAND = 'npm.cmd run fcm:push-smoke -- --dry-run';
export const FCM_PUSH_SMOKE_PREFLIGHT_COMMAND = 'npm.cmd run fcm:push-smoke -- --preflight';
export const FCM_TOKEN_SMOKE_COMMAND = 'npm.cmd run fcm:token-smoke';

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
  FCM_TOKEN_RECOVERY_SMOKE_COMMAND,
  FCM_PUSH_SMOKE_DRY_RUN_COMMAND,
  FCM_PUSH_SMOKE_PREFLIGHT_COMMAND,
] as const;
