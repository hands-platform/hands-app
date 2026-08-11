import { describe, expect, it } from 'vitest';

import {
  buildPartnerAccountControlRows,
  buildPartnerOperatorNoteRows,
  buildPartnerReportControlPayoutHold,
  buildPartnerReportRows,
} from './partner-detail-control-records-model';
import type { ProviderDetail } from './partner-detail-types';

describe('partner detail control records model', () => {
  it('keeps the six newest loaded operator notes with actor and target context', () => {
    const rows = buildPartnerOperatorNoteRows(
      Array.from({ length: 7 }, (_, index) => ({
        action: 'NOTE_ADDED',
        actor: index === 0 ? { fullName: 'Master Admin' } : null,
        createdAt: `2026-07-${String(27 - index).padStart(2, '0')}T10:00:00.000Z`,
        id: `log-${index + 1}`,
        metadata: { note: `Operator note ${index + 1}` },
        target: 'Partner profile',
      })) as never[],
    );

    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      actorTargetLabel: 'Master Admin / Partner profile',
      id: 'log-1',
      note: 'Operator note 1',
    });
    expect(rows[1]?.actorTargetLabel).toBe('System / Partner profile');
  });

  it('maps payout holds into compact report evidence', () => {
    expect(
      buildPartnerReportControlPayoutHold({
        expiresAt: '2026-07-30T00:00:00.000Z',
        id: 'payout-hold-long-id',
        reason: 'Identity review',
        startsAt: '2026-07-27T00:00:00.000Z',
        type: 'MANUAL',
      } as never),
    ).toMatchObject({
      reason: 'Identity review',
      type: 'MANUAL',
    });
    expect(buildPartnerReportControlPayoutHold(undefined)).toBeNull();
  });

  it('maps critical reports to account blocks and links booking evidence', () => {
    const rows = buildPartnerReportRows({
      id: 'partner-1',
      reports: [
        {
          bookingId: 'booking-1',
          category: 'SAFETY',
          createdAt: '2026-07-27T10:00:00.000Z',
          details: 'Safety evidence',
          id: 'report-1',
          resolutionNote: null,
          severity: 'CRITICAL',
          source: 'CUSTOMER',
          status: 'OPEN',
          summary: 'Customer safety report',
        },
        {
          bookingId: null,
          category: 'QUALITY',
          createdAt: '2026-07-27T11:00:00.000Z',
          details: null,
          id: 'report-2',
          resolutionNote: null,
          severity: 'MEDIUM',
          source: 'SYSTEM',
          status: 'OPEN',
          summary: 'Quality follow-up',
        },
      ],
    } as unknown as ProviderDetail);

    expect(rows[0]).toMatchObject({
      bookingHref: '/bookings/booking-1',
      defaultControlType: 'ACCOUNT_BLOCK',
    });
    expect(rows[1]).toMatchObject({
      bookingHref: undefined,
      defaultControlType: 'WARNING',
    });
  });

  it('only offers lift links for active account controls', () => {
    const rows = buildPartnerAccountControlRows({
      id: 'partner 1',
      sanctions: [
        {
          id: 'sanction active',
          reason: 'Open investigation',
          report: { category: 'SAFETY', severity: 'HIGH' },
          startsAt: '2026-07-27T10:00:00.000Z',
          status: 'ACTIVE',
          type: 'ACCOUNT_BLOCK',
        },
        {
          id: 'sanction lifted',
          reason: 'Resolved',
          startsAt: '2026-07-20T10:00:00.000Z',
          status: 'LIFTED',
          type: 'WARNING',
        },
      ],
    } as unknown as ProviderDetail);

    expect(rows[0]).toMatchObject({
      liftControlHref:
        '/partners/partner%201?controlAction=lift-control&sanctionId=sanction+active&control=records&section=control#reports',
      reportLine: 'Report: SAFETY / HIGH',
    });
    expect(rows[1]?.liftControlHref).toBeUndefined();
  });
});
