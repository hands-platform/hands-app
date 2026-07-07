import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { bookingCloseoutReadiness } from './booking-closeout-readiness';
import { bookingDetailDecisionReadiness } from './booking-detail-decision-readiness';
import type { bookingFinanceTrace } from './booking-finance-trace';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-decision-readiness',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    providerProfileId: 'partner-selected',
    recordedAt: '2026-06-14T01:10:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function closeoutReadiness(
  input: Partial<ReturnType<typeof bookingCloseoutReadiness>> = {},
): ReturnType<typeof bookingCloseoutReadiness> {
  return {
    helper: 'Ready after evidence review.',
    openItems: [],
    status: 'Ready',
    tone: 'pill-success',
    ...input,
  } as ReturnType<typeof bookingCloseoutReadiness>;
}

function financeTrace(
  input: Partial<ReturnType<typeof bookingFinanceTrace>> = {},
): ReturnType<typeof bookingFinanceTrace> {
  return {
    platformFee: '120.000 VND logged',
    providerPayout: '330.000 VND',
    walletLedger: 'No entry',
    withholding: '20.000 VND',
    ...input,
  } as ReturnType<typeof bookingFinanceTrace>;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    cashFeeDebtNeedsSettlement: false,
    closeoutReadiness: closeoutReadiness(),
    closureStatus: 'Matched',
    financeTrace: financeTrace(),
    latestLocation: location(),
    messageCount: 2,
    notificationCount: 1,
    operatorNoteCount: 1,
    refundEvidence: 'No refund row',
    refundRowCount: 0,
  };
}

describe('bookingDetailDecisionReadiness', () => {
  it('maps retained booking evidence into ready manual decision and guardrail rows', () => {
    const result = bookingDetailDecisionReadiness(
      baseInput(
        booking({
          addressSnapshot: {
            addressText: 'District service address',
            latitude: 10.762622,
            longitude: 106.660172,
          } as AdminBookingDetail['addressSnapshot'],
          auditLogs: [{ id: 'audit-1' }] as AdminBookingDetail['auditLogs'],
          chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
          payment: {
            amount: 450000,
            currency: 'VND',
            method: 'CARD',
            status: 'AUTHORIZED',
          } as AdminBookingDetail['payment'],
          selectedProvider: {
            id: 'partner-selected',
            displayName: 'Selected Partner',
          } as AdminBookingDetail['selectedProvider'],
          selectedProviderId: 'partner-selected',
        }),
      ),
    );

    expect(result.manualDecisionReadiness.find((row) => row.lane === 'Customer cancellation or closure')).toMatchObject({
      status: 'Evidence ready',
      tone: 'pill-success',
    });
    expect(result.decisionEvidenceGuardrails.find((row) => row.id === 'required-address')).toMatchObject({
      evidence: 'District service address / confirmed service address saved',
      status: 'Ready',
      tone: 'pill-success',
    });
    expect(JSON.stringify(result)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
    expect(result.decisionEvidenceGuardrails.find((row) => row.id === 'required-final-partner')).toMatchObject({
      evidence: 'Selected Partner',
      status: 'Final Partner saved',
    });
    expect(JSON.stringify(result.decisionEvidenceGuardrails)).not.toMatch(/\bsnapshot\b|archive/i);
    expect(result.decisionEvidenceGuardrails.find((row) => row.id === 'supporting-context')).toMatchObject({
      evidence: '14 Jun 2026, 08:10',
      evidenceDateTimePrefix: '2 message(s) / location ',
      evidenceDateTimeSuffix: ' / 1 alert row(s) / 1 note(s)',
      evidenceDateTimeValue: '2026-06-14T01:10:00.000Z',
    });
  });

  it('keeps cash fee debt, missing context, and closeout blockers visible', () => {
    const result = bookingDetailDecisionReadiness({
      ...baseInput(
        booking({
          earning: {
            currency: 'VND',
            netAmount: -120000,
            status: 'PENDING',
          } as AdminBookingDetail['earning'],
          payment: {
            amount: 450000,
            currency: 'VND',
            method: 'CASH',
            status: 'PAID',
          } as AdminBookingDetail['payment'],
          status: 'COMPLETED',
        }),
      ),
      cashFeeDebtNeedsSettlement: true,
      closeoutReadiness: closeoutReadiness({
        helper: 'Cash settlement remains open.',
        openItems: [
          {
            detail: 'Cash fee settlement required.',
            href: '#finance',
            id: 'cash-settlement',
            label: 'Cash',
            owner: 'Finance',
            ready: false,
            status: 'Cash fee settlement required',
          },
        ],
        status: '1 closeout item(s)',
        tone: 'pill-warn',
      }),
      financeTrace: financeTrace({ walletLedger: '-120.000 VND / 1 entry' }),
      latestLocation: null,
      messageCount: 0,
      notificationCount: 0,
      operatorNoteCount: 0,
    });

    expect(result.manualDecisionReadiness.find((row) => row.lane === 'Cash fee settlement')).toMatchObject({
      evidence: 'Debt 120.000 VND',
      status: 'Settlement required',
      tone: 'pill-danger',
    });
    expect(result.decisionEvidenceGuardrails.find((row) => row.id === 'supporting-context')).toMatchObject({
      evidence: '0 message(s) / no Partner pin / 0 alert row(s) / 0 note(s)',
      status: 'Needs factual note',
      tone: 'pill-warn',
    });
    expect(result.decisionEvidenceGuardrails.find((row) => row.id === 'finance-cash-debt')).toMatchObject({
      status: 'Settlement required',
      tone: 'pill-danger',
    });
  });
});
