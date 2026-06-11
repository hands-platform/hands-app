import { BadRequestException } from '@nestjs/common';
import {
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
