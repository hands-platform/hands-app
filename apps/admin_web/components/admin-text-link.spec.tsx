import { AdminTextLink } from './admin-text-link';

describe('AdminTextLink', () => {
  it('renders the shared Vuexy text link class without duplicating caller classes', () => {
    const link = AdminTextLink({
      children: 'Open booking',
      className: 'text-link finance-row-link',
      href: '/bookings/booking-1',
      title: 'Open booking detail',
    });

    expect(link.props).toMatchObject({
      className: 'text-link finance-row-link',
      href: '/bookings/booking-1',
      title: 'Open booking detail',
      children: 'Open booking',
    });
  });
});
