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
  normalizeProviderReportCreateInput,
  normalizeProviderReportUpdateInput,
  normalizeProviderSanctionCreateInput,
  providerReportCreateAuditMetadata,
  providerReportResolvedAt,
  providerSanctionCreateAuditMetadata,
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

  it('normalizes provider report create input with defaults', () => {
    expect(
      normalizeProviderReportCreateInput({
        providerProfileId: ' provider-1 ',
        bookingId: ' booking-1 ',
        category: ' conduct ',
        summary: ' arrived late ',
      }),
    ).toEqual({
      providerProfileId: 'provider-1',
      bookingId: 'booking-1',
      source: ProviderReportSource.ADMIN,
      severity: ProviderReportSeverity.MEDIUM,
      category: 'conduct',
      summary: 'arrived late',
      details: null,
    });
  });

  it('rejects incomplete provider report create input', () => {
    expect(() =>
      normalizeProviderReportCreateInput({ providerProfileId: 'provider-1', summary: 'missing category' }),
    ).toThrow(BadRequestException);
  });

  it('normalizes provider report update input and audit metadata', () => {
    const normalized = normalizeProviderReportUpdateInput({
      status: ProviderReportStatus.RESOLVED,
      severity: ProviderReportSeverity.HIGH,
      resolutionNote: '  resolved with evidence  ',
    });

    expect(normalized.data).toMatchObject({
      status: ProviderReportStatus.RESOLVED,
      severity: ProviderReportSeverity.HIGH,
      resolutionNote: 'resolved with evidence',
    });
    expect(normalized.data.resolvedAt).toBeInstanceOf(Date);
    expect(normalized.auditMetadata).toEqual({
      status: ProviderReportStatus.RESOLVED,
      severity: ProviderReportSeverity.HIGH,
      resolutionNote: 'resolved with evidence',
    });
  });

  it('normalizes provider sanction create input with defaults', () => {
    expect(
      normalizeProviderSanctionCreateInput({
        reason: '  policy violation  ',
        reportId: ' report-1 ',
      }),
    ).toEqual({
      type: ProviderSanctionType.WARNING,
      reason: 'policy violation',
      reportId: 'report-1',
      expiresAt: null,
    });
  });

  it('builds provider control audit metadata', () => {
    expect(
      providerReportCreateAuditMetadata({
        providerProfileId: 'provider-1',
        category: 'conduct',
        severity: ProviderReportSeverity.MEDIUM,
      }),
    ).toEqual({
      providerProfileId: 'provider-1',
      category: 'conduct',
      severity: ProviderReportSeverity.MEDIUM,
    });
    expect(
      providerSanctionCreateAuditMetadata({
        providerProfileId: 'provider-1',
        reportId: null,
        type: ProviderSanctionType.WARNING,
      }),
    ).toEqual({
      providerProfileId: 'provider-1',
      reportId: null,
      type: ProviderSanctionType.WARNING,
    });
  });
});
