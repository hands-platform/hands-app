import { readFileSync } from 'node:fs';
import type { AdminServiceCatalogItem } from '../../lib/admin-api';
import type { ServiceBookingTraceRow } from '../../lib/service-booking-trace-rows';
import { ServiceBookingFinanceTraceSection } from './service-booking-finance-trace-section';

describe('ServiceBookingFinanceTraceSection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/services/service-booking-finance-trace-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<p className="muted">No recent booking service rows were found');
    expect(source).not.toContain('<span className="pill pill-warn">No payment</span>');
    expect(source).not.toContain('<span className="pill pill-warn">No earning</span>');
    expect(source).not.toContain('<span className={`pill ${row.traceTone}`}>{row.traceStatus}</span>');
  });

  it('uses shared money atoms for service booking finance trace amounts', () => {
    const source = readFileSync('app/services/service-booking-finance-trace-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<div className="service-trace-summary">');
  });

  it('uses the shared Vuexy text link atom for booking drill-down links', () => {
    const source = readFileSync('app/services/service-booking-finance-trace-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders finance trace summary and booking rows', () => {
    const section = ServiceBookingFinanceTraceSection({
      rows: [traceRowFixture()],
      summary: {
        currency: 'VND',
        missingTraceCount: 0,
        paymentAmount: 500000,
        platformFeeAmount: 50000,
        providerNetAmount: 350000,
        walletAmount: 350000,
        withholdingAmount: 25000,
      },
    });

    const rendered = JSON.stringify(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      className: 'admin-mb-16',
      scrollable: true,
      statusLabel: '1 trace row(s)',
      statusTone: 'info',
      title: 'Recent booking finance trace',
    });
    expect(rendered).toContain('Recent booking finance trace');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('Open booking');
    expect(rendered).toContain('Complete');
  });

  it('renders the empty trace state', () => {
    const section = ServiceBookingFinanceTraceSection({
      rows: [],
      summary: {
        currency: 'VND',
        missingTraceCount: 0,
        paymentAmount: 0,
        platformFeeAmount: 0,
        providerNetAmount: 0,
        walletAmount: 0,
        withholdingAmount: 0,
      },
    });

    expect(JSON.stringify(section)).toContain('No recent booking service rows were found');
  });
});

function traceRowFixture(): ServiceBookingTraceRow {
  const service = serviceFixture();
  const booking = {
    createdAt: '2026-06-09T10:00:00.000Z',
    earning: {
      currency: 'VND',
      grossAmount: 400000,
      id: 'earning-1',
      netAmount: 350000,
      platformFee: 50000,
      status: 'AVAILABLE',
      withholdingAmount: 25000,
    },
    id: 'booking-1234567890',
    payment: {
      amount: 500000,
      currency: 'VND',
      method: 'CASH',
      status: 'PAID',
    },
    platformFeeLogs: [
      {
        currency: 'VND',
        id: 'fee-log-1',
        platformFeeAmount: 50000,
      },
    ],
    selectedProviderId: 'partner-1',
    status: 'COMPLETED',
    taxLogs: [
      {
        currency: 'VND',
        id: 'tax-log-1',
        taxableAmount: 500000,
        withholdingAmount: 25000,
      },
    ],
    walletLedgerEntries: [
      {
        amount: 350000,
        currency: 'VND',
        id: 'wallet-1',
        type: 'CREDIT',
      },
    ],
  };

  return {
    booking,
    bookingService: {
      booking,
      bookingId: booking.id,
      id: 'booking-service-1',
      price: 500000,
      quantity: 1,
      serviceId: service.id,
    },
    currency: 'VND',
    platformFeeAmount: 50000,
    platformFeeLogCount: 1,
    service,
    taxLogCount: 1,
    taxWithheldAmount: 25000,
    traceStatus: 'Complete',
    traceTone: 'pill-success',
    walletAmount: 350000,
    walletEntryCount: 1,
  };
}

function serviceFixture(): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice: 500000,
    displayOrder: 0,
    durationMin: 60,
    id: 'service-1',
    name: 'Foot Massage',
    priceStep: 100000,
  };
}
