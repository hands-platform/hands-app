export type BackupNotificationTraceStage = 'initial_open' | 'first_pick_declined';

export type BackupAlertPolicyInput = {
  backupProviderRadiusMeters: number;
  backupOpenMode: string;
  backupProviderInvitationLimit: number;
};

export type BackupNotificationProviderTrace = {
  providerProfileId: string;
  userId: string;
  distanceMeters: number;
  notificationId: string;
};

export type BackupNotificationTrace = ReturnType<typeof backupNotificationTrace>;

export function backupAlertPolicyMetadata(input: BackupAlertPolicyInput) {
  return {
    marketplaceRadiusMeters: input.backupProviderRadiusMeters,
    marketplaceOpenMode: input.backupOpenMode,
    marketplaceInvitationLimit: input.backupProviderInvitationLimit,
    backupProviderRadiusMeters: input.backupProviderRadiusMeters,
    backupOpenMode: input.backupOpenMode,
    backupProviderInvitationLimit: input.backupProviderInvitationLimit,
  };
}

export function backupNotificationTrace(input: {
  stage: BackupNotificationTraceStage;
  alertPolicy: ReturnType<typeof backupAlertPolicyMetadata>;
  notifiedProviders: BackupNotificationProviderTrace[];
  websocketTargetCount: number;
  createdAt?: Date;
}) {
  return {
    stage: input.stage,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    notifiedCount: input.notifiedProviders.length,
    ...input.alertPolicy,
    websocketTargetCount: input.websocketTargetCount,
    providers: input.notifiedProviders,
  };
}

export function appendBackupNotificationTrace(
  metadata: unknown,
  trace: BackupNotificationTrace,
  limit = 12,
) {
  const record = readPlainRecord(metadata) ?? {};
  const existingTraces = Array.isArray(record.backupNotificationTraces)
    ? record.backupNotificationTraces
    : [];

  return {
    ...record,
    backupNotificationTraces: [...existingTraces, trace].slice(-limit),
  };
}

function readPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
