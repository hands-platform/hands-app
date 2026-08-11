import { BadRequestException } from '@nestjs/common';
import {
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionType,
  Role,
} from '@prisma/client';
import {
  assertProviderReportSeverity,
  assertProviderReportSource,
  assertProviderReportStatus,
  assertProviderSanctionType,
  normalizeProviderAccountBlockReason,
  normalizeProviderReportCreateInput,
  normalizeProviderReportUpdateInput,
  normalizeProviderSanctionCreateInput,
  normalizeProviderSanctionLiftInput,
  providerAccountBlockAuditMetadata,
  providerAccountBlockedNotification,
  providerAccountUnblockAuditMetadata,
  providerAccountUnblockedNotification,
  providerReportCreateAuditMetadata,
  providerReportResolvedAt,
  providerSanctionCreateAuditMetadata,
  providerSanctionLiftMetadata,
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

  it.each([ProviderReportStatus.RESOLVED, ProviderReportStatus.DISMISSED])(
    'requires a resolution note when closing a report as %s',
    (status) => {
      expect(() => normalizeProviderReportUpdateInput({ status, resolutionNote: '   ' })).toThrow(
        'Resolution note is required when closing a report',
      );
    },
  );

  it('does not require a resolution note while a report remains open', () => {
    expect(normalizeProviderReportUpdateInput({ status: ProviderReportStatus.INVESTIGATING })).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProviderReportStatus.INVESTIGATING,
          resolutionNote: null,
        }),
      }),
    );
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

  it('requires and trims meaningful sanction lift evidence', () => {
    expect(normalizeProviderSanctionLiftInput({ reason: '  Partner debt settled in full  ' })).toEqual({
      reason: 'Partner debt settled in full',
    });
    expect(() => normalizeProviderSanctionLiftInput({ reason: '   ' })).toThrow(
      'Lift reason and evidence is required',
    );
    expect(() => normalizeProviderSanctionLiftInput({ reason: 'too short' })).toThrow(
      'Lift reason must be at least 12 characters',
    );
    expect(() => normalizeProviderSanctionLiftInput({ reason: 'x'.repeat(501) })).toThrow(
      'Lift reason must be at most 500 characters',
    );
  });

  it('preserves sanction metadata when recording lift evidence', () => {
    expect(providerSanctionLiftMetadata({ source: 'partner-controls' }, 'Debt was reconciled')).toEqual({
      source: 'partner-controls',
      liftReason: 'Debt was reconciled',
    });
  });

  it('builds provider control audit metadata', () => {
    expect(providerAccountBlockAuditMetadata('provider-1', 'manual review')).toEqual({
      providerProfileId: 'provider-1',
      reason: 'manual review',
    });
    expect(providerAccountUnblockAuditMetadata('provider-1')).toEqual({
      providerProfileId: 'provider-1',
    });
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

  it('normalizes account block reason and rejects blank reasons', () => {
    expect(normalizeProviderAccountBlockReason('  manual review  ')).toBe('manual review');
    expect(() => normalizeProviderAccountBlockReason('   ')).toThrow(BadRequestException);
  });

  it('builds account control notification payloads', () => {
    expect(providerAccountBlockedNotification('provider-1', 'manual review')).toEqual({
      targetRole: Role.PROVIDER,
      type: 'provider.account.blocked',
      title: 'Partner account blocked',
      body: 'Your HANDS partner account is under admin review. Open the app for details.',
      data: { providerProfileId: 'provider-1', reason: 'manual review' },
    });
    expect(providerAccountUnblockedNotification('provider-1')).toEqual({
      targetRole: Role.PROVIDER,
      type: 'provider.account.unblocked',
      title: 'Partner account unblocked',
      body: 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.',
      data: { providerProfileId: 'provider-1' },
    });
    expect(providerAccountUnblockedNotification('provider-1', 'sanction-1').data).toEqual({
      providerProfileId: 'provider-1',
      sanctionId: 'sanction-1',
    });
  });
});
