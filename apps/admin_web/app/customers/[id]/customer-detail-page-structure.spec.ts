import { readFileSync } from 'fs';
import { join } from 'path';

describe('customer detail page structure', () => {
  it('keeps the customer detail page focused on overview and booking operation lists', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/customers/[id]/page.tsx'), 'utf8');

    expect(pageSource).toContain('Customer operating picture');
    expect(pageSource).toContain('CustomerBookingOperationBoard');
    expect(pageSource).toContain('Booking and cancellation history');
    expect(pageSource).toContain('customer-booking-history-section');
    expect(pageSource).toContain('customer-chat-retention-section');
    expect(pageSource).toContain('customer-booking-ops-ledger-section');
    expect(pageSource).toContain('customer-chat-history-section');
    expect(pageSource).toContain('bookingHistoryPage');
    expect(pageSource).toContain('chatRetentionPage');
    expect(pageSource).toContain('bookingOpsLedgerPage');
    expect(pageSource).toContain('chatHistoryPage');
    expect(pageSource).toContain('AdminRoundedPagination');
    expect(pageSource).toContain('customerOperatorCommandQueue.commands.map');

    const operatingBandStart = pageSource.indexOf('title="Customer operating picture"');
    const bookingBoardStart = pageSource.indexOf('<CustomerBookingOperationBoard');
    const accountBandStart = pageSource.indexOf('title="Customer account and balance"');
    expect(operatingBandStart).toBeGreaterThan(-1);
    expect(bookingBoardStart).toBeGreaterThan(operatingBandStart);
    expect(accountBandStart).toBeGreaterThan(bookingBoardStart);
    expect(pageSource.slice(operatingBandStart, bookingBoardStart)).toContain('</CustomerDetailSectionBand>');

    expect(pageSource).not.toContain('Customer operations digest');
    expect(pageSource).not.toContain('Customer connected operations records');
    expect(pageSource).not.toContain('Customer full record index');
    expect(pageSource).not.toContain('Customer operating ledger');
    expect(pageSource).not.toContain('Customer recent operations timeline');
    expect(pageSource).not.toContain('customer-recent-operations-timeline');
    expect(pageSource).not.toContain('Customer booking evidence bundles');
    expect(pageSource).not.toContain('Customer booking journey');
    expect(pageSource).not.toContain('CustomerOperatingLedgerRow');
    expect(pageSource).not.toContain('CustomerOperationsDigestRow');
    expect(pageSource).not.toContain('CustomerBookingEvidenceRow');
    expect(pageSource).not.toContain('CustomerBookingJourneyRow');
    expect(pageSource).not.toContain('buildCustomerOperatingLedger');
    expect(pageSource).not.toContain('buildCustomerOperationsDigest');
    expect(pageSource).not.toContain('buildCustomerBookingEvidenceRows');
    expect(pageSource).not.toContain('buildCustomerBookingJourneyRows');
    expect(pageSource).not.toContain('customerOperatorCommandQueue.metrics');
    expect(pageSource).not.toContain('customerOperatorCommandQueue.metrics.map');
  });
});
