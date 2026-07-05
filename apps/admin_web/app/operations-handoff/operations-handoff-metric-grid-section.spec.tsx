import { readFileSync } from 'node:fs';

import { OperationsHandoffMetricGridSection } from './operations-handoff-metric-grid-section';
import { hrefsIn, textContent } from './operations-handoff-section-test-utils';

const source = readFileSync(new URL('./operations-handoff-metric-grid-section.tsx', import.meta.url), 'utf8');

describe('OperationsHandoffMetricGridSection', () => {
  it('renders operations handoff metric links and visible counts', () => {
    const section = OperationsHandoffMetricGridSection({
      activeBookingCount: 4,
      matchingBookingCount: 2,
      inServiceBookingCount: 1,
      cashSummary: {
        generatedAt: new Date(0).toISOString(),
        currency: 'VND',
        rowCount: 1,
        providerCount: 3,
        totalDebtAmount: 125000,
        totalCompanyCouponOffset: 0,
        totalPlatformFee: 0,
        totalTaxAmount: 0,
        oldestOpenAt: null,
        oldestOpenAgeMinutes: 0,
        staleDebtRowCount: 0,
        highDebtProviderCount: 0,
        missingPaymentEvidenceCount: 0,
        cashPaymentRowCount: 0,
        topProviderGroups: [],
      },
      presence: {
        customerLive: 5,
        customerRecent: 8,
        partnerLive: 6,
        partnerRecent: 9,
      },
      chatSignals: {
        roomCount: 7,
        recentMessageCount: 10,
      },
      failedNotificationCount: 11,
      latestFcmSent: {
        helper: 'Partner +84900000002 / android / Booking Matched notifica / device push-dev',
        href: '/notifications?review=fcm#notification-1',
        value: '13 Jun 2026, 17:09',
      },
    });

    const rendered = textContent(section);
    const hrefs = hrefsIn(section);

    expect(section.type.name).toBe('AdminMetricGrid');
    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Cash fee debt');
    expect(rendered).toContain('125.000 VND');
    expect(rendered).toContain('across Partner wallet gates');
    expect(rendered).toContain('11');
    expect(rendered).toContain('Recent FCM sent');
    expect(rendered).toContain('13 Jun 2026, 17:09');
    expect(rendered).toContain('Partner +84900000002 / android / Booking Matched notifica / device push-dev');
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/bookings?view=attention',
        '/bookings?view=matching',
        '/bookings?view=closeout',
        '/cash-settlements',
        '/notifications?review=failed',
        '/notifications?review=fcm#notification-1',
      ]),
    );
  });

  it('renders the FCM empty state when no sent delivery is available', () => {
    const section = OperationsHandoffMetricGridSection({
      activeBookingCount: 0,
      matchingBookingCount: 0,
      inServiceBookingCount: 0,
      cashSummary: {
        generatedAt: new Date(0).toISOString(),
        currency: 'VND',
        rowCount: 0,
        providerCount: 0,
        totalDebtAmount: 0,
        totalCompanyCouponOffset: 0,
        totalPlatformFee: 0,
        totalTaxAmount: 0,
        oldestOpenAt: null,
        oldestOpenAgeMinutes: 0,
        staleDebtRowCount: 0,
        highDebtProviderCount: 0,
        missingPaymentEvidenceCount: 0,
        cashPaymentRowCount: 0,
        topProviderGroups: [],
      },
      presence: {
        customerLive: 0,
        customerRecent: 0,
        partnerLive: 0,
        partnerRecent: 0,
      },
      chatSignals: {
        roomCount: 0,
        recentMessageCount: 0,
      },
      failedNotificationCount: 0,
      latestFcmSent: null,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Recent FCM sent');
    expect(rendered).toContain('No send');
    expect(rendered).toContain('No FCM SENT delivery recorded yet');
  });

  it('uses the shared money atom for cash debt helper amounts', () => {
    expect(source).toContain('AdminMetricGrid');
    expect(source).not.toContain('<section className="grid admin-mt-16 admin-mb-16"');
    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('helper={`${formatMoney(cashSummary.totalDebtAmount, cashSummary.currency)} across Partner wallet gates`}');
  });
});
