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
      />,
    );

    expect(markup).toContain('class="person"');
    expect(markup).toContain('class="avatar"');
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
  });

  it('normalizes initials for table avatars', () => {
    expect(adminPersonInitials('Partner C')).toBe('PC');
    expect(adminPersonInitials('Customer')).toBe('CU');
    expect(adminPersonInitials('')).toBe('NA');
  });
});
