import { readFileSync } from 'node:fs';

describe('BookingDetailPage shell', () => {
  it('wraps the whole booking detail workspace with the shared Vuexy page shell', () => {
    const source = readFileSync('app/bookings/[id]/page.tsx', 'utf8');

    expect(source).toContain("import { AdminPageTemplate } from '../../../components/admin-page-template';");
    expect(source).toContain('<AdminPageTemplate');
    expect(source).toContain('actions={<BookingDetailToolbar {...toolbarProps} />}');
    expect(source).toContain('contentClassName="booking-detail-page"');
    expect(source).toContain('title={toolbarProps.serviceLabel}');
    expect(source).toContain('description={`${unifiedDetail.statusLabel} · Booking ID ${booking.id}`}');
    expect(source).not.toContain('<div className="booking-detail-page">');
  });
});
