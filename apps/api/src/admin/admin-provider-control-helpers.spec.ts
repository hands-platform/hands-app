import { BadRequestException } from '@nestjs/common';
import {
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionType,
} from '@prisma/client';
import {
  assertProviderReportSeverity,
  assertProviderReportSource,
  assertProviderReportStatus,
  assertProviderSanctionType,
  providerReportResolvedAt,
} from './admin-provider-control-helpers';

describe('admin provider control helpers', () => {
  it('accepts valid provider report and sanction enum values', () => {
    expect(() => assertProviderReportSource(ProviderReportSource.ADMIN)).not.toThrow();
    expect(() => assertProviderReportSeverity(ProviderReportSeverity.MEDIUM)).not.toThrow();
    expect(() => assertProviderReportStatus(ProviderReportStatus.OPEN)).not.toThrow();
    expect(() => assertProviderSanctionType(ProviderSanctionType.WARNING)).not.toThrow();
  });

  it('rejects invalid provider report and sanction enum values defensively', () => {
    expect(() => assertProviderReportSource('INVALID' as ProviderReportSource)).toThrow(
      BadRequestException,
    );
    expect(() => assertProviderReportSeverity('INVALID' as ProviderReportSeverity)).toThrow(
      BadRequestException,
    );
    expect(() => assertProviderReportStatus('INVALID' as ProviderReportStatus)).toThrow(
      BadRequestException,
    );
    expect(() => assertProviderSanctionType('INVALID' as ProviderSanctionType)).toThrow(
      BadRequestException,
    );
  });

  it('maps report statuses to resolvedAt updates', () => {
    const now = new Date('2026-06-11T00:00:00.000Z');
    expect(providerReportResolvedAt(ProviderReportStatus.RESOLVED, now)).toBe(now);
    expect(providerReportResolvedAt(ProviderReportStatus.DISMISSED, now)).toBe(now);
    expect(providerReportResolvedAt(ProviderReportStatus.OPEN, now)).toBeNull();
    expect(providerReportResolvedAt(ProviderReportStatus.INVESTIGATING, now)).toBeNull();
    expect(providerReportResolvedAt(undefined, now)).toBeUndefined();
  });
});
