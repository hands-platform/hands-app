import { BadRequestException } from '@nestjs/common';
import {
  Role,
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionType,
} from '@prisma/client';
import { normalizeNullable } from './admin-text-helpers';

export type ProviderReportCreateInput = {
  providerProfileId?: string;
  bookingId?: string | null;
  source?: ProviderReportSource;
  severity?: ProviderReportSeverity;
  category?: string;
  summary?: string;
  details?: string | null;
};

export type ProviderReportUpdateInput = {
  status?: ProviderReportStatus;
  severity?: ProviderReportSeverity;
  resolutionNote?: string | null;
};

export type ProviderSanctionCreateInput = {
  type?: ProviderSanctionType;
  reason?: string;
  reportId?: string | null;
  expiresAt?: string | null;
};

export type ProviderSanctionLiftInput = {
  reason?: string;
};

const PROVIDER_SANCTION_REASON_MIN_LENGTH = 12;
const PROVIDER_SANCTION_REASON_MAX_LENGTH = 500;

function assertEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: T[keyof T] | undefined,
  message: string,
) {
  if (value && !Object.values(enumObject).includes(value)) {
    throw new BadRequestException(message);
  }
}

export function assertProviderReportSource(source: ProviderReportSource | undefined) {
  assertEnumValue(ProviderReportSource, source, 'Invalid report source');
}

export function assertProviderReportSeverity(severity: ProviderReportSeverity | undefined) {
  assertEnumValue(ProviderReportSeverity, severity, 'Invalid report severity');
}

export function assertProviderReportStatus(status: ProviderReportStatus | undefined) {
  assertEnumValue(ProviderReportStatus, status, 'Invalid report status');
}

export function assertProviderSanctionType(type: ProviderSanctionType | undefined) {
  assertEnumValue(ProviderSanctionType, type, 'Invalid sanction type');
}

export function providerReportResolvedAt(status: ProviderReportStatus | undefined, now = new Date()) {
  if (status === ProviderReportStatus.RESOLVED || status === ProviderReportStatus.DISMISSED) {
    return now;
  }
  if (status === ProviderReportStatus.OPEN || status === ProviderReportStatus.INVESTIGATING) {
    return null;
  }
  return undefined;
}

export function normalizeProviderReportCreateInput(input: ProviderReportCreateInput) {
  const providerProfileId = normalizeNullable(input.providerProfileId);
  const category = normalizeNullable(input.category);
  const summary = normalizeNullable(input.summary);
  if (!providerProfileId) throw new BadRequestException('providerProfileId is required');
  if (!category) throw new BadRequestException('Report category is required');
  if (!summary) throw new BadRequestException('Report summary is required');
  assertProviderReportSource(input.source);
  assertProviderReportSeverity(input.severity);

  return {
    providerProfileId,
    bookingId: normalizeNullable(input.bookingId),
    source: input.source ?? ProviderReportSource.ADMIN,
    severity: input.severity ?? ProviderReportSeverity.MEDIUM,
    category,
    summary,
    details: normalizeNullable(input.details),
  };
}

export function normalizeProviderReportUpdateInput(input: ProviderReportUpdateInput) {
  assertProviderReportStatus(input.status);
  assertProviderReportSeverity(input.severity);
  const resolutionNote = normalizeNullable(input.resolutionNote);
  if (
    (input.status === ProviderReportStatus.RESOLVED || input.status === ProviderReportStatus.DISMISSED) &&
    !resolutionNote
  ) {
    throw new BadRequestException('Resolution note is required when closing a report');
  }
  return {
    data: {
      status: input.status,
      severity: input.severity,
      resolutionNote,
      resolvedAt: providerReportResolvedAt(input.status),
    },
    auditMetadata: {
      status: input.status,
      severity: input.severity,
      resolutionNote,
    },
  };
}

export function normalizeProviderSanctionCreateInput(input: ProviderSanctionCreateInput) {
  const reason = normalizeNullable(input.reason);
  if (!reason) throw new BadRequestException('Sanction reason is required');
  assertProviderSanctionType(input.type);
  return {
    type: input.type ?? ProviderSanctionType.WARNING,
    reason,
    reportId: normalizeNullable(input.reportId),
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  };
}

export function normalizeProviderSanctionLiftInput(input: ProviderSanctionLiftInput) {
  const reason = normalizeNullable(input.reason);
  if (!reason) throw new BadRequestException('Lift reason and evidence is required');
  if (reason.length < PROVIDER_SANCTION_REASON_MIN_LENGTH) {
    throw new BadRequestException(
      `Lift reason must be at least ${PROVIDER_SANCTION_REASON_MIN_LENGTH} characters`,
    );
  }
  if (reason.length > PROVIDER_SANCTION_REASON_MAX_LENGTH) {
    throw new BadRequestException(
      `Lift reason must be at most ${PROVIDER_SANCTION_REASON_MAX_LENGTH} characters`,
    );
  }
  return { reason };
}

export function providerSanctionLiftMetadata(metadata: unknown, reason: string) {
  const existing =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...existing, liftReason: reason };
}

export function normalizeProviderAccountBlockReason(reason?: string) {
  const blockReason = normalizeNullable(reason);
  if (!blockReason) {
    throw new BadRequestException('Block reason is required');
  }
  return blockReason;
}

export function providerReportCreateAuditMetadata(input: {
  providerProfileId: string;
  category: string;
  severity: ProviderReportSeverity;
}) {
  return {
    providerProfileId: input.providerProfileId,
    category: input.category,
    severity: input.severity,
  };
}

export function providerSanctionCreateAuditMetadata(input: {
  providerProfileId: string;
  reportId: string | null;
  type: ProviderSanctionType;
}) {
  return {
    providerProfileId: input.providerProfileId,
    reportId: input.reportId,
    type: input.type,
  };
}

export function providerAccountBlockAuditMetadata(providerProfileId: string, reason: string) {
  return { providerProfileId, reason };
}

export function providerAccountUnblockAuditMetadata(providerProfileId: string) {
  return { providerProfileId };
}

export function providerAccountBlockedNotification(providerProfileId: string, reason: string) {
  return {
    targetRole: Role.PROVIDER,
    type: 'provider.account.blocked',
    title: 'Partner account blocked',
    body: 'Your HANDS partner account is under admin review. Open the app for details.',
    data: { providerProfileId, reason },
  };
}

export function providerAccountUnblockedNotification(providerProfileId: string, sanctionId?: string) {
  return {
    targetRole: Role.PROVIDER,
    type: 'provider.account.unblocked',
    title: 'Partner account unblocked',
    body: 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.',
    data: sanctionId ? { providerProfileId, sanctionId } : { providerProfileId },
  };
}
