import { BadRequestException } from '@nestjs/common';
import {
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionType,
} from '@prisma/client';

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
