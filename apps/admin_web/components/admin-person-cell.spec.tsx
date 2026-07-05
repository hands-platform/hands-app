import { renderToStaticMarkup } from 'react-dom/server';
import { AdminPersonCell, adminPersonInitials } from './admin-person-cell';

describe('AdminPersonCell', () => {
  it('renders a linked person cell with helper text', () => {
    const markup = renderToStaticMarkup(
      <AdminPersonCell
        avatarClassName="avatar"
        className="person"
        copyClassName="person-copy"
        helper="+84900000000"
        href="/customers/customer_123"
        label="Customer A"
        linkClassName="person-link"
        avatarStatus="online"
      />,
    );

    expect(markup).toContain('class="person"');
    expect(markup).toContain('class="admin-person-avatar-shell"');
    expect(markup).toContain('class="avatar"');
    expect(markup).toContain('class="admin-avatar-status-dot is-online"');
    expect(markup).toContain('aria-label="App online"');
    expect(markup).toContain('CA');
    expect(markup).toContain('href="/customers/customer_123"');
    expect(markup).toContain('class="person-link"');
    expect(markup).toContain('+84900000000');
  });

  it('renders a static person cell without helper text', () => {
    const markup = renderToStaticMarkup(
      <AdminPersonCell avatarClassName="avatar" className="person" label="Open marketplace" />,
    );

    expect(markup).toContain('<strong>Open marketplace</strong>');
    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('class="muted"');
    expect(markup).not.toContain('admin-avatar-status-dot');
  });

  it('deduplicates repeated Vuexy person cell classes from page callers', () => {
    const markup = renderToStaticMarkup(
      <AdminPersonCell
        avatarClassName="vuexy-booking-avatar vuexy-booking-avatar is-customer"
        className="vuexy-booking-person vuexy-booking-person customer-person"
        copyClassName="vuexy-booking-person-copy vuexy-booking-person-copy"
        helper="Wallet clear"
        helperClassName="muted muted customer-helper"
        label="Customer A"
      />,
    );

    expect(markup).toContain('class="vuexy-booking-person customer-person"');
    expect(markup).toContain('class="vuexy-booking-avatar is-customer"');
    expect(markup).toContain('class="vuexy-booking-person-copy"');
    expect(markup).toContain('class="muted customer-helper"');
  });

  it('normalizes initials for table avatars', () => {
    expect(adminPersonInitials('Partner C')).toBe('PC');
    expect(adminPersonInitials('Customer')).toBe('CU');
    expect(adminPersonInitials('')).toBe('NA');
  });
});
